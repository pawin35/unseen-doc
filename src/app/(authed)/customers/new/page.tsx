import type { Metadata } from "next";
import { createCustomer } from "@/actions/customers";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = {
  title: "เพิ่มลูกค้าใหม่",
};

export default function NewCustomerPage() {
  return (
    <>
      <h1>เพิ่มลูกค้าใหม่</h1>
      <CustomerForm action={createCustomer} submitLabel="เพิ่มลูกค้า" />
    </>
  );
}
