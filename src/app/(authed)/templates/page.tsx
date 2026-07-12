import type { Metadata } from "next";
import Link from "next/link";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "แบบฟอร์มเอกสาร",
};

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: [{ docType: "asc" }, { isBuiltIn: "desc" }, { name: "asc" }],
    include: {
      activeVersion: { select: { versionNo: true, createdAt: true } },
      _count: { select: { versions: true } },
    },
  });

  return (
    <>
      <h1>แบบฟอร์มเอกสาร</h1>
      <p className="hint">
        แบบฟอร์มเป็นโค้ด HTML + Handlebars ที่แก้ไขได้เอง การบันทึกทุกครั้งจะเก็บเป็นเวอร์ชันใหม่
        และเอกสารแต่ละฉบับจะตรึงเวอร์ชันที่ใช้พิมพ์ครั้งแรกไว้เสมอ
      </p>
      <table className="data">
        <caption>แบบฟอร์มทั้งหมด {templates.length} แบบ</caption>
        <thead>
          <tr>
            <th scope="col">ชื่อแบบฟอร์ม</th>
            <th scope="col">ประเภทเอกสาร</th>
            <th scope="col">เวอร์ชันที่ใช้งาน</th>
            <th scope="col">จำนวนเวอร์ชัน</th>
            <th scope="col">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <th scope="row">
                {t.name}
                {t.isBuiltIn ? " (ค่าเริ่มต้น แก้ไขไม่ได้)" : ""}
              </th>
              <td>{DOC_TYPE_LABELS[t.docType as DocType] ?? t.docType}</td>
              <td>{t.activeVersion ? `เวอร์ชันที่ ${t.activeVersion.versionNo}` : "—"}</td>
              <td>{t._count.versions}</td>
              <td>
                <Link href={`/templates/${t.id}/edit`}>
                  {t.isBuiltIn ? `ดูโค้ด ${t.name}` : `แก้ไข ${t.name}`}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
