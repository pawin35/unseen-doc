"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { branchTypeSchema } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const customerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า"),
  address: z.string().trim().min(1, "กรุณากรอกที่อยู่"),
  taxId: z.string().trim().optional(),
  branchType: branchTypeSchema,
  branchCode: z.string().trim().optional(),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().pipe(z.email("อีเมลไม่ถูกต้อง"))]).optional(),
});

export interface CustomerFormState {
  errors?: Record<string, string>;
}

function parseCustomerForm(formData: FormData) {
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    taxId: formData.get("taxId") ?? "",
    branchType: formData.get("branchType") ?? "HEAD_OFFICE",
    branchCode: formData.get("branchCode") ?? "",
    contactPerson: formData.get("contactPerson") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!errors[field]) errors[field] = issue.message;
    }
    return { errors } as const;
  }
  const d = parsed.data;
  return {
    data: {
      name: d.name,
      address: d.address,
      taxId: d.taxId || null,
      branchType: d.branchType,
      branchCode: d.branchType === "BRANCH" ? d.branchCode || null : null,
      contactPerson: d.contactPerson || null,
      phone: d.phone || null,
      email: d.email || null,
    },
  } as const;
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireSession();
  const result = parseCustomerForm(formData);
  if ("errors" in result) return { errors: result.errors };
  await prisma.customer.create({ data: result.data });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(
  id: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireSession();
  const result = parseCustomerForm(formData);
  if ("errors" in result) return { errors: result.errors };
  await prisma.customer.update({ where: { id }, data: result.data });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(id: string): Promise<void> {
  await requireSession();
  // Documents keep their snapshot; the relation is SetNull so history survives.
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}
