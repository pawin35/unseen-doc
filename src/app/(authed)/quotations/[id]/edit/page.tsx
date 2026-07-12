import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateQuotation } from "@/actions/documents";
import { formatBpAsPercent, formatQty, formatSatang } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  QuotationForm,
  type CustomerOption,
  type TemplateOption,
} from "../../quotation-form";
import type { DiscountType, VatMode } from "@/lib/domain";

export const metadata: Metadata = {
  title: "แก้ไขใบเสนอราคา",
};

function discountValueString(type: string, value: number): string {
  if (type === "AMOUNT") return formatSatang(value).replace(/,/g, "");
  if (type === "PERCENT") return formatBpAsPercent(value);
  return "";
}

export default async function EditQuotationPage(props: PageProps<"/quotations/[id]/edit">) {
  const { id } = await props.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!doc || doc.docType !== "QUOTATION") notFound();

  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const options: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    taxId: c.taxId ?? "",
    branchType: c.branchType,
    branchCode: c.branchCode ?? "",
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
  }));

  const templates: TemplateOption[] = await prisma.template.findMany({
    where: { docType: "QUOTATION" },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isBuiltIn: true },
  });
  const templateId =
    doc.templateId ?? templates.find((t) => t.isBuiltIn)?.id ?? templates[0]?.id ?? "";

  const whtChoice =
    doc.whtRateBp == null
      ? "NONE"
      : [100, 150, 200, 300, 500, 1000].includes(doc.whtRateBp)
        ? String(doc.whtRateBp)
        : "CUSTOM";

  return (
    <>
      <h1>
        แก้ไขใบเสนอราคา {doc.docNumber}
      </h1>
      <QuotationForm
        action={updateQuotation.bind(null, doc.id)}
        customers={options}
        templates={templates}
        templateLocked={doc.status !== "DRAFT"}
        submitLabel="บันทึกการแก้ไข"
        initial={{
          docNumber: doc.docNumber,
          issueDate: doc.issueDate.toISOString().slice(0, 10),
          customerId: doc.customerId ?? "",
          custName: doc.custName,
          custAddress: doc.custAddress,
          custTaxId: doc.custTaxId ?? "",
          custBranchType: doc.custBranchType,
          custBranchCode: doc.custBranchCode ?? "",
          custContactPerson: doc.custContactPerson ?? "",
          custPhone: doc.custPhone ?? "",
          custEmail: doc.custEmail ?? "",
          custSignatoryDiff: doc.custSignatoryName != null,
          custSignatoryName: doc.custSignatoryName ?? "",
          sellerSignatoryDiff: doc.sellerSignatoryName != null,
          sellerSignatoryName: doc.sellerSignatoryName ?? "",
          showSignatureImage: doc.showSignatureImage,
          vatMode: doc.vatMode as VatMode,
          whtChoice,
          whtCustom: whtChoice === "CUSTOM" ? formatBpAsPercent(doc.whtRateBp ?? 0) : "",
          docDiscountType: doc.docDiscountType as DiscountType,
          docDiscountValue: discountValueString(doc.docDiscountType, doc.docDiscountValue),
          remark: doc.remark ?? "",
          notes: doc.notes ?? "",
          templateId,
          lines: doc.lines.map((line) => ({
            description: line.description,
            qty: formatQty(line.qtyThousandths).replace(/,/g, ""),
            unit: line.unit ?? "",
            price: formatSatang(line.unitPriceSatang).replace(/,/g, ""),
            discountType: line.discountType as DiscountType,
            discountValue: discountValueString(line.discountType, line.discountValue),
          })),
        }}
      />
    </>
  );
}
