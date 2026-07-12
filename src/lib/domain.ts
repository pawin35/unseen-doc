// Enum-like domain values. SQLite has no enums, so these are the single source
// of truth for the String columns in prisma/schema.prisma (see CONTEXT.md).
import { z } from "zod";

export const DOC_TYPES = [
  "QUOTATION",
  "BILLING_NOTE",
  "INVOICE",
  "RECEIPT",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const docTypeSchema = z.enum(DOC_TYPES);

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  QUOTATION: "ใบเสนอราคา",
  BILLING_NOTE: "ใบวางบิล",
  INVOICE: "ใบแจ้งหนี้",
  RECEIPT: "ใบเสร็จรับเงิน",
  PURCHASE_ORDER: "ใบสั่งซื้อ",
  GOODS_RECEIPT: "ใบรับสินค้า",
};

export const DOC_STATUSES = ["DRAFT", "AWAITING", "ACCEPTED", "REJECTED"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
export const docStatusSchema = z.enum(DOC_STATUSES);

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  DRAFT: "ร่าง",
  AWAITING: "รอตอบรับ",
  ACCEPTED: "ยอมรับแล้ว",
  REJECTED: "ปฏิเสธ",
};

export const VAT_MODES = ["NONE", "EXCLUSIVE", "INCLUSIVE"] as const;
export type VatMode = (typeof VAT_MODES)[number];
export const vatModeSchema = z.enum(VAT_MODES);

export const VAT_MODE_LABELS: Record<VatMode, string> = {
  NONE: "ไม่มีภาษีมูลค่าเพิ่ม",
  EXCLUSIVE: "ราคาไม่รวมภาษีมูลค่าเพิ่ม",
  INCLUSIVE: "ราคารวมภาษีมูลค่าเพิ่ม",
};

export const DISCOUNT_TYPES = ["NONE", "AMOUNT", "PERCENT"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const discountTypeSchema = z.enum(DISCOUNT_TYPES);

export const BRANCH_TYPES = ["HEAD_OFFICE", "BRANCH"] as const;
export type BranchType = (typeof BRANCH_TYPES)[number];
export const branchTypeSchema = z.enum(BRANCH_TYPES);

export const BRANCH_TYPE_LABELS: Record<BranchType, string> = {
  HEAD_OFFICE: "สำนักงานใหญ่",
  BRANCH: "สาขา",
};

// Standard withholding-tax rates offered in the UI (basis points).
export const STANDARD_WHT_RATES_BP = [100, 150, 200, 300, 500, 1000] as const;

export function branchLabel(branchType: string, branchCode?: string | null): string {
  if (branchType === "BRANCH") {
    return branchCode ? `สาขา ${branchCode}` : "สาขา";
  }
  return "สำนักงานใหญ่";
}
