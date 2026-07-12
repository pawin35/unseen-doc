import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = {
  title: "ข้อมูลกิจการ",
};

export default async function CompanyPage() {
  const company = await prisma.company.findUnique({ where: { id: 1 } });
  return (
    <>
      <h1>ข้อมูลกิจการ</h1>
      <p className="hint">
        ข้อมูลชุดนี้จะปรากฏเป็นผู้ออกเอกสารในใบเสนอราคาและเอกสารอื่นทุกฉบับ
      </p>
      <CompanyForm
        company={
          company
            ? {
                name: company.name,
                address: company.address,
                taxId: company.taxId,
                branchType: company.branchType,
                branchCode: company.branchCode ?? "",
                phone: company.phone ?? "",
                email: company.email ?? "",
                logoPath: company.logoPath,
                signaturePath: company.signaturePath,
              }
            : null
        }
      />
    </>
  );
}
