import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteCustomer, updateCustomer } from "@/actions/customers";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = {
  title: "แก้ไขลูกค้า",
};

export default async function EditCustomerPage(props: PageProps<"/customers/[id]/edit">) {
  const { id } = await props.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const updateAction = updateCustomer.bind(null, id);
  const deleteAction = deleteCustomer.bind(null, id);

  return (
    <>
      <h1>แก้ไขลูกค้า: {customer.name}</h1>
      <CustomerForm
        action={updateAction}
        submitLabel="บันทึกการแก้ไข"
        customer={{
          name: customer.name,
          address: customer.address,
          taxId: customer.taxId ?? "",
          branchType: customer.branchType,
          branchCode: customer.branchCode ?? "",
          contactPerson: customer.contactPerson ?? "",
          phone: customer.phone ?? "",
          email: customer.email ?? "",
        }}
      />
      <form action={deleteAction} style={{ marginTop: "2rem" }}>
        <p className="hint">
          การลบลูกค้าไม่กระทบเอกสารเดิม — เอกสารเก็บสำเนาข้อมูลลูกค้าไว้ในตัวแล้ว
        </p>
        <button type="submit">ลบลูกค้า {customer.name}</button>
      </form>
    </>
  );
}
