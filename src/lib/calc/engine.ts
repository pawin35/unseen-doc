// Pure calculation engine (ADR 0001). All inputs/outputs are integers:
// satang for money, basis points for rates, thousandths for quantities.
// Each figure is rounded exactly once, half away from zero, to whole satang.
import type { DiscountType, VatMode } from "@/lib/domain";

export interface LineInput {
  qtyThousandths: number;
  unitPriceSatang: number;
  discountType: DiscountType;
  /** satang if AMOUNT, basis points if PERCENT */
  discountValue: number;
}

export interface DocCalcInput {
  lines: LineInput[];
  docDiscountType: DiscountType;
  /** satang if AMOUNT, basis points if PERCENT */
  docDiscountValue: number;
  vatMode: VatMode;
  vatRateBp: number;
  /** null = no withholding tax */
  whtRateBp: number | null;
}

export interface DocTotals {
  lineTotalsSatang: number[];
  /** รวมเป็นเงิน */
  subtotalSatang: number;
  /** ส่วนลด (document-level) */
  discountSatang: number;
  /** มูลค่าหลังหักส่วนลด */
  afterDiscountSatang: number;
  /** ฐานภาษี (pre-VAT base; equals afterDiscount when no VAT) */
  vatBaseSatang: number;
  /** ภาษีมูลค่าเพิ่ม */
  vatSatang: number;
  /** จำนวนเงินรวมทั้งสิ้น */
  grandTotalSatang: number;
  /** หักภาษี ณ ที่จ่าย */
  whtSatang: number;
  /** ยอดชำระ */
  payableSatang: number;
  show: { discount: boolean; vat: boolean; wht: boolean };
}

/** Round half away from zero to an integer. */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

function discountOf(base: number, type: DiscountType, value: number): number {
  switch (type) {
    case "AMOUNT":
      return value;
    case "PERCENT":
      return roundHalfAwayFromZero((base * value) / 10000);
    case "NONE":
      return 0;
  }
}

export function calculateLine(line: LineInput): number {
  const gross = roundHalfAwayFromZero((line.qtyThousandths * line.unitPriceSatang) / 1000);
  return gross - discountOf(gross, line.discountType, line.discountValue);
}

export function calculateDocument(input: DocCalcInput): DocTotals {
  const lineTotalsSatang = input.lines.map(calculateLine);
  const subtotalSatang = lineTotalsSatang.reduce((sum, v) => sum + v, 0);

  const discountSatang = discountOf(subtotalSatang, input.docDiscountType, input.docDiscountValue);
  const afterDiscountSatang = subtotalSatang - discountSatang;

  let vatBaseSatang: number;
  let vatSatang: number;
  let grandTotalSatang: number;
  switch (input.vatMode) {
    case "EXCLUSIVE":
      vatBaseSatang = afterDiscountSatang;
      vatSatang = roundHalfAwayFromZero((afterDiscountSatang * input.vatRateBp) / 10000);
      grandTotalSatang = afterDiscountSatang + vatSatang;
      break;
    case "INCLUSIVE":
      // afterDiscount is VAT-inclusive: extract VAT with a single rounding,
      // then derive the base — never re-derive VAT from a rounded base.
      vatSatang = roundHalfAwayFromZero(
        (afterDiscountSatang * input.vatRateBp) / (10000 + input.vatRateBp),
      );
      vatBaseSatang = afterDiscountSatang - vatSatang;
      grandTotalSatang = afterDiscountSatang;
      break;
    case "NONE":
      vatBaseSatang = afterDiscountSatang;
      vatSatang = 0;
      grandTotalSatang = afterDiscountSatang;
      break;
  }

  // WHT is computed on the pre-VAT base (matches reference/example_qt.pdf).
  const whtSatang =
    input.whtRateBp == null
      ? 0
      : roundHalfAwayFromZero((vatBaseSatang * input.whtRateBp) / 10000);
  const payableSatang = grandTotalSatang - whtSatang;

  return {
    lineTotalsSatang,
    subtotalSatang,
    discountSatang,
    afterDiscountSatang,
    vatBaseSatang,
    vatSatang,
    grandTotalSatang,
    whtSatang,
    payableSatang,
    show: {
      discount: input.docDiscountType !== "NONE" && discountSatang !== 0,
      vat: input.vatMode !== "NONE",
      wht: input.whtRateBp != null,
    },
  };
}
