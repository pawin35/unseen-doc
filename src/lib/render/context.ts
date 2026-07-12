import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatDateCE, formatDateThaiLong } from "@/lib/dates";
import {
  branchLabel,
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  type DocStatus,
  type DocType,
} from "@/lib/domain";
import { formatBpAsPercent, formatQty, formatSatang } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/uploads";

/** The data contract exposed to Handlebars templates. */
export interface RenderContext {
  doc: {
    typeLabel: string;
    number: string;
    date: string;
    dateThaiLong: string;
    statusLabel: string;
    /** หมายเหตุ printed on the document. Internal notes are never exposed here. */
    remark?: string;
  };
  company: {
    name: string;
    address: string;
    taxId: string;
    branchLabel: string;
    phone?: string;
    email?: string;
    logoDataUri?: string;
    signatureDataUri?: string;
  };
  customer: {
    name: string;
    address: string;
    taxId?: string;
    branchLabel?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };
  lines: Array<{
    no: number;
    description: string;
    qty: string;
    unit?: string;
    unitPrice: string;
    discount: string;
    amount: string;
  }>;
  totals: {
    subtotal: string;
    discount?: string;
    afterDiscount?: string;
    vatLabel?: string;
    vat?: string;
    grandTotal: string;
    whtLabel?: string;
    wht?: string;
    payable?: string;
    bahtText: string;
    show: { discount: boolean; vat: boolean; wht: boolean };
  };
  signing: {
    /** Name printed after ในนาม on the customer side (ผู้สั่งซื้อสินค้า). */
    customerName: string;
    /** Name printed after ในนาม on the seller side (ผู้อนุมัติ). */
    sellerName: string;
    /** Whether to print the stored signature image in the seller block. */
    showSignatureImage: boolean;
  };
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function uploadAsDataUri(relative: string | null): Promise<string | undefined> {
  if (!relative) return undefined;
  try {
    const filePath = resolveUploadPath(relative);
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()];
    if (!mime) return undefined;
    const data = await readFile(filePath);
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export class RenderInputError extends Error {}

export interface PreparedRender {
  source: string;
  context: RenderContext;
  cacheKey?: string;
  docNumber: string;
}

/**
 * Load everything needed to render a document. Template version resolution
 * (ADR 0004) tries, in order:
 *   1. templateVersion — the frozen pin written at issue (byte-identical
 *      reprint of an issued business record).
 *   2. template.activeVersion — the Selected Template's latest version, used
 *      while the document is a draft (no frozen pin yet).
 *   3. the built-in template's active version — legacy docs + safety fallback.
 */
export async function buildRenderContext(
  documentId: string,
): Promise<PreparedRender> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      templateVersion: true,
      template: { include: { activeVersion: true } },
    },
  });
  if (!doc) throw new RenderInputError("ไม่พบเอกสาร");

  const company = await prisma.company.findUnique({ where: { id: 1 } });
  if (!company) throw new RenderInputError("ยังไม่ได้ตั้งค่าข้อมูลกิจการ");

  let sourceVersion: { id: string; source: string } | null =
    doc.templateVersion ?? doc.template?.activeVersion ?? null;

  if (!sourceVersion) {
    const builtIn = await prisma.template.findFirst({
      where: { docType: doc.docType, isBuiltIn: true },
      include: { activeVersion: true },
    });
    if (!builtIn?.activeVersion) {
      throw new RenderInputError("ไม่พบแบบฟอร์มค่าเริ่มต้น");
    }
    sourceVersion = builtIn.activeVersion;
  }

  const context = await buildContextFromData(doc, company);
  return {
    source: sourceVersion.source,
    context,
    cacheKey: sourceVersion.id,
    docNumber: doc.docNumber,
  };
}

interface DocLineRow {
  description: string;
  qtyThousandths: number;
  unit: string | null;
  unitPriceSatang: number;
  discountType: string;
  discountValue: number;
  lineTotalSatang: number;
}

