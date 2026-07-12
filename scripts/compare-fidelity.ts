// Fidelity check: renders the seeded example quotation (and derived variants)
// through the real pipeline and compares each against its reference
// PDF. Every scenario runs text-layer assertions (verifiable without sight) plus
// a per-page pixel diff. Run with: npm run fidelity
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { pdfToPng } from "pdf-to-png-converter";
import { prisma } from "../src/lib/prisma";
import { buildContextFromData } from "../src/lib/render/context";
import { calculateDocument } from "../src/lib/calc/engine";
import { bahtTextFromSatang } from "../src/lib/calc/bahtText";
import { renderTemplate } from "../src/lib/render/handlebars";
import { injectFonts } from "../src/lib/render/html";
import { renderPdf } from "../src/lib/render/pdf";

const ROOT = path.resolve(__dirname, "..");
const SCRATCH = path.join(ROOT, "scratch");
const TEMPLATE = path.join(ROOT, "src", "templates", "quotation-default.hbs");

type DocRow = Parameters<typeof buildContextFromData>[0];
type CompanyRow = Parameters<typeof buildContextFromData>[1];

interface Scenario {
  name: string;
  reference: string;
  /** Mutate a fresh copy of the seeded doc for this scenario. */
  transform: (doc: DocRow) => DocRow;
  /** Strings that must appear in the rendered text layer. */
  expect: string[];
  /** Strings that must NOT appear. */
  absent?: string[];
  pages: number;
  /** If set, this string must appear on every page (repeating document header). */
  headerEveryPage?: string;
}

const REMARK_WHT = "ราคาดังกล่าวได้มีการคำนวนภาษีหักไว้ล่วงหน้าแล้ว";
const REMARK_NO_WHT = "ราคาดังกล่าวยังไม่รวมภาษีหัก ณ ที่จ่าย 1%";
const REMARK_LONG = [
  "ราคาดังกล่าวยังไม่รวมภาษีหัก ณ ที่จ่าย 1% และตอนนี้เรากำลังทดสอบหมายเหตุที่ยาวมากๆ จนคิดว่าน่าจะใช้พื้นที่หลายบรรทัด",
  "1. ถ้าสิ่งนี้ใช้ได้เราจะไม่ต้องเสียค่าโปรแกรมบัญชี",
  "2. ถ้าสิ่งนี้ใช้ได้เราจะประหยัดตัง",
  "3. ถ้าสิ่งนี้ใช้ได้เราจะหาเงินได้",
  "4. ถ้าสิ่งนี้ใช้ได้เราจะมีความสุข",
].join("\n");

/** Recompute totals for a doc after its lines / wht changed, half-away rounding. */
function withRecalculatedTotals(doc: DocRow): DocRow {
  const totals = calculateDocument({
    lines: doc.lines.map((l) => ({
      qtyThousandths: l.qtyThousandths,
      unitPriceSatang: l.unitPriceSatang,
      discountType: l.discountType as "NONE" | "PERCENT" | "AMOUNT",
      discountValue: l.discountValue,
    })),
    docDiscountType: "NONE",
    docDiscountValue: 0,
    vatMode: doc.vatMode as "NONE" | "EXCLUSIVE" | "INCLUSIVE",
    vatRateBp: doc.vatRateBp,
    whtRateBp: doc.whtRateBp,
  });
  return {
    ...doc,
    lines: doc.lines.map((l, i) => ({ ...l, lineTotalSatang: totals.lineTotalsSatang[i] })),
    subtotalSatang: totals.subtotalSatang,
    discountSatang: totals.discountSatang,
    afterDiscountSatang: totals.afterDiscountSatang,
    vatSatang: totals.vatSatang,
    grandTotalSatang: totals.grandTotalSatang,
    whtSatang: totals.whtSatang,
    payableSatang: totals.payableSatang,
    bahtText: bahtTextFromSatang(totals.grandTotalSatang),
  };
}

