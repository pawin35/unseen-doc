import { describe, expect, it } from "vitest";
import { bahtTextFromSatang } from "./bahtText";

describe("bahtTextFromSatang", () => {
  it("matches the reference example: 100,000.00 → หนึ่งแสนบาทถ้วน", () => {
    expect(bahtTextFromSatang(10000000)).toBe("หนึ่งแสนบาทถ้วน");
  });

  it("uses ถ้วน for whole baht", () => {
    expect(bahtTextFromSatang(100)).toBe("หนึ่งบาทถ้วน");
  });

  it("speaks satang", () => {
    expect(bahtTextFromSatang(150)).toBe("หนึ่งบาทห้าสิบสตางค์");
    expect(bahtTextFromSatang(10)).toBe("สิบสตางค์");
  });

  it("uses เอ็ด for trailing one", () => {
    expect(bahtTextFromSatang(2100)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtTextFromSatang(10100)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
  });

  it("uses ยี่สิบ for twenty", () => {
    expect(bahtTextFromSatang(2000)).toBe("ยี่สิบบาทถ้วน");
  });

  it("handles millions and repeated ล้าน", () => {
    expect(bahtTextFromSatang(100000000)).toBe("หนึ่งล้านบาทถ้วน");
    expect(bahtTextFromSatang(100000000000000)).toBe("หนึ่งล้านล้านบาทถ้วน");
  });

  it("handles a mixed large amount", () => {
    // 1,234,567.89
    expect(bahtTextFromSatang(123456789)).toBe(
      "หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์",
    );
  });

  it("handles zero", () => {
    expect(bahtTextFromSatang(0)).toBe("ศูนย์บาทถ้วน");
  });

  it("rejects non-integer input", () => {
    expect(() => bahtTextFromSatang(1.5)).toThrow();
  });
});
