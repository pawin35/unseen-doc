// Accessibility + end-to-end walkthrough of every phase-1 flow against a
// running dev server. Writes ARIA snapshots and screenshots to scratch/a11y/
// and prints PASS/FAIL findings. Run: npx tsx scripts/a11y-walkthrough.ts
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.WALKTHROUGH_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(__dirname, "..", "scratch", "a11y");
const USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const TEST_TEMPLATE_NAME = "แบบฟอร์มทดสอบสลับ";
const ALT_MARKER = "WALKTHROUGH-ALT-TEMPLATE";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function snapshot(page: Page, name: string) {
  const aria = await page.locator("body").ariaSnapshot();
  writeFileSync(path.join(OUT, `${name}.aria.yml`), aria, "utf8");
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function activeElementInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      tag: el?.tagName ?? "",
      ariaLabel: el?.getAttribute("aria-label") ?? "",
      id: el?.id ?? "",
    };
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  // Remove leftovers from previous walkthrough runs so count assertions hold.
  await prisma.document.deleteMany({ where: { custName: "บริษัท ทดสอบการเข้าถึง จำกัด" } });
  await prisma.customer.deleteMany({ where: { name: "บริษัท ทดสอบการเข้าถึง จำกัด" } });
  const prior = await prisma.template.findFirst({
    where: { docType: "QUOTATION", name: TEST_TEMPLATE_NAME },
  });
  if (prior) {
    await prisma.template.update({ where: { id: prior.id }, data: { activeVersionId: null } });
    await prisma.template.delete({ where: { id: prior.id } });
  }
  // A second, visually distinguishable QUOTATION template so the document
  // template selector (ADR 0004) has a non-default option to choose.
  const builtIn = await prisma.template.findFirst({
    where: { docType: "QUOTATION", isBuiltIn: true },
    include: { activeVersion: true },
  });
  const altSource = (builtIn?.activeVersion?.source ?? "").replace(
    "</body>",
    `<div>${ALT_MARKER}</div></body>`,
  );
  const altTemplate = await prisma.template.create({
    data: { docType: "QUOTATION", name: TEST_TEMPLATE_NAME },
  });
  const altV1 = await prisma.templateVersion.create({
    data: { templateId: altTemplate.id, versionNo: 1, source: altSource },
  });
  await prisma.template.update({
    where: { id: altTemplate.id },
    data: { activeVersionId: altV1.id },
  });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- Login ---
  await page.goto(`${BASE}/`);
  await page.waitForURL("**/login");
  check("unauthenticated / redirects to /login", page.url().includes("/login"));
  check("login has h1", (await page.locator("h1").count()) === 1);
  await snapshot(page, "01-login");
  await page.getByLabel("ชื่อผู้ใช้").fill(USERNAME);
  await page.getByLabel("รหัสผ่าน").fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL(`${BASE}/`);
  check("login succeeds via labelled fields", true);

  // --- Dashboard ---
  check("dashboard h1 unique", (await page.locator("h1").count()) === 1);
  check("skip link present", (await page.locator("a.skip-link").count()) === 1);
  check(
    "nav landmark labelled",
    (await page.locator('nav[aria-label="เมนูหลัก"]').count()) === 1,
  );
  check(
    "document list is a captioned table",
    (await page.locator("table.data caption").count()) === 1,
  );
  await snapshot(page, "02-dashboard");

  // --- Status filter (GET-driven) ---
  await page.getByRole("radio", { name: "รอตอบรับ" }).check();
  await page.getByRole("button", { name: "กรอง" }).click();
  await page.waitForURL("**/?status=AWAITING");
  check("status filter works via GET", page.url().includes("status=AWAITING"));

  // --- Customers CRUD ---
  await page.getByRole("link", { name: "ลูกค้า" }).click();
  await page.waitForURL("**/customers");
  await snapshot(page, "03-customers");
  await page.getByRole("link", { name: "เพิ่มลูกค้าใหม่" }).click();
  await page.waitForURL("**/customers/new");
  // Error summary path: submit empty (native required blocks; disable it to test server path)
  await page.getByLabel("ชื่อลูกค้า").fill("บริษัท ทดสอบการเข้าถึง จำกัด");
  await page.getByLabel("ที่อยู่").fill("123 ถนนทดสอบ เขตทดสอบ กรุงเทพฯ 10000");
  await page.getByLabel("เลขประจำตัวผู้เสียภาษี (ถ้ามี)").fill("0105500000000");
  await page.getByRole("button", { name: "เพิ่มลูกค้า" }).click();
  await page.waitForURL("**/customers");
  check(
    "customer created and listed",
    (await page.getByRole("rowheader", { name: "บริษัท ทดสอบการเข้าถึง จำกัด" }).count()) === 1,
  );

  // --- Company page labels ---
  await page.getByRole("link", { name: "ข้อมูลกิจการ" }).click();
  await page.waitForURL("**/company");
  check("company logo field states current file", await page.getByText(/โลโก้ปัจจุบัน:/).isVisible());
  check(
    "company signature field states current file",
    await page.getByText(/ลายเซ็นปัจจุบัน:/).isVisible(),
  );
  await snapshot(page, "04-company");

  // --- Quotation form ---
  await page.getByRole("link", { name: "ใบเสนอราคา" }).click();
  await page.getByRole("link", { name: "สร้างใบเสนอราคาใหม่" }).click();
  await page.waitForURL("**/quotations/new");
  await snapshot(page, "05-quotation-form");

  // customer pull into snapshot
  await page.getByLabel("เลือกจากฐานข้อมูลลูกค้า").selectOption({
    label: "บริษัท ทดสอบการเข้าถึง จำกัด",
  });
  await page.getByRole("button", { name: "ดึงข้อมูลลูกค้า" }).click();
  check(
    "snapshot fields filled from customer",
    (await page.getByLabel("ชื่อลูกค้าในเอกสาร").inputValue()) ===
      "บริษัท ทดสอบการเข้าถึง จำกัด",
  );

  // line rows: fill row 1
  await page.getByLabel("รายละเอียด รายการที่ 1").fill("บริการทดสอบการเข้าถึง");
  await page.getByLabel("จำนวน รายการที่ 1").fill("2");
  await page.getByLabel("ราคาต่อหน่วย รายการที่ 1").fill("1500");

  // add row → focus must land on new row's description
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  let active = await activeElementInfo(page);
  check(
    "add-row moves focus to new row description",
    active.ariaLabel === "รายละเอียด รายการที่ 2",
    JSON.stringify(active),
  );
  await page.getByLabel("รายละเอียด รายการที่ 2").fill("รายการชั่วคราว");
  await page.getByLabel("จำนวน รายการที่ 2").fill("1");
  await page.getByLabel("ราคาต่อหน่วย รายการที่ 2").fill("100");

  // delete row 2 → focus returns to row 1 description
  await page.getByRole("button", { name: "ลบรายการที่ 2" }).click();
  active = await activeElementInfo(page);
  check(
    "delete-row returns focus to previous row",
    active.ariaLabel === "รายละเอียด รายการที่ 1",
    JSON.stringify(active),
  );

  // WHT + live totals
  await page.getByLabel("อัตราหักภาษี ณ ที่จ่าย").selectOption("100");
  await page.waitForTimeout(1300); // debounce for the aria-live summary
  const spoken = await page.locator('p[aria-live="polite"].hint').textContent();
  check(
    "debounced live total announced",
    (spoken ?? "").includes("ยอดชำระ") && (spoken ?? "").includes("2,970.00"),
    spoken ?? "",
  );

  // signatory overrides + hide signature image
  await page.getByLabel(/ผู้ลงนามฝั่งลูกค้า .* ไม่ใช่ชื่อลูกค้า/).check();
  await page.getByLabel("ชื่อผู้ลงนามฝั่งลูกค้า").fill("นาย ผู้ลงนาม ทดสอบ");
  await page.getByLabel(/ผู้ลงนามฝั่งผู้ขาย .* ไม่ใช่ชื่อกิจการ/).check();
  await page.getByLabel("ชื่อผู้ลงนามฝั่งผู้ขาย").fill("นาง ผู้อนุมัติ แทน");
  await page.getByLabel("แสดงรูปลายเซ็นในเอกสาร").uncheck();

  // remark (printed) vs internal note (never printed)
  await page.getByLabel("หมายเหตุ", { exact: true }).fill("ราคานี้รวมค่าติดตั้งแล้ว");
  await page.getByLabel("บันทึกภายใน (ไม่แสดงในเอกสาร)").fill("ลูกค้าเก่า ให้ส่วนลดพิเศษได้");

  await page.getByRole("button", { name: "บันทึกใบเสนอราคา" }).click();
  await page.waitForURL(/\/quotations\/(?!new$)[a-z0-9]+$/);
  const docUrl = page.url();
  check("quotation created (auto number)", await page.getByText(/QT\d{12}/).first().isVisible());
  await snapshot(page, "06-quotation-view");

  // --- Signatory override reflected on view + in the rendered document ---
  check(
    "view page shows overridden signatories",
    (await page.getByText("นาย ผู้ลงนาม ทดสอบ (กำหนดเอง)").isVisible()) &&
      (await page.getByText("นาง ผู้อนุมัติ แทน (กำหนดเอง)").isVisible()),
  );
  check(
    "view page shows signature image hidden",
    await page.getByText("ไม่แสดง (เว้นว่างให้เซ็น)").isVisible(),
  );
  const overrideId = docUrl.split("/").pop();
  const overrideHtml = await (
    await page.request.get(`${BASE}/api/documents/${overrideId}/preview`)
  ).text();
  // Match the rendered <img> tag, not the ".signature-img" CSS rule that is
  // always present in the template's <style> block.
  const sigImgTag = /<img[^>]*class="signature-img"/;
  check(
    "rendered doc prints overridden names, no signature image",
    overrideHtml.includes("ในนาม นาย ผู้ลงนาม ทดสอบ") &&
      overrideHtml.includes("ในนาม นาง ผู้อนุมัติ แทน") &&
      !sigImgTag.test(overrideHtml),
    "",
  );
  check(
    "rendered doc prints the remark but not the internal note",
    overrideHtml.includes("ราคานี้รวมค่าติดตั้งแล้ว") &&
      !overrideHtml.includes("ลูกค้าเก่า ให้ส่วนลดพิเศษได้"),
    "",
  );

  // --- Plain quotation falls back to party names + shows the image ---
  await page.goto(`${BASE}/quotations/new`);
  await page.getByLabel("เลือกจากฐานข้อมูลลูกค้า").selectOption({
    label: "บริษัท ทดสอบการเข้าถึง จำกัด",
  });
  await page.getByRole("button", { name: "ดึงข้อมูลลูกค้า" }).click();
  await page.getByLabel("รายละเอียด รายการที่ 1").fill("บริการทดสอบ fallback");
  await page.getByLabel("จำนวน รายการที่ 1").fill("1");
  await page.getByLabel("ราคาต่อหน่วย รายการที่ 1").fill("500");
  await page.getByRole("button", { name: "บันทึกใบเสนอราคา" }).click();
  await page.waitForURL(/\/quotations\/(?!new$)[a-z0-9]+$/);
  const plainId = page.url().split("/").pop();
  const plainHtml = await (
    await page.request.get(`${BASE}/api/documents/${plainId}/preview`)
  ).text();
  check(
    "plain doc falls back to party names with signature image",
    plainHtml.includes("ในนาม บริษัท ทดสอบการเข้าถึง จำกัด") && sigImgTag.test(plainHtml),
    "",
  );

  // --- Per-document template selection + freeze at issue (ADR 0004) ---
  await page.goto(`${BASE}/quotations/new`);
  const templateSelect = page.getByLabel("แบบฟอร์มเอกสาร");
  check(
    "template select defaults to the built-in",
    ((await templateSelect.locator("option:checked").textContent()) ?? "").includes(
      "ค่าเริ่มต้น",
    ),
  );
  await page.getByLabel("เลือกจากฐานข้อมูลลูกค้า").selectOption({
    label: "บริษัท ทดสอบการเข้าถึง จำกัด",
  });
  await page.getByRole("button", { name: "ดึงข้อมูลลูกค้า" }).click();
  await page.getByLabel("รายละเอียด รายการที่ 1").fill("บริการทดสอบแบบฟอร์ม");
  await page.getByLabel("จำนวน รายการที่ 1").fill("1");
  await page.getByLabel("ราคาต่อหน่วย รายการที่ 1").fill("400");
  await templateSelect.selectOption({ label: TEST_TEMPLATE_NAME });
  await page.getByRole("button", { name: "บันทึกใบเสนอราคา" }).click();
  await page.waitForURL(/\/quotations\/(?!new$)[a-z0-9]+$/);
  const tmplDocUrl = page.url();
  const tmplDocId = tmplDocUrl.split("/").pop();

  const draftHtml = await (
    await page.request.get(`${BASE}/api/documents/${tmplDocId}/preview`)
  ).text();
  check(
    "draft renders the selected non-default template",
    draftHtml.includes(ALT_MARKER),
  );
  check(
    "draft view shows latest-version wording (not yet frozen)",
    await page.getByText(/ใช้แบบฟอร์ม .* เวอร์ชันล่าสุด/).isVisible(),
  );

  // Issue → freezes the version at that moment; selector locks.
  await page.getByRole("button", { name: "ออกเอกสาร (รอตอบรับ)" }).click();
  await page.waitForLoadState("networkidle");
  check(
    "issued template-doc shows frozen pin",
    await page.getByText(/เอกสารนี้ตรึงกับแบบฟอร์ม/).isVisible(),
  );
  await page.goto(`${BASE}/quotations/${tmplDocId}/edit`);
  check(
    "template select disabled once issued",
    await page.getByLabel("แบบฟอร์มเอกสาร").isDisabled(),
  );

  // Advance the alt template to a v2 WITHOUT the marker; the frozen issued doc
  // must still reprint v1 (proving the pin froze at issue, not at print time).
  const altNow = await prisma.template.findFirst({
    where: { name: TEST_TEMPLATE_NAME },
    include: { activeVersion: true },
  });
  const altV2 = await prisma.templateVersion.create({
    data: {
      templateId: altNow!.id,
      versionNo: 2,
      source: (altNow!.activeVersion!.source).replace(ALT_MARKER, "ALT-V2-NO-MARKER"),
    },
  });
  await prisma.template.update({
    where: { id: altNow!.id },
    data: { activeVersionId: altV2.id },
  });
  const frozenHtml = await (
    await page.request.get(`${BASE}/api/documents/${tmplDocId}/preview`)
  ).text();
  check(
    "issued doc keeps frozen v1 after its template advances",
    frozenHtml.includes(ALT_MARKER) && !frozenHtml.includes("ALT-V2-NO-MARKER"),
  );

  // Revert to draft → reopens selection (and floats back to the latest version).
  await page.goto(tmplDocUrl);
  await page.getByRole("button", { name: "กลับเป็นร่าง" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto(`${BASE}/quotations/${tmplDocId}/edit`);
  check(
    "template select re-enabled after revert to draft",
    !(await page.getByLabel("แบบฟอร์มเอกสาร").isDisabled()),
  );

  await page.goto(docUrl);

  // --- Status transition ---
  await page.getByRole("button", { name: "ออกเอกสาร (รอตอบรับ)" }).click();
  await page.waitForLoadState("networkidle");
  check("status moved to รอตอบรับ", await page.getByText("รอตอบรับ").first().isVisible());

  // --- PDF download (doc was issued above, so the version is frozen) ---
  const apiPdf = await page.request.get(
    `${BASE}/api/documents/${docUrl.split("/").pop()}/pdf`,
  );
  check(
    "PDF endpoint returns application/pdf",
    apiPdf.ok() && (apiPdf.headers()["content-type"] ?? "").includes("application/pdf"),
    apiPdf.status().toString(),
  );
  await page.reload();
  check(
    "issued doc shows frozen template pin",
    await page.getByText(/เอกสารนี้ตรึงกับแบบฟอร์ม/).isVisible(),
  );

  // --- Single PDF link, no pinned-vs-latest choice (ADR 0004) ---
  check(
    "exactly one PDF download link, no 'latest' variant",
    (await page.getByRole("link", { name: /ดาวน์โหลด PDF/ }).count()) === 1,
  );

  // --- Template editor ---
  await page.getByRole("link", { name: "แบบฟอร์มเอกสาร" }).click();
  await page.waitForURL("**/templates");
  await snapshot(page, "07-templates");
  await page.getByRole("link", { name: /ดูโค้ด ค่าเริ่มต้น/ }).click();
  await page.waitForURL("**/edit");
  check(
    "template source is a labelled textarea",
    await page.getByLabel("โค้ดแบบฟอร์ม (HTML + Handlebars)").isVisible(),
  );
  check(
    "built-in textarea is read-only",
    (await page.getByLabel("โค้ดแบบฟอร์ม (HTML + Handlebars)").getAttribute("readonly")) !== null,
  );
  await page.getByRole("button", { name: "แสดงตัวอย่าง" }).click();
  await page.waitForSelector('iframe[title="ตัวอย่างแบบฟอร์มกับข้อมูลเอกสารตัวอย่าง"]');
  check("template preview renders in titled iframe", true);
  await snapshot(page, "08-template-editor");

  // --- Keyboard: tab reaches skip link first ---
  await page.goto(`${BASE}/`);
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => document.activeElement?.className ?? "");
  check("first Tab lands on skip link", firstFocus.includes("skip-link"), firstFocus);

  await browser.close();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
