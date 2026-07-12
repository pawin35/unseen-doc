import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteQuotation, setQuotationStatus } from "@/actions/documents";
import { formatDateCE } from "@/lib/dates";
import {
  branchLabel,
  DOC_STATUS_LABELS,
  type DocStatus,
} from "@/lib/domain";
import { formatBpAsPercent, formatQty, formatSatang } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "ใบเสนอราคา",
};

const NEXT_STATUS_ACTIONS: Record<DocStatus, { status: DocStatus; label: string }[]> = {
  DRAFT: [{ status: "AWAITING", label: "ออกเอกสาร (รอตอบรับ)" }],
  AWAITING: [
    { status: "ACCEPTED", label: "บันทึกว่าลูกค้ายอมรับ" },
    { status: "REJECTED", label: "บันทึกว่าลูกค้าปฏิเสธ" },
    { status: "DRAFT", label: "กลับเป็นร่าง" },
  ],
  ACCEPTED: [{ status: "AWAITING", label: "กลับเป็นรอตอบรับ" }],
  REJECTED: [{ status: "AWAITING", label: "กลับเป็นรอตอบรับ" }],
};

export default async function QuotationViewPage(props: PageProps<"/quotations/[id]">) {
  const { id } = await props.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      templateVersion: { include: { template: true } },
      template: true,
    },
  });
  if (!doc || doc.docType !== "QUOTATION") notFound();

  const company = await prisma.company.findUnique({ where: { id: 1 } });

  const statusActions = NEXT_STATUS_ACTIONS[doc.status as DocStatus] ?? [];
  const setStatusAction = setQuotationStatus.bind(null, doc.id);
  const deleteAction = deleteQuotation.bind(null, doc.id);

  return (
    <>
      <h1>
        ใบเสนอราคา {doc.docNumber}
      </h1>
      <p>
        สถานะ: <strong>{DOC_STATUS_LABELS[doc.status as DocStatus]}</strong> · วันที่{" "}
        {formatDateCE(doc.issueDate)}
      </p>

      <div className="toolbar">
        <Link href={`/quotations/${doc.id}/edit`} className="button">
          แก้ไขเอกสาร
        </Link>
        {statusActions.map(({ status, label }) => (
          <form key={status} action={setStatusAction} style={{ display: "inline" }}>
            <input type="hidden" name="status" value={status} />
            <button type="submit">{label}</button>
          </form>
        ))}
      </div>

      <section aria-labelledby="customer-heading">
        <h2 id="customer-heading">ลูกค้า</h2>
        <dl>
          <dt>ชื่อ</dt>
          <dd>{doc.custName}</dd>
          <dt>ที่อยู่</dt>
          <dd>{doc.custAddress}</dd>
          {doc.custTaxId ? (
            <>
              <dt>เลขประจำตัวผู้เสียภาษี</dt>
              <dd>
                {doc.custTaxId} ({branchLabel(doc.custBranchType, doc.custBranchCode)})
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="signing-heading">
        <h2 id="signing-heading">ผู้ลงนามท้ายเอกสาร</h2>
        <dl>
          <dt>ผู้ลงนามฝั่งลูกค้า (ผู้สั่งซื้อสินค้า)</dt>
          <dd>
            {doc.custSignatoryName ?? doc.custName}
            {doc.custSignatoryName ? " (กำหนดเอง)" : ""}
          </dd>
          <dt>ผู้ลงนามฝั่งผู้ขาย (ผู้อนุมัติ)</dt>
          <dd>
            {doc.sellerSignatoryName ?? company?.name ?? "—"}
            {doc.sellerSignatoryName ? " (กำหนดเอง)" : ""}
          </dd>
          <dt>รูปลายเซ็น</dt>
          <dd>{doc.showSignatureImage ? "แสดงรูปลายเซ็นที่บันทึกไว้" : "ไม่แสดง (เว้นว่างให้เซ็น)"}</dd>
        </dl>
      </section>

      <section aria-labelledby="lines-heading">
        <h2 id="lines-heading">รายการ</h2>
        <table className="data">
          <caption className="visually-hidden">
            รายการในเอกสาร ทั้งหมด {doc.lines.length} รายการ
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">รายละเอียด</th>
              <th scope="col" className="num">จำนวน</th>
              <th scope="col" className="num">ราคาต่อหน่วย</th>
              <th scope="col" className="num">ส่วนลด</th>
              <th scope="col" className="num">มูลค่า</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.sortOrder}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{line.description}</td>
                <td className="num">
                  {formatQty(line.qtyThousandths)}
                  {line.unit ? ` ${line.unit}` : ""}
                </td>
                <td className="num">{formatSatang(line.unitPriceSatang)}</td>
                <td className="num">
                  {line.discountType === "NONE"
                    ? "—"
                    : line.discountType === "PERCENT"
                      ? `${formatBpAsPercent(line.discountValue)}%`
                      : formatSatang(line.discountValue)}
                </td>
                <td className="num">{formatSatang(line.lineTotalSatang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading">สรุปยอด</h2>
        <table className="data" style={{ maxWidth: "28rem" }}>
          <tbody>
            <tr>
              <th scope="row">รวมเป็นเงิน</th>
              <td className="num">{formatSatang(doc.subtotalSatang)} บาท</td>
            </tr>
            {doc.discountSatang !== 0 ? (
              <>
                <tr>
                  <th scope="row">ส่วนลด</th>
                  <td className="num">{formatSatang(doc.discountSatang)} บาท</td>
                </tr>
                <tr>
                  <th scope="row">มูลค่าหลังหักส่วนลด</th>
                  <td className="num">{formatSatang(doc.afterDiscountSatang)} บาท</td>
                </tr>
              </>
            ) : null}
            {doc.vatMode !== "NONE" ? (
              <tr>
                <th scope="row">ภาษีมูลค่าเพิ่ม {formatBpAsPercent(doc.vatRateBp)}%</th>
                <td className="num">{formatSatang(doc.vatSatang)} บาท</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">จำนวนเงินรวมทั้งสิ้น</th>
              <td className="num">{formatSatang(doc.grandTotalSatang)} บาท</td>
            </tr>
            {doc.whtRateBp != null ? (
              <>
                <tr>
                  <th scope="row">หักภาษี ณ ที่จ่าย {formatBpAsPercent(doc.whtRateBp)}%</th>
                  <td className="num">{formatSatang(doc.whtSatang)} บาท</td>
                </tr>
                <tr>
                  <th scope="row">ยอดชำระ</th>
                  <td className="num">{formatSatang(doc.payableSatang)} บาท</td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
        <p>({doc.bahtText})</p>
      </section>

      <section aria-labelledby="print-heading">
        <h2 id="print-heading">พิมพ์เอกสาร</h2>
        {doc.templateVersion ? (
          <p>
            เอกสารนี้ตรึงกับแบบฟอร์ม “{doc.templateVersion.template.name}” เวอร์ชันที่{" "}
            {doc.templateVersion.versionNo}
          </p>
        ) : doc.template ? (
          <p>
            เอกสารร่างนี้ใช้แบบฟอร์ม “{doc.template.name}” เวอร์ชันล่าสุด —
            จะตรึงเวอร์ชันไว้เมื่อออกเอกสาร
          </p>
        ) : (
          <p>เอกสารนี้ใช้แบบฟอร์มค่าเริ่มต้นเวอร์ชันล่าสุด</p>
        )}
        <div className="toolbar">
          <a className="button primary" href={`/api/documents/${doc.id}/pdf`}>
            ดาวน์โหลด PDF
          </a>
        </div>
        <h3>ตัวอย่างเอกสาร</h3>
        <iframe
          title={`ตัวอย่างเอกสาร ใบเสนอราคา ${doc.docNumber}`}
          src={`/api/documents/${doc.id}/preview`}
          style={{ width: "100%", height: "40rem", border: "1px solid var(--color-border)" }}
        />
      </section>

      <section aria-labelledby="delete-heading" style={{ marginTop: "2rem" }}>
        <h2 id="delete-heading">ลบเอกสาร</h2>
        <form action={deleteAction}>
          <p className="hint">การลบไม่สามารถย้อนกลับได้ และเลขที่เอกสารนี้จะว่างลง</p>
          <button type="submit">ลบใบเสนอราคา {doc.docNumber}</button>
        </form>
      </section>
    </>
  );
}
