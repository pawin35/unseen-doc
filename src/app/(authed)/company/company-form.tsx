"use client";

import { useActionState, useState } from "react";
import { updateCompany, type CompanyFormState } from "@/actions/company";
import { ErrorSummary } from "@/components/error-summary";

interface CompanyValues {
  name: string;
  address: string;
  taxId: string;
  branchType: string;
  branchCode: string;
  phone: string;
  email: string;
  logoPath: string | null;
  signaturePath: string | null;
}

export function CompanyForm({ company }: { company: CompanyValues | null }) {
  const [state, formAction, pending] = useActionState<CompanyFormState, FormData>(
    updateCompany,
    {},
  );
  const [branchType, setBranchType] = useState(company?.branchType ?? "HEAD_OFFICE");
  const errors = state.errors ?? {};

  return (
    <form action={formAction}>
      <ErrorSummary errors={errors} />
      {state.saved ? (
        <p role="status" className="hint">
          บันทึกข้อมูลกิจการแล้ว
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="name">ชื่อกิจการ</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={company?.name ?? ""}
          size={60}
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
          defaultValue={company?.address ?? ""}
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
        <label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</label>
        <input
          id="taxId"
          name="taxId"
          type="text"
          inputMode="numeric"
          required
          defaultValue={company?.taxId ?? ""}
          size={20}
          aria-invalid={errors.taxId ? true : undefined}
          aria-describedby={errors.taxId ? "taxId-error" : undefined}
        />
        {errors.taxId ? (
          <p id="taxId-error" className="field-error">
            {errors.taxId}
          </p>
        ) : null}
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
              defaultValue={company?.branchCode ?? ""}
              size={10}
            />
          </div>
        ) : null}
      </fieldset>

      <div className="field">
        <label htmlFor="phone">โทรศัพท์</label>
        <input id="phone" name="phone" type="tel" defaultValue={company?.phone ?? ""} size={20} />
      </div>

      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={company?.email ?? ""}
          size={40}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email ? (
          <p id="email-error" className="field-error">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="logo">โลโก้ (PNG หรือ JPEG ไม่เกิน 2 MB)</label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          aria-invalid={errors.logo ? true : undefined}
          aria-describedby={`logo-current${errors.logo ? " logo-error" : ""}`}
        />
        <p id="logo-current" className="hint">
          {company?.logoPath ? `โลโก้ปัจจุบัน: ${company.logoPath}` : "ยังไม่มีโลโก้"}
        </p>
        {company?.logoPath ? (
          <img
            src={`/api/uploads/${company.logoPath}`}
            alt="ตัวอย่างโลโก้ปัจจุบัน"
            style={{ maxHeight: "6rem" }}
          />
        ) : null}
        {errors.logo ? (
          <p id="logo-error" className="field-error">
            {errors.logo}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="signature">ลายเซ็นผู้อนุมัติ (PNG หรือ JPEG ไม่เกิน 2 MB)</label>
        <input
          id="signature"
          name="signature"
          type="file"
          accept="image/png,image/jpeg"
          aria-invalid={errors.signature ? true : undefined}
          aria-describedby={`signature-current${errors.signature ? " signature-error" : ""}`}
        />
        <p id="signature-current" className="hint">
          {company?.signaturePath
            ? `ลายเซ็นปัจจุบัน: ${company.signaturePath}`
            : "ยังไม่มีลายเซ็น"}
        </p>
        {company?.signaturePath ? (
          <img
            src={`/api/uploads/${company.signaturePath}`}
            alt="ตัวอย่างลายเซ็นปัจจุบัน"
            style={{ maxHeight: "4rem" }}
          />
        ) : null}
        {errors.signature ? (
          <p id="signature-error" className="field-error">
            {errors.signature}
          </p>
        ) : null}
      </div>

      <button type="submit" className="primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกข้อมูลกิจการ"}
      </button>
    </form>
  );
}
