"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { branchTypeSchema } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { saveUpload, UploadError } from "@/lib/uploads";

const companySchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อกิจการ"),
  address: z.string().trim().min(1, "กรุณากรอกที่อยู่"),
  taxId: z.string().trim().min(1, "กรุณากรอกเลขประจำตัวผู้เสียภาษี"),
  branchType: branchTypeSchema,
  branchCode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().pipe(z.email("อีเมลไม่ถูกต้อง"))]).optional(),
});

export interface CompanyFormState {
  errors?: Record<string, string>;
  saved?: boolean;
}

export async function updateCompany(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  await requireSession();

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    taxId: formData.get("taxId"),
    branchType: formData.get("branchType") ?? "HEAD_OFFICE",
    branchCode: formData.get("branchCode") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
  });

  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
  }

  const existing = await prisma.company.findUnique({ where: { id: 1 } });

  let logoPath: string | undefined;
  let signaturePath: string | undefined;
  try {
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      logoPath = await saveUpload(logo, "logo", existing?.logoPath);
    }
  } catch (err) {
    errors.logo = err instanceof UploadError ? err.message : "อัปโหลดโลโก้ไม่สำเร็จ";
  }
  try {
    const signature = formData.get("signature");
    if (signature instanceof File && signature.size > 0) {
      signaturePath = await saveUpload(signature, "signature", existing?.signaturePath);
    }
  } catch (err) {
    errors.signature = err instanceof UploadError ? err.message : "อัปโหลดลายเซ็นไม่สำเร็จ";
  }

  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { errors };
  }

  const data = {
    ...parsed.data,
    branchCode: parsed.data.branchType === "BRANCH" ? parsed.data.branchCode || null : null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    ...(logoPath ? { logoPath } : {}),
    ...(signaturePath ? { signaturePath } : {}),
  };

  await prisma.company.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  revalidatePath("/company");
  return { saved: true };
}