const SCENARIOS: Scenario[] = [
  {
    name: "base",
    reference: "example_qt.pdf",
    transform: (doc) => doc,
    expect: ["ใบเสนอราคา", "100,000.00", "ยอดชำระ", "99,000.00"],
    absent: ["หมายเหตุ"],
    pages: 1,
  },
  {
    name: "remark_wht",
    reference: "example_qt_with_remark.pdf",
    transform: (doc) => ({ ...doc, remark: REMARK_WHT }),
    expect: ["หมายเหตุ", REMARK_WHT, "ยอดชำระ", "99,000.00"],
    pages: 1,
  },
  {
    name: "remark_no_wht",
    reference: "example_qt_with_remark_no_wht.pdf",
    transform: (doc) =>
      withRecalculatedTotals({ ...doc, whtRateBp: null, remark: REMARK_NO_WHT }),
    expect: ["หมายเหตุ", REMARK_NO_WHT, "จำนวนเงินรวมทั้งสิ้น"],
    absent: ["ยอดชำระ"],
    pages: 1,
  },
  {
    // Whole-row pagination (user decision): rows never split mid-cell, so this
    // 11-row stress doc uses 3 pages where the reference's mid-row split fits 2.
    // The reference PDF has 2 pages; we assert our own correct 3-page output and
    // only visually compare the pages that line up (page 1). See ADR 0005.
    name: "long",
    reference: "example_qt_long_remark_and_list.pdf",
    transform: (doc) =>
      withRecalculatedTotals({
        ...doc,
        whtRateBp: null,
        remark: REMARK_LONG,
        lines: Array.from({ length: 11 }, () => ({ ...doc.lines[0] })),
      }),
    expect: [
      "หมายเหตุ",
      "1,100,000.00",
      "(หนึ่งล้านหนึ่งแสนบาทถ้วน)",
      "โปรแกรมบัญชี",
      "หน้าที่ 1/3",
      "หน้าที่ 3/3",
    ],
    absent: ["ยอดชำระ"],
    pages: 3,
    // Repeating document header: the seller name must appear on every page.
    headerEveryPage: "Unseen Horizon",
  },
];

// The reference PDF decomposes ำ into ํ+า; normalize both sides and drop spaces.
const normalize = (s: string) => s.replace(/ํา/g, "ำ").replace(/\s+/g, "");

/** Text of each page separately (index 0 = page 1). */
async function perPageText(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: pdf.slice() });
  const doc = await loadingTask.promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    out.push(tc.items.map((item) => ("str" in item ? item.str : "")).join("\n"));
  }
  await loadingTask.destroy();
  return out;
}

async function toPngPage(pdf: Uint8Array, page: number, name: string): Promise<PNG> {
  const pages = await pdfToPng(Buffer.from(pdf.slice()), {
    viewportScale: 2,
    pagesToProcess: [page],
  });
  const content = pages[0]?.content;
  if (!content) throw new Error(`pdfToPng produced no page ${page} for ${name}`);
  writeFileSync(path.join(SCRATCH, name), content);
  return PNG.sync.read(content);
}

function crop(png: PNG, width: number, height: number): Uint8Array {
  if (png.width === width && png.height === height) return new Uint8Array(png.data);
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
  return new Uint8Array(out.data);
}

async function diffPage(
  ours: Uint8Array,
  reference: Uint8Array,
  scenario: string,
  page: number,
): Promise<string> {
  const o = await toPngPage(ours, page, `${scenario}.p${page}.ours.png`);
  const r = await toPngPage(reference, page, `${scenario}.p${page}.reference.png`);
  const width = Math.min(o.width, r.width);
  const height = Math.min(o.height, r.height);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(
    crop(o, width, height),
    crop(r, width, height),
    diff.data,
    width,
    height,
    { threshold: 0.15 },
  );
  writeFileSync(path.join(SCRATCH, `${scenario}.p${page}.diff.png`), PNG.sync.write(diff));
  return ((mismatched / (width * height)) * 100).toFixed(2);
}

