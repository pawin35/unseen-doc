"use client";

import { useActionState, useState } from "react";
import type { CustomerFormState } from "@/actions/customers";
import { ErrorSummary } from "@/components/error-summary";

export interface CustomerValues {
  name: string;
  address: string;
  taxId: string;
  branchType: string;
  branchCode: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: CustomerValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(action, {});
  const [branchType, setBranchType] = useState(customer?.branchType ?? "HEAD_OFFICE");
  const errors = state.errors ?? {};

  return (
    <form action={formAction}>
      <ErrorSummary errors={errors} />

      <div className="field">
        <label htmlFor="name">ชื่อลูกค้า</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          size={60}
          defaultValue={customer?.name ?? ""}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name ? (
          <p id="name-error" className="field-error">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="address">ที่อยู่</label>
        <textarea
          id="address"
          name="address"
          rows={3}
          required
          defaultValue={customer?.address ?? ""}
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={errors.address ? "address-error" : undefined}
        />
        {errors.address ? (
          <p id="address-error" className="field-error">
            {errors.address}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี (ถ้ามี)</label>
        <input
          id="taxId"
          name="taxId"
          type="text"
          inputMode="numeric"
          size={20}
          defaultValue={customer?.taxId ?? ""}
        />
      </div>

      <fieldset>
        <legend>สำนักงาน</legend>
        <label>
          <input
            type="radio"
            name="branchType"
            value="HEAD_OFFICE"
            checked={branchType === "HEAD_OFFICE"}
            onChange={() => setBranchType("HEAD_OFFICE")}
          />{" "}
          สำนักงานใหญ่
        </label>
        <label>
          <input
            type="radio"
            name="branchType"
            value="BRANCH"
            checked={branchType === "BRANCH"}
            onChange={() => setBranchType("BRANCH")}
          />{" "}
          สาขา
        </label>
        {branchType === "BRANCH" ? (
          <div className="field">
            <label htmlFor="branchCode">รหัสสาขา</label>
            <input
              id="branchCode"
              name="branchCode"
              type="text"
              inputMode="numeric"
              size={10}
              defaultValue={customer?.branchCode ?? ""}
            />
          </div>
        ) : null}
      </fieldset>

      <div className="field">
        <label htmlFor="contactPerson">ผู้ติดต่อ</label>
        <input
          id="contactPerson"
          name="contactPerson"
          type="text"
          size={40}
          defaultValue={customer?.contactPerson ?? ""}
        />
      </div>

      <div className="field">
        <label htmlFor="phone">โทรศัพท์</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          size={20}
          defaultValue={customer?.phone ?? ""}
        />
      </div>

      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input
          id="email"
          name="email"
          type="email"
          size={40}
          defaultValue={customer?.email ?? ""}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email ? (
          <p id="email-error" className="field-error">
            {errors.email}
          </p>
        ) : null}
      </div>

      <button type="submit" className="primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : submitLabel}
      </button>
    </form>
  );
}
