"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderTemplate, TemplateCompileError } from "@/lib/render/handlebars";
import { requireSession } from "@/lib/session";

export interface TemplateFormState {
  errors?: Record<string, string>;
  saved?: boolean;
}

function validateSource(source: string): string | null {
  if (!source.trim()) return "กรุณากรอกโค้ดแบบฟอร์ม";
  try {
    renderTemplate(source, {});
    return null;
  } catch (err) {
    if (err instanceof TemplateCompileError) {
      return err.line != null
        ? `โค้ดแบบฟอร์มมีข้อผิดพลาดใกล้บรรทัดที่ ${err.line}: ${err.message}`
        : `โค้ดแบบฟอร์มมีข้อผิดพลาด: ${err.message}`;
    }
    throw err;
  }
}

async function appendVersion(templateId: string, source: string): Promise<void> {
  const last = await prisma.templateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNo: "desc" },
    select: { versionNo: true },
  });
  const version = await prisma.templateVersion.create({
    data: { templateId, versionNo: (last?.versionNo ?? 0) + 1, source },
  });
  await prisma.template.update({
    where: { id: templateId },
    data: { activeVersionId: version.id },
  });
}

/** Save over an existing (non-built-in) template: new immutable version, set active. */
export async function saveTemplateVersion(
  templateId: string,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireSession();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return { errors: { source: "ไม่พบแบบฟอร์ม" } };
  if (template.isBuiltIn) {
    return { errors: { source: "แบบฟอร์มค่าเริ่มต้นแก้ไขไม่ได้ ใช้ “บันทึกเป็นแบบฟอร์มใหม่” แทน" } };
  }
  const source = String(formData.get("source") ?? "");
  const sourceError = validateSource(source);
  if (sourceError) return { errors: { source: sourceError } };

  await appendVersion(templateId, source);
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}/edit`);
  return { saved: true };
}

/** Save the current editor source as a brand-new named template. */
export async function saveAsNewTemplate(
  docType: string,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { errors: { name: "กรุณาตั้งชื่อแบบฟอร์ม" } };
  const source = String(formData.get("source") ?? "");
  const sourceError = validateSource(source);
  if (sourceError) return { errors: { source: sourceError } };

  const existing = await prisma.template.findUnique({
    where: { docType_name: { docType, name } },
  });
  if (existing) return { errors: { name: `มีแบบฟอร์มชื่อ “${name}” อยู่แล้ว` } };

  const template = await prisma.template.create({ data: { docType, name } });
  await appendVersion(template.id, source);
  revalidatePath("/templates");
  redirect(`/templates/${template.id}/edit`);
}

/** Restore the built-in template from the repo file (new version, ADR 0003). */
export async function restoreDefaultTemplate(templateId: string): Promise<void> {
  await requireSession();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template?.isBuiltIn) return;
  const file = path.resolve(process.cwd(), "src", "templates", "quotation-default.hbs");
  const source = await readFile(file, "utf8");
  await appendVersion(templateId, source);
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}/edit`);
}

/**
 * Delete a non-built-in template unless a document relies on it — either by
 * pinning one of its versions (issued docs) or selecting it (draft docs).
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await requireSession();
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || template.isBuiltIn) return;
  const usedCount = await prisma.document.count({
    where: { OR: [{ templateVersion: { templateId } }, { templateId }] },
  });
  if (usedCount > 0) return; // documents rely on it; keep history intact
  // Clear the self-referencing active pointer before cascading versions away.
  await prisma.template.update({
    where: { id: templateId },
    data: { activeVersionId: null },
  });
  await prisma.template.delete({ where: { id: templateId } });
  revalidatePath("/templates");
  redirect("/templates");
}
