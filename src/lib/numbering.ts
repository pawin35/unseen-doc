import { prisma } from "@/lib/prisma";
import type { DocType } from "@/lib/domain";

/** Calendar-date parts in Asia/Bangkok regardless of host timezone. */
export function bangkokDateParts(date: Date): { yyyy: string; mm: string; dd: string } {
  // en-CA formats as YYYY-MM-DD.
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [yyyy, mm, dd] = formatted.split("-");
  return { yyyy, mm, dd };
}

export function formatDocNumber(
  pattern: string,
  padding: number,
  date: Date,
  counterValue: number,
): string {
  const { yyyy, mm, dd } = bangkokDateParts(date);
  return pattern
    .replace("{YYYY}", yyyy)
    .replace("{MM}", mm)
    .replace("{DD}", dd)
    .replace("{NNNN}", String(counterValue).padStart(padding, "0"));
}

/**
 * Next auto-generated document number for the type + issue date.
 * The daily counter increment is a single atomic UPDATE (race-safe on both
 * SQLite and Postgres). Uniqueness is ultimately enforced by the
 * @@unique([docType, docNumber]) constraint — callers retry on P2002.
 */
export async function generateDocNumber(docType: DocType, issueDate: Date): Promise<string> {
  const setting = await prisma.numberingSetting.findUnique({ where: { docType } });
  if (!setting) {
    throw new Error(`No NumberingSetting for docType ${docType}`);
  }
  const { yyyy, mm, dd } = bangkokDateParts(issueDate);
  const dateKey = `${yyyy}${mm}${dd}`;

  await prisma.numberingCounter.upsert({
    where: { docType_dateKey: { docType, dateKey } },
    create: { docType, dateKey, lastValue: 0 },
    update: {},
  });
  const counter = await prisma.numberingCounter.update({
    where: { docType_dateKey: { docType, dateKey } },
    data: { lastValue: { increment: 1 } },
  });

  return formatDocNumber(setting.pattern, setting.padding, issueDate, counter.lastValue);
}
