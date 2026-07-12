// Thai spelled-out money amounts (Excel BAHTTEXT-compatible).
// Hand-written because the `bahttext` npm package reads a trailing 1 after a
// zero tens digit as หนึ่ง (101 → หนึ่งร้อยหนึ่ง) instead of the official เอ็ด.

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Read 0 < n < 1,000,000. `hasHigher` = higher ล้าน groups exist, so a bare 1 reads เอ็ด. */
function readBelowMillion(n: number, hasHigher: boolean): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = s.charCodeAt(i) - 48;
    const pos = s.length - i - 1;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && (s.length > 1 || hasHigher)) {
      out += "เอ็ด";
    } else if (pos === 1 && d === 2) {
      out += "ยี่สิบ";
    } else if (pos === 1 && d === 1) {
      out += "สิบ";
    } else {
      out += DIGITS[d] + POSITIONS[pos];
    }
  }
  return out;
}

/** Read a non-negative integer, splitting into ล้าน (10^6) groups. */
function readInteger(n: number): string {
  if (n === 0) return DIGITS[0];
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.unshift(rest % 1_000_000);
    rest = Math.floor(rest / 1_000_000);
  }
  let out = "";
  for (let i = 0; i < groups.length; i++) {
    const isLast = i === groups.length - 1;
    if (groups[i] !== 0) {
      out += readBelowMillion(groups[i], isLast && i > 0);
    }
    if (!isLast) out += "ล้าน";
  }
  return out;
}

/**
 * Thai spelled-out amount from integer satang, e.g. 10000000 → "หนึ่งแสนบาทถ้วน".
 */
export function bahtTextFromSatang(satang: number): string {
  if (!Number.isInteger(satang)) {
    throw new Error(`bahtTextFromSatang expects integer satang, got ${satang}`);
  }
  const sign = satang < 0 ? "ลบ" : "";
  const abs = Math.abs(satang);
  const baht = Math.floor(abs / 100);
  const st = abs % 100;

  if (baht === 0 && st === 0) return "ศูนย์บาทถ้วน";
  if (baht === 0) return `${sign}${readInteger(st)}สตางค์`;
  const bahtPart = `${sign}${readInteger(baht)}บาท`;
  return st === 0 ? `${bahtPart}ถ้วน` : `${bahtPart}${readInteger(st)}สตางค์`;
}
