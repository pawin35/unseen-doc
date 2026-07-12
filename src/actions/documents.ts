"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { bahtTextFromSatang } from "@/lib/calc/bahtText";
import { calculateDocument } from "@/lib/calc/engine";
import {
  branchTypeSchema,
  discountTypeSchema,
  docStatusSchema,
  vatModeSchema,
  type DiscountType,
  type DocStatus,
} from "@/lib/domain";
import { parseMoneyToSatang, parsePercentToBp, parseQtyToThousandths } from "@/lib/money";
import { generateDocNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export interface DocumentFormState {
  errors?: Record<string, string>;
}

interface ParsedLine {
  description: string;
  qtyThousandths: number;
  unit: string | null;
  unitPriceSatang: number;
  discountType: DiscountType;
  discountValue: number;
}

interface ParsedDocument {
  docNumber: string; // empty = auto-generate
  issueDate: Date;
  customerId: string | null;
  snapshot: {
    custName: string;
    custAddress: string;
    custTaxId: string | null;
    custBranchType: string;
    custBranchCode: string | null;
    custContactPerson: string | null;
    custPhone: string | null;
    custEmail: string | null;
  };
  custSignatoryName: string | null;
  sellerSignatoryName: string | null;
  showSignatureImage: boolean;
  vatMode: "NONE" | "EXCLUSIVE" | "INCLUSIVE";
  vatRateBp: number;
  whtRateBp: number | null;
  docDiscountType: DiscountType;
  docDiscountValue: number;
  remark: string | null;
  notes: string | null;
  templateId: string | null;
  lines: ParsedLine[];
}

function parseDiscount(
  typeRaw: FormDataEntryValue | null,
  valueRaw: FormDataEntryValue | null,
  fieldPrefix: string,
  errors: Record<string, string>,
): { type: DiscountType; value: number } {
  const typeParsed = discountTypeSchema.safeParse(typeRaw ?? "NONE");
  const type = typeParsed.success ? typeParsed.data : "NONE";
  if (type === "NONE") return { type, value: 0 };
  const raw = String(valueRaw ?? "").trim();
  const value = type === "AMOUNT" ? parseMoneyToSatang(raw) : parsePercentToBp(raw);
  if (value == null || value < 0) {
    errors[`${fieldPrefix}`] = "กรุณากรอกส่วนลดเป็นตัวเลข";
    return { type, value: 0 };
  }
  return { type, value };
}

function parseDocumentForm(formData: FormData): {
  data?: ParsedDocument;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const docNumber = String(formData.get("docNumber") ?? "").trim();

  const issueDateRaw = String(formData.get("issueDate") ?? "").trim();
  let issueDate: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(issueDateRaw)) {
    issueDate = new Date(`${issueDateRaw}T00:00:00.000Z`);
  }
  if (!issueDate || Number.isNaN(issueDate.getTime())) {
    errors.issueDate = "กรุณาเลือกวันที่เอกสาร";
  }

  const customerIdRaw = String(formData.get("customerId") ?? "").trim();
  const customerId = customerIdRaw === "" ? null : customerIdRaw;

  const custName = String(formData.get("custName") ?? "").trim();
  if (!custName) errors.custName = "กรุณากรอกชื่อลูกค้าในเอกสาร";
  const custAddress = String(formData.get("custAddress") ?? "").trim();
  if (!custAddress) errors.custAddress = "กรุณากรอกที่อยู่ลูกค้าในเอกสาร";
  const custBranchParsed = branchTypeSchema.safeParse(
    formData.get("custBranchType") ?? "HEAD_OFFICE",
  );
  const custBranchType = custBranchParsed.success ? custBranchParsed.data : "HEAD_OFFICE";

  const vatParsed = vatModeSchema.safeParse(formData.get("vatMode") ?? "NONE");
  const vatMode = vatParsed.success ? vatParsed.data : "NONE";

  let whtRateBp: number | null = null;
  const whtChoice = String(formData.get("whtChoice") ?? "NONE");
  if (whtChoice === "CUSTOM") {
    whtRateBp = parsePercentToBp(String(formData.get("whtCustom") ?? ""));
    if (whtRateBp == null || whtRateBp <= 0) {
      errors.whtCustom = "กรุณากรอกอัตราหักภาษี ณ ที่จ่ายเป็นตัวเลข";
    }
  } else if (whtChoice !== "NONE") {
    const bp = parseInt(whtChoice, 10);
    whtRateBp = Number.isInteger(bp) && bp > 0 ? bp : null;
  }

  const docDiscount = parseDiscount(
    formData.get("docDiscountType"),
    formData.get("docDiscountValue"),
    "docDiscountValue",
    errors,
  );

  // Signatory overrides: name required only when the "different signer" box is ticked.
  let custSignatoryName: string | null = null;
  if (formData.get("custSignatoryDiff") != null) {
    custSignatoryName = String(formData.get("custSignatoryName") ?? "").trim();
    if (!custSignatoryName) {
      errors.custSignatoryName = "กรุณากรอกชื่อผู้ลงนามฝั่งลูกค้า";
    }
  }
  let sellerSignatoryName: string | null = null;
  if (formData.get("sellerSignatoryDiff") != null) {
    sellerSignatoryName = String(formData.get("sellerSignatoryName") ?? "").trim();
    if (!sellerSignatoryName) {
      errors.sellerSignatoryName = "กรุณากรอกชื่อผู้ลงนามฝั่งผู้ขาย";
    }
  }
  const showSignatureImage = formData.get("showSignatureImage") != null;

  const remark = String(formData.get("remark") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Selected Template (ADR 0004). Raw id only; validated against the DB in the
  // create/update actions. Empty → resolve the built-in there.
  const templateId = String(formData.get("templateId") ?? "").trim() || null;

  // Lines: indices appear as line-<i>-description etc.
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = /^line-(\d+)-description$/.exec(key);
    if (m) indices.add(parseInt(m[1], 10));
  }
  const sorted = [...indices].sort((a, b) => a - b);
  const lines: ParsedLine[] = [];
  for (const i of sorted) {
    const description = String(formData.get(`line-${i}-description`) ?? "").trim();
    const qtyRaw = String(formData.get(`line-${i}-qty`) ?? "").trim();
    const priceRaw = String(formData.get(`line-${i}-price`) ?? "").trim();
    // Fully empty rows are ignored.
    if (!description && !qtyRaw && !priceRaw) continue;
    const rowNo = lines.length + 1;
    if (!description) {
      errors[`line-${i}-description`] = `กรุณากรอกรายละเอียดในรายการที่ ${rowNo}`;
    }
    const qtyThousandths = parseQtyToThousandths(qtyRaw);
    if (qtyThousandths == null || qtyThousandths <= 0) {
      errors[`line-${i}-qty`] = `กรุณากรอกจำนวนเป็นตัวเลขในรายการที่ ${rowNo}`;
    }
    const unitPriceSatang = parseMoneyToSatang(priceRaw);
    if (unitPriceSatang == null || unitPriceSatang < 0) {
      errors[`line-${i}-price`] = `กรุณากรอกราคาต่อหน่วยเป็นตัวเลขในรายการที่ ${rowNo}`;
    }
    const discount = parseDiscount(
      formData.get(`line-${i}-discountType`),
      formData.get(`line-${i}-discountValue`),
      `line-${i}-discountValue`,
      errors,
    );
    lines.push({
      description,
      qtyThousandths: qtyThousandths ?? 0,
      unit: String(formData.get(`line-${i}-unit`) ?? "").trim() || null,
      unitPriceSatang: unitPriceSatang ?? 0,
      discountType: discount.type,
      discountValue: discount.value,
    });
  }
  if (lines.length === 0) {
    errors["line-0-description"] = "กรุณากรอกรายการอย่างน้อย 1 รายการ";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    data: {
      docNumber,
      issueDate: issueDate as Date,
      customerId,
      snapshot: {
        custName,
        custAddress,
        custTaxId: String(formData.get("custTaxId") ?? "").trim() || null,
        custBranchType,
        custBranchCode:
          custBranchType === "BRANCH"
            ? String(formData.get("custBranchCode") ?? "").trim() || null
            : null,
        custContactPerson: String(formData.get("custContactPerson") ?? "").trim() || null,
        custPhone: String(formData.get("custPhone") ?? "").trim() || null,
        custEmail: String(formData.get("custEmail") ?? "").trim() || null,
      },
      custSignatoryName,
      sellerSignatoryName,
      showSignatureImage,
      vatMode,
      vatRateBp: 700,
      whtRateBp,
      docDiscountType: docDiscount.type,
      docDiscountValue: docDiscount.value,
      remark,
      notes,
      templateId,
      lines,
    },
  };
}

