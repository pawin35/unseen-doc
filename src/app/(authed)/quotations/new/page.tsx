import type { Metadata } from "next";
import { createQuotation } from "@/actions/documents";
import { bangkokDateParts } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import {
  QuotationForm,
  type CustomerOption,
  type TemplateOption,
} from "../quotation-form";

export const metadata: Metadata = {
  title: "สร้างใบเสนอราคา",
};

export default async function NewQuotationPage() {
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
  const defaultTemplateId = templates.find((t) => t.isBuiltIn)?.id ?? templates[0]?.id ?? "";

  const { yyyy, mm, dd } = bangkokDateParts(new Date());

  return (
    <>
      <h1>สร้างใบเสนอราคา</h1>
      <QuotationForm
        action={createQuotation}
        customers={options}
        templates={templates}
        submitLabel="บันทึกใบเสนอราคา"
        initial={{
          docNumber: "",
          issueDate: `${yyyy}-${mm}-${dd}`,
          customerId: "",
          custName: "",
          custAddress: "",
          custTaxId: "",
          custBranchType: "HEAD_OFFICE",
          custBranchCode: "",
          custContactPerson: "",
          custPhone: "",
          custEmail: "",
          custSignatoryDiff: false,
          custSignatoryName: "",
          sellerSignatoryDiff: false,
          sellerSignatoryName: "",
          showSignatureImage: true,
          vatMode: "NONE",
          whtChoice: "NONE",
          whtCustom: "",
          docDiscountType: "NONE",
          docDiscountValue: "",
          remark: "",
          notes: "",
          templateId: defaultTemplateId,
          lines: [],
        }}
      />
    </>
  );
}
