import { z } from "zod";
import { isAuthed } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildContextFromData } from "@/lib/render/context";
import { renderTemplate, TemplateCompileError } from "@/lib/render/handlebars";
import { injectFonts } from "@/lib/render/html";

export const runtime = "nodejs";

const bodySchema = z.object({
  source: z.string().min(1),
  documentId: z.string().optional(),
});

/**
 * Renders arbitrary template source against a sample document for the
 * template editor's live preview. Returns { html } or { error, line }.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const doc = parsed.data.documentId
    ? await prisma.document.findUnique({
        where: { id: parsed.data.documentId },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      })
    : await prisma.document.findFirst({
        where: { docType: "QUOTATION" },
        orderBy: { createdAt: "asc" },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
  if (!doc) {
    return Response.json(
      { error: "ยังไม่มีเอกสารตัวอย่างสำหรับแสดงผล กรุณาสร้างใบเสนอราคาอย่างน้อย 1 ฉบับ" },
      { status: 404 },
    );
  }
  const company = await prisma.company.findUnique({ where: { id: 1 } });
  if (!company) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่าข้อมูลกิจการ" }, { status: 404 });
  }

  try {
    const context = await buildContextFromData(doc, company);
    const html = injectFonts(renderTemplate(parsed.data.source, context));
    return Response.json({ html });
  } catch (err) {
    if (err instanceof TemplateCompileError) {
      return Response.json({ error: err.message, line: err.line }, { status: 422 });
    }
    throw err;
  }
}
