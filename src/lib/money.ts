// Parsing/formatting between user-facing baht strings and integer units
// (ADR 0001). Shared by the form (live totals) and server actions.

/** "1,234.56" → 123456 satang. Returns null when not a valid amount. */
export function parseMoneyToSatang(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const [intPart, decPart = ""] = cleaned.replace("-", "").split(".");
  const satang = parseInt(intPart, 10) * 100 + parseInt(decPart.padEnd(2, "0") || "0", 10);
  if (!Number.isSafeInteger(satang)) return null;
  return negative ? -satang : satang;
}

/** "1.5" → 1500 thousandths. Up to 3 decimals. */
export function parseQtyToThousandths(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const [intPart, decPart = ""] = cleaned.split(".");
  const thousandths =
    parseInt(intPart, 10) * 1000 + parseInt(decPart.padEnd(3, "0") || "0", 10);
  return Number.isSafeInteger(thousandths) ? thousandths : null;
}

/** "7" or "1.5" (percent) → 700 / 150 basis points. Up to 2 decimals. */
export function parsePercentToBp(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [intPart, decPart = ""] = cleaned.split(".");
  const bp = parseInt(intPart, 10) * 100 + parseInt(decPart.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(bp) ? bp : null;
}

/** 123456 satang → "1,234.56". */
export function formatSatang(satang: number): string {
  const negative = satang < 0;
  const abs = Math.abs(satang);
  const baht = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${baht.toLocaleString("en-US")}.${dec}`;
}

/** 1500 thousandths → "1.5" (trailing zeros trimmed, thousands separated). */
export function formatQty(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000);
  const frac = thousandths % 1000;
  if (frac === 0) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${String(frac).padStart(3, "0").replace(/0+$/, "")}`;
}

/** 150 bp → "1.5" (trailing zeros trimmed). */
export function formatBpAsPercent(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0").replace(/0+$/, "")}`;
}
