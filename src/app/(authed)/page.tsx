import type { Metadata } from "next";
import Link from "next/link";
import { formatDateCE } from "@/lib/dates";
import { DOC_STATUS_LABELS, DOC_STATUSES, type DocStatus } from "@/lib/domain";
import { formatSatang } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "รายการใบเสนอราคา",
};

export default async function DashboardPage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const statusParam = typeof searchParams.status === "string" ? searchParams.status : "";
  const status = (DOC_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as DocStatus)
    : undefined;

  const documents = await prisma.document.findMany({
    where: { docType: "QUOTATION", ...(status ? { status } : {}) },
    orderBy: [{ issueDate: "desc" }, { docNumber: "desc" }],
  });

  return (
    <>
      <h1>รายการใบเสนอราคา</h1>
      <div className="toolbar">
        <Link href="/quotations/new" className="button primary">
          สร้างใบเสนอราคาใหม่
        </Link>
      </div>

      <form method="get" action="/">
        <fieldset>
          <legend>กรองตามสถานะ</legend>
          <label>
            <input type="radio" name="status" value="" defaultChecked={!status} /> ทั้งหมด
          </label>
          {DOC_STATUSES.map((s) => (
            <label key={s}>
              <input type="radio" name="status" value={s} defaultChecked={status === s} />{" "}
              {DOC_STATUS_LABELS[s]}
            </label>
          ))}
          <button type="submit">กรอง</button>
        </fieldset>
      </form>

      {documents.length === 0 ? (
        <p>
          {status
            ? `ไม่มีใบเสนอราคาสถานะ${DOC_STATUS_LABELS[status]}`
            : "ยังไม่มีใบเสนอราคา"}
        </p>
      ) : (
        <table className="data">
          <caption>
            ใบเสนอราคา{status ? `สถานะ${DOC_STATUS_LABELS[status]}` : "ทั้งหมด"}{" "}
            {documents.length} ฉบับ
          </caption>
          <thead>
            <tr>
              <th scope="col">เลขที่</th>
              <th scope="col">วันที่</th>
              <th scope="col">ลูกค้า</th>
              <th scope="col" className="num">ยอดชำระ (บาท)</th>
              <th scope="col">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <th scope="row">
                  <Link href={`/quotations/${doc.id}`}>{doc.docNumber}</Link>
                </th>
                <td>{formatDateCE(doc.issueDate)}</td>
                <td>{doc.custName}</td>
                <td className="num">{formatSatang(doc.payableSatang)}</td>
                <td>{DOC_STATUS_LABELS[doc.status as DocStatus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
