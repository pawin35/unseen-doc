import type { Metadata } from "next";
import Link from "next/link";
import { branchLabel } from "@/lib/domain";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "ลูกค้า",
};

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <h1>ลูกค้า</h1>
      <div className="toolbar">
        <Link href="/customers/new" className="button primary">
          เพิ่มลูกค้าใหม่
        </Link>
      </div>
      {customers.length === 0 ? (
        <p>ยังไม่มีลูกค้าในระบบ</p>
      ) : (
        <table className="data">
          <caption>รายชื่อลูกค้าทั้งหมด {customers.length} ราย</caption>
          <thead>
            <tr>
              <th scope="col">ชื่อ</th>
              <th scope="col">เลขประจำตัวผู้เสียภาษี</th>
              <th scope="col">สำนักงาน</th>
              <th scope="col">โทรศัพท์</th>
              <th scope="col">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.name}</th>
                <td>{c.taxId ?? "—"}</td>
                <td>{branchLabel(c.branchType, c.branchCode)}</td>
                <td>{c.phone ?? "—"}</td>
                <td>
                  <Link href={`/customers/${c.id}/edit`}>แก้ไข {c.name}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
