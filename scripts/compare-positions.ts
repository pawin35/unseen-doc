// Numeric fidelity analysis: extracts text-run positions and font sizes from
// our rendered PDF and the reference, then prints them side by side in mm so
// template CSS can be tuned against measurements instead of eyeballing.
// Run: npx tsx scripts/compare-positions.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { buildRenderContext } from "../src/lib/render/context";
import { renderTemplate } from "../src/lib/render/handlebars";
import { injectFonts } from "../src/lib/render/html";
import { renderPdf } from "../src/lib/render/pdf";

const ROOT = path.resolve(__dirname, "..");
const PT_TO_MM = 25.4 / 72;

interface Run {
  text: string;
  xMm: number;
  yMm: number; // from TOP of page
  sizePt: number;
  widthMm: number;
}

const normalize = (s: string) => s.replace(/ํา/g, "ำ").replace(/\s+/g, "");

async function extractRuns(pdf: Uint8Array): Promise<{ runs: Run[]; heightMm: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: pdf.slice() });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const heightPt = viewport.height;
  const tc = await page.getTextContent();
  const runs: Run[] = [];
  for (const item of tc.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const [a, , , , e, f] = item.transform;
    runs.push({
      text: item.str,
      xMm: e * PT_TO_MM,
      yMm: (heightPt - f) * PT_TO_MM,
      sizePt: Math.abs(a),
      widthMm: item.width * PT_TO_MM,
    });
  }
  await loadingTask.destroy();
  return { runs, heightMm: heightPt * PT_TO_MM };
}

/** Group runs into visual lines (same baseline ±0.4mm), joined left-to-right. */
function toLines(runs: Run[]): Run[] {
  const sorted = [...runs].sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);
  const lines: Run[] = [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.yMm - r.yMm) < 0.4) {
      last.text += r.text;
      last.widthMm = r.xMm + r.widthMm - last.xMm;
    } else {
      lines.push({ ...r });
    }
  }
  return lines;
}

function findRun(runs: Run[], needle: string, nth = 0): Run | undefined {
  const n = normalize(needle);
  const matches = toLines(runs).filter((r) => normalize(r.text).includes(n));
  return matches[nth]; // matches are already sorted top-to-bottom
}

const ANCHORS: Array<{ label: string; needle: string; nth?: number }> = [
  { label: "title ใบเสนอราคา", needle: "ใบเสนอราคา" },
  { label: "เลขที่ label", needle: "เลขที่" },
  { label: "doc number", needle: "QT202607060001" },
  { label: "วันที่ label", needle: "วันที่" },
  { label: "date value", needle: "06/07/2026" },
  { label: "seller name", needle: "ศิวนาถ" },
  { label: "seller addr", needle: "328/141" },
  { label: "seller taxid", needle: "1779900220368" },
  { label: "โทร", needle: "0809900069" },
  { label: "ลูกค้า label", needle: "ลูกค้า" },
  { label: "cust name", needle: "กองทุนสนับสนุน" },
  { label: "cust addr", needle: "99/8" },
  { label: "cust taxid", needle: "0994000005377" },
  { label: "th #", needle: "#" },
  { label: "th รายละเอียด", needle: "รายละเอียด" },
  { label: "th จำนวน", needle: "จำนวน" },
  { label: "th ราคาต่อหน่วย", needle: "ราคาต่อหน่วย" },
  { label: "th ส่วนลด", needle: "ส่วนลด" },
  { label: "th มูลค่า", needle: "มูลค่า" },
  { label: "line desc 1.1", needle: "1.1." },
  { label: "line desc 1.2", needle: "1.2." },
  { label: "unit price", needle: "100,000.00" },
  { label: "รวมเป็นเงิน", needle: "รวมเป็นเงิน" },
  { label: "จำนวนเงินรวมทั้งสิ้น", needle: "จำนวนเงินรวมทั้งสิ้น" },
  { label: "baht text", needle: "หนึ่งแสนบาทถ้วน" },
  { label: "หักภาษี", needle: "หักภาษี" },
  { label: "1,000.00", needle: "1,000.00" },
  { label: "ยอดชำระ", needle: "ยอดชำระ" },
  { label: "99,000.00", needle: "99,000.00" },
  { label: "ในนาม cust", needle: "ในนาม กองทุน" },
  { label: "ในนาม seller", needle: "ในนาม นาย" },
  { label: "sig date (bottom)", needle: "06/07/2026", nth: 1 },
  { label: "ผู้สั่งซื้อ", needle: "สั่งซื้อ" },
  { label: "ผู้อนุมัติ", needle: "อนุมัติ" },
  { label: "totals รวมเป็น", needle: "รวมเป็น" },
  { label: "totals จำนวนเงินรวม", needle: "จำนวนเงินรวม" },
];

function fmt(r: Run | undefined): string {
  if (!r) return "(not found)".padEnd(34);
  return `x=${r.xMm.toFixed(1).padStart(6)} y=${r.yMm.toFixed(1).padStart(6)} ${r.sizePt.toFixed(1).padStart(5)}pt w=${r.widthMm.toFixed(1).padStart(5)}`;
}

async function main() {
  const doc = await prisma.document.findUnique({
    where: { docType_docNumber: { docType: "QUOTATION", docNumber: "QT202607060001" } },
    select: { id: true },
  });
  if (!doc) throw new Error("Seeded example quotation not found");

  const prepared = await buildRenderContext(doc.id);
  const source = readFileSync(
    path.join(ROOT, "src", "templates", "quotation-default.hbs"),
    "utf8",
  );
  const html = injectFonts(renderTemplate(source, prepared.context));
  const oursPdf = new Uint8Array(await renderPdf(html));

  const ours = await extractRuns(oursPdf);
  const ref = await extractRuns(
    new Uint8Array(readFileSync(path.join(ROOT, "reference", "example_qt.pdf"))),
  );

  console.log(
    `page height: ours ${ours.heightMm.toFixed(1)}mm ref ${ref.heightMm.toFixed(1)}mm`,
  );
  console.log(`${"anchor".padEnd(24)} | ${"REFERENCE".padEnd(34)} | OURS  (dy = ours-ref)`);
  for (const a of ANCHORS) {
    const r = findRun(ref.runs, a.needle, a.nth ?? 0);
    const o = findRun(ours.runs, a.needle, a.nth ?? 0);
    const dy = r && o ? (o.yMm - r.yMm).toFixed(1) : "—";
    const dx = r && o ? (o.xMm - r.xMm).toFixed(1) : "—";
    console.log(`${a.label.padEnd(24)} | ${fmt(r)} | ${fmt(o)}  dy=${dy} dx=${dx}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    const g = globalThis as unknown as { __chromium?: Promise<import("playwright").Browser> };
    if (g.__chromium) await (await g.__chromium).close().catch(() => {});
    // pdfjs worker threads keep the event loop alive — exit explicitly.
    process.exit(process.exitCode ?? 0);
  });