async function main() {
  mkdirSync(SCRATCH, { recursive: true });

  const base = await prisma.document.findUnique({
    where: { docType_docNumber: { docType: "QUOTATION", docNumber: "QT202607060001" } },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!base) throw new Error("Seeded example quotation not found — run npm run db:seed first");
  const company = await prisma.company.findUnique({ where: { id: 1 } });
  if (!company) throw new Error("Company not seeded");

  const source = readFileSync(TEMPLATE, "utf8");
  let anyFailure = false;

  for (const scenario of SCENARIOS) {
    // Fresh deep-ish copy so scenarios never mutate each other or the DB row.
    const docCopy: DocRow = { ...base, lines: base.lines.map((l) => ({ ...l })) } as DocRow;
    const doc = scenario.transform(docCopy);
    const context = await buildContextFromData(doc, company as CompanyRow);
    const html = injectFonts(renderTemplate(source, context));
    writeFileSync(path.join(SCRATCH, `${scenario.name}.html`), html);
    const pdf = new Uint8Array(await renderPdf(html));
    writeFileSync(path.join(SCRATCH, `${scenario.name}.pdf`), pdf);

    console.log(`\n=== ${scenario.name} (${scenario.reference}) ===`);

    const pageTexts = await perPageText(pdf);
    const n = pageTexts.length;

    // --- Page count ---
    if (n !== scenario.pages) {
      console.error(`  PAGES FAILED — expected ${scenario.pages}, got ${n}`);
      anyFailure = true;
    } else {
      console.log(`  PAGES OK — ${n}`);
    }

    // --- Text-layer assertions ---
    const text = normalize(pageTexts.join("\n"));
    const missing = scenario.expect.filter((s) => !text.includes(normalize(s)));
    const leaked = (scenario.absent ?? []).filter((s) => text.includes(normalize(s)));
    if (missing.length) {
      console.error(`  TEXT FAILED — missing: ${missing.join(" | ")}`);
      anyFailure = true;
    }
    if (leaked.length) {
      console.error(`  TEXT FAILED — should be absent: ${leaked.join(" | ")}`);
      anyFailure = true;
    }
    if (!missing.length && !leaked.length) {
      console.log(`  TEXT OK — ${scenario.expect.length} present, ${(scenario.absent ?? []).length} absent`);
    }

    // --- Repeating header (every page carries the document header) ---
    if (scenario.headerEveryPage) {
      const needle = normalize(scenario.headerEveryPage);
      const missingOn = pageTexts
        .map((t, i) => (normalize(t).includes(needle) ? -1 : i + 1))
        .filter((i) => i > 0);
      if (missingOn.length) {
        console.error(`  HEADER FAILED — "${scenario.headerEveryPage}" missing on page(s) ${missingOn.join(", ")}`);
        anyFailure = true;
      } else {
        console.log(`  HEADER OK — repeats on all ${n} pages`);
      }
    }

    // --- Visual diff (only pages that line up with the reference layout) ---
    const refBytes = new Uint8Array(readFileSync(path.join(ROOT, "reference", scenario.reference)));
    const refPages = (await perPageText(refBytes)).length;
    const comparePages = Math.min(n, refPages);
    for (let p = 1; p <= comparePages; p++) {
      const pct = await diffPage(pdf, refBytes, scenario.name, p);
      console.log(`  VISUAL p${p}: ${pct}% differ${p === 1 ? "" : " (layout intentionally differs)"}`);
    }
  }

  console.log(`\nScratch images in ${SCRATCH}\\<scenario>.p<n>.{ours,reference,diff}.png`);
  process.exitCode = anyFailure ? 1 : 0;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    const globalForBrowser = globalThis as unknown as {
      __chromium?: Promise<import("playwright").Browser>;
    };
    if (globalForBrowser.__chromium) {
      await (await globalForBrowser.__chromium).close().catch(() => {});
    }
    // pdfjs worker threads keep the event loop alive — exit explicitly so
    // repeated runs don't accumulate zombie node processes.
    process.exit(process.exitCode ?? 0);
  });
