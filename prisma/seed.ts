import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { calculateDocument } from "../src/lib/calc/engine";
import { bahtTextFromSatang } from "../src/lib/calc/bahtText";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR ?? "./data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function seedUpload(referenceFile: string, targetName: string): string | null {
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const target = path.join(UPLOADS_DIR, targetName);
  if (existsSync(target)) return targetName;
  const source = path.join(ROOT, "reference", referenceFile);
  if (!existsSync(source)) return null; // reference assets absent (e.g. Docker image)
  copyFileSync(source, target);
  return targetName;
}

async function main() {
  // --- Company (singleton, matching reference/example_qt.pdf) ---
  const logoPath = seedUpload("example_logo.PNG", "logo.png");
  const signaturePath = seedUpload("example_signature.jpg", "signature.jpg");

  const company = {
    name: "นาย ศิวนาถ มณีแดง (ในนามกลุ่ม Unseen Horizon)",
    address: "328/141 (ออนป้าทาวเวอร์) ซ.จรัญสนิทวงศ์ 67 แขวงบางพลัด เขตบางพลัด กรุงเทพ 10700",
    taxId: "1779900220368",
    branchType: "HEAD_OFFICE",
    phone: "0809900069",
    logoPath,
    signaturePath,
  };
  // Create-only: the seed runs on every container start and must never
  // overwrite company details the user has edited in the app.
  await prisma.company.upsert({
    where: { id: 1 },
    create: { id: 1, ...company },
    update: {},
  });

  // --- Numbering ---
  await prisma.numberingSetting.upsert({
    where: { docType: "QUOTATION" },
    create: { docType: "QUOTATION", pattern: "QT{YYYY}{MM}{DD}{NNNN}", padding: 4 },
    update: {},
  });

  // --- Built-in template (ADR 0003: repo file is the source of truth) ---
  const source = readFileSync(path.join(ROOT, "src", "templates", "quotation-default.hbs"), "utf8");
  let template = await prisma.template.findUnique({
    where: { docType_name: { docType: "QUOTATION", name: "ค่าเริ่มต้น" } },
    include: { activeVersion: true },
  });
  if (!template) {
    const created = await prisma.template.create({
      data: {
        docType: "QUOTATION",
        name: "ค่าเริ่มต้น",
        isBuiltIn: true,
        versions: { create: { versionNo: 1, source } },
      },
      include: { versions: true },
    });
    template = await prisma.template.update({
      where: { id: created.id },
      data: { activeVersionId: created.versions[0].id },
      include: { activeVersion: true },
    });
  }
  // Keep the built-in template in sync with the repo file: when the shipped
  // default changes, publish it as a new active version (old versions and
  // documents pinned to them are untouched — ADR 0003).
  if (template.activeVersion && template.activeVersion.source !== source) {
    const last = await prisma.templateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const newVersion = await prisma.templateVersion.create({
      data: { templateId: template.id, versionNo: (last?.versionNo ?? 0) + 1, source },
    });
    template = await prisma.template.update({
      where: { id: template.id },
      data: { activeVersionId: newVersion.id },
      include: { activeVersion: true },
    });
  }

  const activeVersionId = template.activeVersionId;
  if (!activeVersionId) throw new Error("Built-in template has no active version");

  // --- Sample customer (matching the example) ---
  const customerData = {
    name: "กองทุนสนับสนุนการสร้างเสริมสุขภาพ",
    address: "99/8 อาคารศูนย์เรียนรู้สุขภาวะ ซ.งามดูพลี แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120",
    taxId: "0994000005377",
    branchType: "HEAD_OFFICE",
  };
  const existingCustomer = await prisma.customer.findFirst({
    where: { name: customerData.name },
  });
  const customer =
    existingCustomer ?? (await prisma.customer.create({ data: customerData }));

  // --- Sample quotation replicating example_qt.pdf ---
  const description = [
    "1.1. ทบทวนวรรณกรรมเกี่ยวกับการเข้าถึงระบบบริการทางการแพทย์ในสถานพยาบาลของผู้พิการทางสายตา",
    "1.2. พัฒนาแพลตฟอร์มออนไลน์และเครือข่ายอาสาสมัคร พร้อมทดลองจัดบริการพาผู้พิการทางสายตาไปพบแพทย์ และสรุปผลการทดลองจัดบริการ",
  ].join("\n");

  const lines = [
    {
      qtyThousandths: 1000,
      unitPriceSatang: 100_000_00,
      discountType: "NONE" as const,
      discountValue: 0,
    },
  ];
  const totals = calculateDocument({
    lines,
    docDiscountType: "NONE",
    docDiscountValue: 0,
    vatMode: "NONE",
    vatRateBp: 700,
    whtRateBp: 100,
  });

  const docNumber = "QT202607060001";
  const existingDoc = await prisma.document.findUnique({
    where: { docType_docNumber: { docType: "QUOTATION", docNumber } },
  });
  if (!existingDoc) {
    await prisma.document.create({
      data: {
        docType: "QUOTATION",
        docNumber,
        issueDate: new Date("2026-07-06T00:00:00.000Z"),
        status: "AWAITING",
        customerId: customer.id,
        custName: customerData.name,
        custAddress: customerData.address,
        custTaxId: customerData.taxId,
        custBranchType: customerData.branchType,
        vatMode: "NONE",
        vatRateBp: 700,
        whtRateBp: 100,
        docDiscountType: "NONE",
        docDiscountValue: 0,
        subtotalSatang: totals.subtotalSatang,
        discountSatang: totals.discountSatang,
        afterDiscountSatang: totals.afterDiscountSatang,
        vatSatang: totals.vatSatang,
        grandTotalSatang: totals.grandTotalSatang,
        whtSatang: totals.whtSatang,
        payableSatang: totals.payableSatang,
        bahtText: bahtTextFromSatang(totals.grandTotalSatang),
        templateVersionId: activeVersionId,
        lines: {
          create: [
            {
              sortOrder: 1,
              description,
              qtyThousandths: lines[0].qtyThousandths,
              unitPriceSatang: lines[0].unitPriceSatang,
              discountType: lines[0].discountType,
              discountValue: lines[0].discountValue,
              lineTotalSatang: totals.lineTotalsSatang[0],
            },
          ],
        },
      },
    });
    // Keep the daily counter consistent with the seeded number.
    await prisma.numberingCounter.upsert({
      where: { docType_dateKey: { docType: "QUOTATION", dateKey: "20260706" } },
      create: { docType: "QUOTATION", dateKey: "20260706", lastValue: 1 },
      update: { lastValue: { increment: 0 } },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
