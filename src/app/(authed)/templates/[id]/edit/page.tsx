import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restoreDefaultTemplate, deleteTemplate } from "@/actions/templates";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = {
  title: "แก้ไขแบบฟอร์ม",
};

export default async function TemplateEditPage(props: PageProps<"/templates/[id]/edit">) {
  const { id } = await props.params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: { activeVersion: true },
  });
  if (!template || !template.activeVersion) notFound();

  const pinnedCount = await prisma.document.count({
    where: { templateVersion: { templateId: id } },
  });

  const restoreAction = restoreDefaultTemplate.bind(null, id);
  const deleteAction = deleteTemplate.bind(null, id);

  return (
    <>
      <h1>
        {template.isBuiltIn ? "แบบฟอร์มค่าเริ่มต้น" : "แก้ไขแบบฟอร์ม"}: {template.name} (
        {DOC_TYPE_LABELS[template.docType as DocType] ?? template.docType})
      </h1>
      <p className="hint">
        เวอร์ชันที่ใช้งานปัจจุบัน: เวอร์ชันที่ {template.activeVersion.versionNo}
        {template.isBuiltIn
          ? " — แบบฟอร์มนี้แก้ไขไม่ได้ แต่คัดลอกไปบันทึกเป็นแบบฟอร์มใหม่ได้"
          : ""}
      </p>

      <TemplateEditor
        templateId={template.id}
        docType={template.docType}
        isBuiltIn={template.isBuiltIn}
        initialSource={template.activeVersion.source}
      />

      {template.isBuiltIn ? (
        <form action={restoreAction} style={{ marginTop: "1.5rem" }}>
          <p className="hint">
            คืนค่าเริ่มต้นจะสร้างเวอร์ชันใหม่จากไฟล์ต้นฉบับของระบบ เอกสารที่ตรึงเวอร์ชันเก่าไว้ไม่ได้รับผลกระทบ
          </p>
          <button type="submit">คืนค่าเริ่มต้นจากไฟล์ต้นฉบับ</button>
        </form>
      ) : (
        <form action={deleteAction} style={{ marginTop: "1.5rem" }}>
          {pinnedCount > 0 ? (
            <p className="hint">
              ลบไม่ได้: มีเอกสาร {pinnedCount} ฉบับตรึงเวอร์ชันของแบบฟอร์มนี้ไว้
            </p>
          ) : (
            <button type="submit">ลบแบบฟอร์ม {template.name}</button>
          )}
        </form>
      )}
    </>
  );
}