interface DocRow {
  docType: string;
  docNumber: string;
  issueDate: Date;
  status: string;
  remark: string | null;
  custName: string;
  custAddress: string;
  custTaxId: string | null;
  custBranchType: string;
  custBranchCode: string | null;
  custContactPerson: string | null;
  custPhone: string | null;
  custEmail: string | null;
  custSignatoryName: string | null;
  sellerSignatoryName: string | null;
  showSignatureImage: boolean;
  vatMode: string;
  vatRateBp: number;
  whtRateBp: number | null;
  subtotalSatang: number;
  discountSatang: number;
  afterDiscountSatang: number;
  vatSatang: number;
  grandTotalSatang: number;
  whtSatang: number;
  payableSatang: number;
  bahtText: string;
  lines: DocLineRow[];
}

interface CompanyRow {
  name: string;
  address: string;
  taxId: string;
  branchType: string;
  branchCode: string | null;
  phone: string | null;
  email: string | null;
  logoPath: string | null;
  signaturePath: string | null;
}

export async function buildContextFromData(
  doc: DocRow,
  company: CompanyRow,
): Promise<RenderContext> {
  return buildContextInner(doc, company);
}

async function buildContextInner(
  doc: DocRow,
  company: CompanyRow,
): Promise<RenderContext> {
  const [logoDataUri, signatureDataUri] = await Promise.all([
    uploadAsDataUri(company.logoPath),
    uploadAsDataUri(company.signaturePath),
  ]);

  return {
    doc: {
      typeLabel: DOC_TYPE_LABELS[doc.docType as DocType] ?? doc.docType,
      number: doc.docNumber,
      date: formatDateCE(doc.issueDate),
      dateThaiLong: formatDateThaiLong(doc.issueDate),
      statusLabel: DOC_STATUS_LABELS[doc.status as DocStatus] ?? doc.status,
      remark: doc.remark ?? undefined,
    },
    company: {
      name: company.name,
      address: company.address,
      taxId: company.taxId,
      branchLabel: branchLabel(company.branchType, company.branchCode),
      phone: company.phone ?? undefined,
      email: company.email ?? undefined,
      logoDataUri,
      signatureDataUri,
    },
    customer: {
      name: doc.custName,
      address: doc.custAddress,
      taxId: doc.custTaxId ?? undefined,
      branchLabel: doc.custTaxId
        ? branchLabel(doc.custBranchType, doc.custBranchCode)
        : undefined,
      contactPerson: doc.custContactPerson ?? undefined,
      phone: doc.custPhone ?? undefined,
      email: doc.custEmail ?? undefined,
    },
    lines: doc.lines.map((line, i) => ({
      no: i + 1,
      description: line.description,
      qty: formatQty(line.qtyThousandths),
      unit: line.unit ?? undefined,
      unitPrice: formatSatang(line.unitPriceSatang),
      discount:
        line.discountType === "NONE"
          ? ""
          : line.discountType === "PERCENT"
            ? `${formatBpAsPercent(line.discountValue)}%`
            : formatSatang(line.discountValue),
      amount: formatSatang(line.lineTotalSatang),
    })),
    totals: {
      subtotal: formatSatang(doc.subtotalSatang),
      discount: doc.discountSatang !== 0 ? formatSatang(doc.discountSatang) : undefined,
      afterDiscount:
        doc.discountSatang !== 0 ? formatSatang(doc.afterDiscountSatang) : undefined,
      vatLabel:
        doc.vatMode !== "NONE"
          ? `ภาษีมูลค่าเพิ่ม ${formatBpAsPercent(doc.vatRateBp)}%`
          : undefined,
      vat: doc.vatMode !== "NONE" ? formatSatang(doc.vatSatang) : undefined,
      grandTotal: formatSatang(doc.grandTotalSatang),
      whtLabel:
        doc.whtRateBp != null
          ? `หักภาษี ณ ที่จ่าย ${formatBpAsPercent(doc.whtRateBp)}%`
          : undefined,
      wht: doc.whtRateBp != null ? formatSatang(doc.whtSatang) : undefined,
      payable: doc.whtRateBp != null ? formatSatang(doc.payableSatang) : undefined,
      bahtText: doc.bahtText,
      show: {
        discount: doc.discountSatang !== 0,
        vat: doc.vatMode !== "NONE",
        wht: doc.whtRateBp != null,
      },
    },
    signing: {
      customerName: doc.custSignatoryName ?? doc.custName,
      sellerName: doc.sellerSignatoryName ?? company.name,
      showSignatureImage: doc.showSignatureImage,
    },
  };
}
