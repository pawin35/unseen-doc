import { describe, expect, it } from "vitest";
import { calculateDocument, calculateLine } from "./engine";

describe("calculateLine", () => {
  it("multiplies quantity (thousandths) by unit price", () => {
    expect(
      calculateLine({
        qtyThousandths: 1000,
        unitPriceSatang: 10000000,
        discountType: "NONE",
        discountValue: 0,
      }),
    ).toBe(10000000);
  });

  it("handles fractional quantities with one rounding", () => {
    // 1.5 × 33.33 = 49.995 → 50.00 (half away from zero)
    expect(
      calculateLine({
        qtyThousandths: 1500,
        unitPriceSatang: 3333,
        discountType: "NONE",
        discountValue: 0,
      }),
    ).toBe(5000);
  });

  it("applies amount discount in satang", () => {
    expect(
      calculateLine({
        qtyThousandths: 2000,
        unitPriceSatang: 50000,
        discountType: "AMOUNT",
        discountValue: 2500,
      }),
    ).toBe(97500);
  });

  it("applies percent discount in basis points, rounded once", () => {
    // 100.00 × 12.5% = 12.50 → 87.50
    expect(
      calculateLine({
        qtyThousandths: 1000,
        unitPriceSatang: 10000,
        discountType: "PERCENT",
        discountValue: 1250,
      }),
    ).toBe(8750);
  });
});

describe("calculateDocument — reference example (example_qt.pdf)", () => {
  // 1 × 100,000.00, no VAT, WHT 1% → 100,000 / 1,000 / 99,000
  const totals = calculateDocument({
    lines: [
      { qtyThousandths: 1000, unitPriceSatang: 10000000, discountType: "NONE", discountValue: 0 },
    ],
    docDiscountType: "NONE",
    docDiscountValue: 0,
    vatMode: "NONE",
    vatRateBp: 700,
    whtRateBp: 100,
  });

  it("matches รวมเป็นเงิน 100,000.00", () => {
    expect(totals.subtotalSatang).toBe(10000000);
  });
  it("matches จำนวนเงินรวมทั้งสิ้น 100,000.00", () => {
    expect(totals.grandTotalSatang).toBe(10000000);
  });
  it("matches หักภาษี ณ ที่จ่าย 1% = 1,000.00", () => {
    expect(totals.whtSatang).toBe(100000);
  });
  it("matches ยอดชำระ 99,000.00", () => {
    expect(totals.payableSatang).toBe(9900000);
  });
  it("shows WHT but not VAT or discount", () => {
    expect(totals.show).toEqual({ discount: false, vat: false, wht: true });
  });
});

describe("calculateDocument — VAT exclusive", () => {
  it("adds 7% VAT on the discounted base", () => {
    const totals = calculateDocument({
      lines: [
        { qtyThousandths: 1000, unitPriceSatang: 100000, discountType: "NONE", discountValue: 0 },
      ],
      docDiscountType: "AMOUNT",
      docDiscountValue: 10000, // ส่วนลด 100.00
      vatMode: "EXCLUSIVE",
      vatRateBp: 700,
      whtRateBp: null,
    });
    expect(totals.afterDiscountSatang).toBe(90000); // 900.00
    expect(totals.vatSatang).toBe(6300); // 63.00
    expect(totals.grandTotalSatang).toBe(96300); // 963.00
    expect(totals.payableSatang).toBe(96300);
  });

  it("computes WHT on the pre-VAT base, not the VAT-inclusive total", () => {
    const totals = calculateDocument({
      lines: [
        { qtyThousandths: 1000, unitPriceSatang: 10000000, discountType: "NONE", discountValue: 0 },
      ],
      docDiscountType: "NONE",
      docDiscountValue: 0,
      vatMode: "EXCLUSIVE",
      vatRateBp: 700,
      whtRateBp: 300, // 3%
    });
    expect(totals.vatSatang).toBe(700000); // 7,000.00
    expect(totals.grandTotalSatang).toBe(10700000); // 107,000.00
    expect(totals.whtSatang).toBe(300000); // 3% of 100,000 = 3,000.00
    expect(totals.payableSatang).toBe(10400000); // 104,000.00
  });
});

describe("calculateDocument — VAT inclusive", () => {
  it("extracts VAT with a single rounding site", () => {
    // 107.00 inclusive of 7% → VAT 7.00, base 100.00
    const totals = calculateDocument({
      lines: [
        { qtyThousandths: 1000, unitPriceSatang: 10700, discountType: "NONE", discountValue: 0 },
      ],
      docDiscountType: "NONE",
      docDiscountValue: 0,
      vatMode: "INCLUSIVE",
      vatRateBp: 700,
      whtRateBp: null,
    });
    expect(totals.vatSatang).toBe(700);
    expect(totals.vatBaseSatang).toBe(10000);
    expect(totals.grandTotalSatang).toBe(10700);
  });

  it("keeps base + VAT equal to the inclusive total even when rounding", () => {
    // 100.00 inclusive → VAT = 100 × 7/107 = 6.5420… → 6.54, base 93.46
    const totals = calculateDocument({
      lines: [
        { qtyThousandths: 1000, unitPriceSatang: 10000, discountType: "NONE", discountValue: 0 },
      ],
      docDiscountType: "NONE",
      docDiscountValue: 0,
      vatMode: "INCLUSIVE",
      vatRateBp: 700,
      whtRateBp: null,
    });
    expect(totals.vatSatang).toBe(654);
    expect(totals.vatBaseSatang).toBe(9346);
    expect(totals.vatBaseSatang + totals.vatSatang).toBe(totals.grandTotalSatang);
  });
});

describe("calculateDocument — document percent discount", () => {
  it("rounds the discount once", () => {
    // Subtotal 333.33, 10% → 33.33
    const totals = calculateDocument({
      lines: [
        { qtyThousandths: 1000, unitPriceSatang: 33333, discountType: "NONE", discountValue: 0 },
      ],
      docDiscountType: "PERCENT",
      docDiscountValue: 1000,
      vatMode: "NONE",
      vatRateBp: 700,
      whtRateBp: null,
    });
    expect(totals.discountSatang).toBe(3333);
    expect(totals.afterDiscountSatang).toBe(30000);
  });
});
