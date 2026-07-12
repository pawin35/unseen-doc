import { describe, expect, it } from "vitest";
import {
  formatBpAsPercent,
  formatQty,
  formatSatang,
  parseMoneyToSatang,
  parsePercentToBp,
  parseQtyToThousandths,
} from "./money";

describe("parseMoneyToSatang", () => {
  it("parses plain and comma-grouped amounts", () => {
    expect(parseMoneyToSatang("100000")).toBe(10000000);
    expect(parseMoneyToSatang("1,234.56")).toBe(123456);
    expect(parseMoneyToSatang("0.5")).toBe(50);
  });
  it("rejects garbage", () => {
    expect(parseMoneyToSatang("abc")).toBeNull();
    expect(parseMoneyToSatang("1.234")).toBeNull();
    expect(parseMoneyToSatang("")).toBeNull();
  });
});

describe("parseQtyToThousandths", () => {
  it("parses integers and fractions", () => {
    expect(parseQtyToThousandths("1")).toBe(1000);
    expect(parseQtyToThousandths("1.5")).toBe(1500);
    expect(parseQtyToThousandths("0.125")).toBe(125);
  });
  it("rejects negatives and garbage", () => {
    expect(parseQtyToThousandths("-1")).toBeNull();
    expect(parseQtyToThousandths("1.2345")).toBeNull();
  });
});

describe("parsePercentToBp", () => {
  it("parses whole and fractional percent", () => {
    expect(parsePercentToBp("7")).toBe(700);
    expect(parsePercentToBp("1.5")).toBe(150);
  });
});

describe("formatting", () => {
  it("formatSatang groups thousands with 2 dp", () => {
    expect(formatSatang(10000000)).toBe("100,000.00");
    expect(formatSatang(123456)).toBe("1,234.56");
    expect(formatSatang(0)).toBe("0.00");
  });
  it("formatQty trims trailing zeros", () => {
    expect(formatQty(1000)).toBe("1");
    expect(formatQty(1500)).toBe("1.5");
    expect(formatQty(125)).toBe("0.125");
  });
  it("formatBpAsPercent trims trailing zeros", () => {
    expect(formatBpAsPercent(700)).toBe("7");
    expect(formatBpAsPercent(150)).toBe("1.5");
  });
});