/**
 * Resolve the Selected Template id for a quotation (ADR 0004). Validates that a
 * provided id is a QUOTATION template; an empty id resolves to the built-in.
 * Returns the id, or an error string keyed to the `templateId` field.
 */
async function resolveQuotationTemplateId(
  raw: string | null,
): Promise<{ id: string } | { error: string }> {
  if (raw) {
    const t = await prisma.template.findFirst({
      where: { id: raw, docType: "QUOTATION" },
      select: { id: true },
    });
    if (!t) return { error: "ไม่พบแบบฟอร์มที่เลือก" };
    return { id: t.id };
  }
  const builtIn = await prisma.template.findFirst({
    where: { docType: "QUOTATION", isBuiltIn: true },
    select: { id: true },
  });
  if (!builtIn) return { error: "ไม่พบแบบฟอร์มค่าเริ่มต้น" };
  return { id: builtIn.id };
}

function computeTotals(data: ParsedDocument) {
  const totals = calculateDocument({
    lines: data.lines,
    docDiscountType: data.docDiscountType,
    docDiscountValue: data.docDiscountValue,
    vatMode: data.vatMode,
    vatRateBp: data.vatRateBp,
    whtRateBp: data.whtRateBp,
  });
  return {
    subtotalSatang: totals.subtotalSatang,
    discountSatang: totals.discountSatang,
    afterDiscountSatang: totals.afterDiscountSatang,
    vatSatang: totals.vatSatang,
    grandTotalSatang: totals.grandTotalSatang,
    whtSatang: totals.whtSatang,
    payableSatang: totals.payableSatang,
    bahtText: bahtTextFromSatang(totals.grandTotalSatang),
    lineTotals: totals.lineTotalsSatang,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function createQuotation(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  await requireSession();
  const { data, errors } = parseDocumentForm(formData);
  if (!data) return { errors };

  const template = await resolveQuotationTemplateId(data.templateId);
  if ("error" in template) return { errors: { templateId: template.error } };

  const totals = computeTotals(data);
  const autoNumber = data.docNumber === "";

  let createdId: string | null = null;
  for (let attempt = 0; attempt < 3 && createdId === null; attempt++) {
    const docNumber = autoNumber
      ? await generateDocNumber("QUOTATION", data.issueDate)
      : data.docNumber;
    try {
      const doc = await prisma.document.create({
        data: {
          docType: "QUOTATION",
          docNumber,
          issueDate: data.issueDate,
          status: "DRAFT",
          customerId: data.customerId,
          ...data.snapshot,
          custSignatoryName: data.custSignatoryName,
          sellerSignatoryName: data.sellerSignatoryName,
          showSignatureImage: data.showSignatureImage,
          vatMode: data.vatMode,
          vatRateBp: data.vatRateBp,
          whtRateBp: data.whtRateBp,
          docDiscountType: data.docDiscountType,
          docDiscountValue: data.docDiscountValue,
          subtotalSatang: totals.subtotalSatang,
          discountSatang: totals.discountSatang,
          afterDiscountSatang: totals.afterDiscountSatang,
          vatSatang: totals.vatSatang,
          grandTotalSatang: totals.grandTotalSatang,
          whtSatang: totals.whtSatang,
          payableSatang: totals.payableSatang,
          bahtText: totals.bahtText,
          remark: data.remark,
          notes: data.notes,
          templateId: template.id,
          lines: {
            create: data.lines.map((line, i) => ({
              sortOrder: i + 1,
              description: line.description,
              qtyThousandths: line.qtyThousandths,
              unit: line.unit,
              unitPriceSatang: line.unitPriceSatang,
              discountType: line.discountType,
              discountValue: line.discountValue,
              lineTotalSatang: totals.lineTotals[i],
            })),
          },
        },
      });
      createdId = doc.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        if (!autoNumber) {
          return { errors: { docNumber: `เลขที่เอกสาร ${docNumber} ถูกใช้แล้ว` } };
        }
        continue; // auto: counter moved on, retry
      }
      throw err;
    }
  }
  if (createdId === null) {
    return { errors: { docNumber: "ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองอีกครั้ง" } };
  }
  revalidatePath("/");
  redirect(`/quotations/${createdId}`);
}

export async function updateQuotation(
  id: string,
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  await requireSession();
  const { data, errors } = parseDocumentForm(formData);
  if (!data) return { errors };
  if (data.docNumber === "") {
    return { errors: { docNumber: "กรุณากรอกเลขที่เอกสาร" } };
  }

  const current = await prisma.document.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) return { errors: { docNumber: "ไม่พบเอกสาร" } };

  // Template can only be changed while the document is a draft (ADR 0004);
  // otherwise the pin is locked, so leave templateId untouched.
  let templateId: string | undefined;
  if (current.status === "DRAFT") {
    const template = await resolveQuotationTemplateId(data.templateId);
    if ("error" in template) return { errors: { templateId: template.error } };
    templateId = template.id;
  }

  const totals = computeTotals(data);
  try {
    await prisma.$transaction([
      prisma.documentLine.deleteMany({ where: { documentId: id } }),
      prisma.document.update({
        where: { id },
        data: {
          ...(templateId ? { templateId } : {}),
          docNumber: data.docNumber,
          issueDate: data.issueDate,
          customerId: data.customerId,
          ...data.snapshot,
          custSignatoryName: data.custSignatoryName,
          sellerSignatoryName: data.sellerSignatoryName,
          showSignatureImage: data.showSignatureImage,
          vatMode: data.vatMode,
          vatRateBp: data.vatRateBp,
          whtRateBp: data.whtRateBp,
          docDiscountType: data.docDiscountType,
          docDiscountValue: data.docDiscountValue,
          subtotalSatang: totals.subtotalSatang,
          discountSatang: totals.discountSatang,
          afterDiscountSatang: totals.afterDiscountSatang,
          vatSatang: totals.vatSatang,
          grandTotalSatang: totals.grandTotalSatang,
          whtSatang: totals.whtSatang,
          payableSatang: totals.payableSatang,
          bahtText: totals.bahtText,
          remark: data.remark,
          notes: data.notes,
          lines: {
            create: data.lines.map((line, i) => ({
              sortOrder: i + 1,
              description: line.description,
              qtyThousandths: line.qtyThousandths,
              unit: line.unit,
              unitPriceSatang: line.unitPriceSatang,
              discountType: line.discountType,
              discountValue: line.discountValue,
              lineTotalSatang: totals.lineTotals[i],
            })),
          },
        },
      }),
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { errors: { docNumber: `เลขที่เอกสาร ${data.docNumber} ถูกใช้แล้ว` } };
    }
    throw err;
  }
  revalidatePath("/");
  revalidatePath(`/quotations/${id}`);
  redirect(`/quotations/${id}`);
}

/** The built-in template's active version id for a docType (legacy-doc fallback). */
async function builtInActiveVersionId(docType: string): Promise<string | null> {
  const builtIn = await prisma.template.findFirst({
    where: { docType, isBuiltIn: true },
    select: { activeVersionId: true },
  });
  return builtIn?.activeVersionId ?? null;
}

const STATUS_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  DRAFT: ["AWAITING"],
  AWAITING: ["ACCEPTED", "REJECTED", "DRAFT"],
  ACCEPTED: ["AWAITING"],
  REJECTED: ["AWAITING"],
};

export async function setQuotationStatus(id: string, formData: FormData): Promise<void> {
  await requireSession();
  const parsed = docStatusSchema.safeParse(formData.get("status"));
  if (!parsed.success) return;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      status: true,
      docType: true,
      template: { select: { activeVersionId: true } },
    },
  });
  if (!doc) return;
  const allowed = STATUS_TRANSITIONS[doc.status as DocStatus] ?? [];
  if (!allowed.includes(parsed.data)) return;

  // Freeze the template version when the draft is issued; reopen (unfreeze) it
  // when an issued document is reverted to draft (ADR 0004).
  const pin: { templateVersionId?: string | null } = {};
  if (doc.status === "DRAFT" && parsed.data === "AWAITING") {
    pin.templateVersionId =
      doc.template?.activeVersionId ?? (await builtInActiveVersionId(doc.docType));
  } else if (parsed.data === "DRAFT") {
    pin.templateVersionId = null;
  }

  await prisma.document.update({
    where: { id },
    data: { status: parsed.data, ...pin },
  });
  revalidatePath("/");
  revalidatePath(`/quotations/${id}`);
}

export async function deleteQuotation(id: string): Promise<void> {
  await requireSession();
  await prisma.document.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}
