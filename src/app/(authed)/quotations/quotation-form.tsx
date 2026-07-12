"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentFormState } from "@/actions/documents";
import { ErrorSummary } from "@/components/error-summary";
import { calculateDocument } from "@/lib/calc/engine";
import {
  STANDARD_WHT_RATES_BP,
  VAT_MODE_LABELS,
  type DiscountType,
  type VatMode,
} from "@/lib/domain";
import {
  formatBpAsPercent,
  formatSatang,
  parseMoneyToSatang,
  parsePercentToBp,
  parseQtyToThousandths,
} from "@/lib/money";

export interface CustomerOption {
  id: string;
  name: string;
  address: string;
  taxId: string;
  branchType: string;
  branchCode: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export interface TemplateOption {
  id: string;
  name: string;
  isBuiltIn: boolean;
}

export interface LineValues {
  description: string;
  qty: string;
  unit: string;
  price: string;
  discountType: DiscountType;
  discountValue: string;
}

export interface QuotationFormValues {
  docNumber: string;
  issueDate: string; // yyyy-mm-dd
  customerId: string;
  custName: string;
  custAddress: string;
  custTaxId: string;
  custBranchType: string;
  custBranchCode: string;
  custContactPerson: string;
  custPhone: string;
  custEmail: string;
  custSignatoryDiff: boolean;
  custSignatoryName: string;
  sellerSignatoryDiff: boolean;
  sellerSignatoryName: string;
  showSignatureImage: boolean;
  vatMode: VatMode;
  whtChoice: string; // "NONE" | bp as string | "CUSTOM"
  whtCustom: string;
  docDiscountType: DiscountType;
  docDiscountValue: string;
  remark: string;
  notes: string;
  templateId: string;
  lines: LineValues[];
}

interface Row extends LineValues {
  key: number;
}

const EMPTY_LINE: LineValues = {
  description: "",
  qty: "1",
  unit: "",
  price: "",
  discountType: "NONE",
  discountValue: "",
};

export function QuotationForm({
  action,
  customers,
  templates,
  templateLocked = false,
  initial,
  submitLabel,
}: {
  action: (prev: DocumentFormState, formData: FormData) => Promise<DocumentFormState>;
  customers: CustomerOption[];
  templates: TemplateOption[];
  templateLocked?: boolean;
  initial: QuotationFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(action, {});
  const errors = state.errors ?? {};

  const nextKey = useRef(initial.lines.length + 1);
  const [rows, setRows] = useState<Row[]>(
    (initial.lines.length > 0 ? initial.lines : [EMPTY_LINE]).map((line, i) => ({
      ...line,
      key: i,
    })),
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(initial.customerId);
  const [snapshot, setSnapshot] = useState({
    custName: initial.custName,
    custAddress: initial.custAddress,
    custTaxId: initial.custTaxId,
    custBranchType: initial.custBranchType,
    custBranchCode: initial.custBranchCode,
    custContactPerson: initial.custContactPerson,
    custPhone: initial.custPhone,
    custEmail: initial.custEmail,
  });
  const [vatMode, setVatMode] = useState<VatMode>(initial.vatMode);
  const [whtChoice, setWhtChoice] = useState(initial.whtChoice);
  const [whtCustom, setWhtCustom] = useState(initial.whtCustom);
  const [docDiscountType, setDocDiscountType] = useState<DiscountType>(initial.docDiscountType);
  const [docDiscountValue, setDocDiscountValue] = useState(initial.docDiscountValue);
  const [custSignatoryDiff, setCustSignatoryDiff] = useState(initial.custSignatoryDiff);
  const [custSignatoryName, setCustSignatoryName] = useState(initial.custSignatoryName);
  const [sellerSignatoryDiff, setSellerSignatoryDiff] = useState(initial.sellerSignatoryDiff);
  const [sellerSignatoryName, setSellerSignatoryName] = useState(initial.sellerSignatoryName);
  const [showSignatureImage, setShowSignatureImage] = useState(initial.showSignatureImage);

  const descriptionRefs = useRef(new Map<number, HTMLTextAreaElement>());
  const [rowAnnouncement, setRowAnnouncement] = useState("");

  function updateRow(key: number, patch: Partial<LineValues>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const key = nextKey.current++;
    setRows((prev) => [...prev, { ...EMPTY_LINE, key }]);
    requestAnimationFrame(() => descriptionRefs.current.get(key)?.focus());
  }

  function removeRow(key: number) {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.key === key);
      const next = prev.filter((row) => row.key !== key);
      const target = next[Math.max(0, index - 1)];
      if (target) {
        requestAnimationFrame(() => descriptionRefs.current.get(target.key)?.focus());
      }
      setRowAnnouncement(`ลบรายการที่ ${index + 1} แล้ว เหลือ ${next.length} รายการ`);
      return next;
    });
  }

  function pullCustomer() {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return;
    setSnapshot({
      custName: customer.name,
      custAddress: customer.address,
      custTaxId: customer.taxId,
      custBranchType: customer.branchType,
      custBranchCode: customer.branchCode,
      custContactPerson: customer.contactPerson,
      custPhone: customer.phone,
      custEmail: customer.email,
    });
  }

  // Live totals from current inputs (invalid numbers count as 0).
  const totals = useMemo(() => {
    const whtRateBp =
      whtChoice === "NONE"
        ? null
        : whtChoice === "CUSTOM"
          ? parsePercentToBp(whtCustom)
          : parseInt(whtChoice, 10) || null;
    return calculateDocument({
      lines: rows.map((row) => ({
        qtyThousandths: parseQtyToThousandths(row.qty) ?? 0,
        unitPriceSatang: parseMoneyToSatang(row.price) ?? 0,
        discountType: row.discountType,
        discountValue:
          row.discountType === "AMOUNT"
            ? (parseMoneyToSatang(row.discountValue) ?? 0)
            : row.discountType === "PERCENT"
              ? (parsePercentToBp(row.discountValue) ?? 0)
              : 0,
      })),
      docDiscountType,
      docDiscountValue:
        docDiscountType === "AMOUNT"
          ? (parseMoneyToSatang(docDiscountValue) ?? 0)
          : docDiscountType === "PERCENT"
            ? (parsePercentToBp(docDiscountValue) ?? 0)
            : 0,
      vatMode,
      vatRateBp: 700,
      whtRateBp,
    });
  }, [rows, docDiscountType, docDiscountValue, vatMode, whtChoice, whtCustom]);

  // Debounced spoken summary so screen readers hear the payable total settle,
  // not every keystroke.
  const [spokenTotal, setSpokenTotal] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSpokenTotal(`ยอดชำระ ${formatSatang(totals.payableSatang)} บาท`);
    }, 1000);
    return () => clearTimeout(timer);
  }, [totals.payableSatang]);

  return (
    <form action={formAction}>
      <ErrorSummary errors={errors} />

      <div className="field">
        <label htmlFor="docNumber">เลขที่เอกสาร</label>
        <input
          id="docNumber"
          name="docNumber"
          type="text"
          size={24}
          defaultValue={initial.docNumber}
          aria-describedby={`docNumber-hint${errors.docNumber ? " docNumber-error" : ""}`}
          aria-invalid={errors.docNumber ? true : undefined}
        />
        <p id="docNumber-hint" className="hint">
          ระบบสร้างให้อัตโนมัติเมื่อเว้นว่าง แก้ไขได้
        </p>
        {errors.docNumber ? (
          <p id="docNumber-error" className="field-error">
            {errors.docNumber}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="issueDate">วันที่เอกสาร</label>
        <input
          id="issueDate"
          name="issueDate"
          type="date"
          required
          defaultValue={initial.issueDate}
          aria-invalid={errors.issueDate ? true : undefined}
          aria-describedby={errors.issueDate ? "issueDate-error" : undefined}
        />
        {errors.issueDate ? (
          <p id="issueDate-error" className="field-error">
            {errors.issueDate}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="templateId">แบบฟอร์มเอกสาร</label>
        <select
          id="templateId"
          name="templateId"
          defaultValue={initial.templateId}
          disabled={templateLocked}
          aria-describedby={`templateId-hint${errors.templateId ? " templateId-error" : ""}`}
          aria-invalid={errors.templateId ? true : undefined}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isBuiltIn ? " (ค่าเริ่มต้น)" : ""}
            </option>
          ))}
        </select>
        <p id="templateId-hint" className="hint">
          {templateLocked
            ? "เปลี่ยนแบบฟอร์มได้เฉพาะเอกสารร่าง เอกสารนี้ตรึงเวอร์ชันไว้แล้ว"
            : "เอกสารร่างจะใช้แบบฟอร์มเวอร์ชันล่าสุดเสมอ และตรึงเวอร์ชันเมื่อออกเอกสาร"}
        </p>
        {errors.templateId ? (
          <p id="templateId-error" className="field-error">
            {errors.templateId}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend>ลูกค้า</legend>
        <div className="field">
          <label htmlFor="customerId">เลือกจากฐานข้อมูลลูกค้า</label>
          <select
            id="customerId"
            name="customerId"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">— ไม่เชื่อมกับฐานข้อมูล —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>{" "}
          <button type="button" onClick={pullCustomer} disabled={!selectedCustomerId}>
            ดึงข้อมูลลูกค้า
          </button>
          <p className="hint">
            การดึงข้อมูลจะคัดลอกลงช่องด้านล่าง แก้ไขได้เฉพาะเอกสารนี้โดยไม่กระทบฐานข้อมูล
          </p>
        </div>

        <div className="field">
          <label htmlFor="custName">ชื่อลูกค้าในเอกสาร</label>
          <input
            id="custName"
            name="custName"
            type="text"
            required
            size={60}
            value={snapshot.custName}
            onChange={(e) => setSnapshot({ ...snapshot, custName: e.target.value })}
            aria-invalid={errors.custName ? true : undefined}
            aria-describedby={errors.custName ? "custName-error" : undefined}
          />
          {errors.custName ? (
            <p id="custName-error" className="field-error">
              {errors.custName}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="custAddress">ที่อยู่ลูกค้าในเอกสาร</label>
          <textarea
            id="custAddress"
            name="custAddress"
            rows={3}
            required
            value={snapshot.custAddress}
            onChange={(e) => setSnapshot({ ...snapshot, custAddress: e.target.value })}
            aria-invalid={errors.custAddress ? true : undefined}
            aria-describedby={errors.custAddress ? "custAddress-error" : undefined}
          />
          {errors.custAddress ? (
            <p id="custAddress-error" className="field-error">
              {errors.custAddress}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="custTaxId">เลขประจำตัวผู้เสียภาษีลูกค้า (ถ้ามี)</label>
          <input
            id="custTaxId"
            name="custTaxId"
            type="text"
            inputMode="numeric"
            size={20}
            value={snapshot.custTaxId}
            onChange={(e) => setSnapshot({ ...snapshot, custTaxId: e.target.value })}
          />
        </div>

        <div className="field">
          <label>
            <input
              type="radio"
              name="custBranchType"
              value="HEAD_OFFICE"
              checked={snapshot.custBranchType === "HEAD_OFFICE"}
              onChange={() => setSnapshot({ ...snapshot, custBranchType: "HEAD_OFFICE" })}
            />{" "}
            สำนักงานใหญ่
          </label>
          <label>
            <input
              type="radio"
              name="custBranchType"
              value="BRANCH"
              checked={snapshot.custBranchType === "BRANCH"}
              onChange={() => setSnapshot({ ...snapshot, custBranchType: "BRANCH" })}
            />{" "}
            สาขา
          </label>
          {snapshot.custBranchType === "BRANCH" ? (
            <span className="field">
              <label htmlFor="custBranchCode">รหัสสาขา</label>
              <input
                id="custBranchCode"
                name="custBranchCode"
                type="text"
                inputMode="numeric"
                size={10}
                value={snapshot.custBranchCode}
                onChange={(e) => setSnapshot({ ...snapshot, custBranchCode: e.target.value })}
              />
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="custContactPerson">ผู้ติดต่อ</label>
          <input
            id="custContactPerson"
            name="custContactPerson"
            type="text"
            size={40}
            value={snapshot.custContactPerson}
            onChange={(e) => setSnapshot({ ...snapshot, custContactPerson: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="custPhone">โทรศัพท์ลูกค้า</label>
          <input
            id="custPhone"
            name="custPhone"
            type="tel"
            size={20}
            value={snapshot.custPhone}
            onChange={(e) => setSnapshot({ ...snapshot, custPhone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="custEmail">อีเมลลูกค้า</label>
          <input
            id="custEmail"
            name="custEmail"
            type="email"
            size={40}
            value={snapshot.custEmail}
            onChange={(e) => setSnapshot({ ...snapshot, custEmail: e.target.value })}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>รายการสินค้า/บริการ</legend>
        <table className="data">
          <caption className="visually-hidden">
            รายการในเอกสาร ทั้งหมด {rows.length} รายการ
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">รายละเอียด</th>
              <th scope="col">จำนวน</th>
              <th scope="col">หน่วย</th>
              <th scope="col">ราคาต่อหน่วย (บาท)</th>
              <th scope="col">ส่วนลด</th>
              <th scope="col" className="num">
                มูลค่า (บาท)
              </th>
              <th scope="col">ลบ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key}>
                <td>{i + 1}</td>
                <td>
                  <textarea
                    id={`line-${i}-description`}
                    name={`line-${i}-description`}
                    rows={2}
                    cols={30}
                    aria-label={`รายละเอียด รายการที่ ${i + 1}`}
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    ref={(el) => {
                      if (el) descriptionRefs.current.set(row.key, el);
                      else descriptionRefs.current.delete(row.key);
                    }}
                    aria-invalid={errors[`line-${i}-description`] ? true : undefined}
                  />
                </td>
                <td>
                  <input
                    id={`line-${i}-qty`}
                    name={`line-${i}-qty`}
                    type="text"
                    inputMode="decimal"
                    size={6}
                    aria-label={`จำนวน รายการที่ ${i + 1}`}
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                    aria-invalid={errors[`line-${i}-qty`] ? true : undefined}
                  />
                </td>
                <td>
                  <input
                    id={`line-${i}-unit`}
                    name={`line-${i}-unit`}
                    type="text"
                    size={8}
                    aria-label={`หน่วย รายการที่ ${i + 1}`}
                    value={row.unit}
                    onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    id={`line-${i}-price`}
                    name={`line-${i}-price`}
                    type="text"
                    inputMode="decimal"
                    size={12}
                    aria-label={`ราคาต่อหน่วย รายการที่ ${i + 1}`}
                    value={row.price}
                    onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    aria-invalid={errors[`line-${i}-price`] ? true : undefined}
                  />
                </td>
                <td>
                  <select
                    name={`line-${i}-discountType`}
                    aria-label={`ประเภทส่วนลด รายการที่ ${i + 1}`}
                    value={row.discountType}
                    onChange={(e) =>
                      updateRow(row.key, { discountType: e.target.value as DiscountType })
                    }
                  >
                    <option value="NONE">ไม่มีส่วนลด</option>
                    <option value="AMOUNT">บาท</option>
                    <option value="PERCENT">%</option>
                  </select>
                  {row.discountType !== "NONE" ? (
                    <input
                      id={`line-${i}-discountValue`}
                      name={`line-${i}-discountValue`}
                      type="text"
                      inputMode="decimal"
                      size={8}
                      aria-label={`มูลค่าส่วนลด${row.discountType === "PERCENT" ? " เปอร์เซ็นต์" : " บาท"} รายการที่ ${i + 1}`}
                      value={row.discountValue}
                      onChange={(e) => updateRow(row.key, { discountValue: e.target.value })}
                      aria-invalid={errors[`line-${i}-discountValue`] ? true : undefined}
                    />
                  ) : null}
                </td>
                <td className="num">{formatSatang(totals.lineTotalsSatang[i] ?? 0)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                  >
                    ลบรายการที่ {i + 1}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addRow}>
          เพิ่มรายการ
        </button>
        <p aria-live="polite" className="visually-hidden">
          {rowAnnouncement}
        </p>
      </fieldset>

      <fieldset>
        <legend>ภาษีมูลค่าเพิ่ม</legend>
        {(Object.keys(VAT_MODE_LABELS) as VatMode[]).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name="vatMode"
              value={mode}
              checked={vatMode === mode}
              onChange={() => setVatMode(mode)}
            />{" "}
            {VAT_MODE_LABELS[mode]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>หักภาษี ณ ที่จ่าย</legend>
        <div className="field">
          <label htmlFor="whtChoice">อัตราหักภาษี ณ ที่จ่าย</label>
          <select
            id="whtChoice"
            name="whtChoice"
            value={whtChoice}
            onChange={(e) => setWhtChoice(e.target.value)}
          >
            <option value="NONE">ไม่หักภาษี ณ ที่จ่าย</option>
            {STANDARD_WHT_RATES_BP.map((bp) => (
              <option key={bp} value={String(bp)}>
                {formatBpAsPercent(bp)}%
              </option>
            ))}
            <option value="CUSTOM">กำหนดเอง</option>
          </select>
        </div>
        {whtChoice === "CUSTOM" ? (
          <div className="field">
            <label htmlFor="whtCustom">อัตราที่กำหนดเอง (เปอร์เซ็นต์)</label>
            <input
              id="whtCustom"
              name="whtCustom"
              type="text"
              inputMode="decimal"
              size={6}
              value={whtCustom}
              onChange={(e) => setWhtCustom(e.target.value)}
              aria-invalid={errors.whtCustom ? true : undefined}
              aria-describedby={errors.whtCustom ? "whtCustom-error" : undefined}
            />
            {errors.whtCustom ? (
              <p id="whtCustom-error" className="field-error">
                {errors.whtCustom}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>ส่วนลดรวมของเอกสาร</legend>
        <div className="field">
          <label htmlFor="docDiscountType">ประเภทส่วนลด</label>
          <select
            id="docDiscountType"
            name="docDiscountType"
            value={docDiscountType}
            onChange={(e) => setDocDiscountType(e.target.value as DiscountType)}
          >
            <option value="NONE">ไม่มีส่วนลด</option>
            <option value="AMOUNT">จำนวนเงิน (บาท)</option>
            <option value="PERCENT">เปอร์เซ็นต์</option>
          </select>
        </div>
        {docDiscountType !== "NONE" ? (
          <div className="field">
            <label htmlFor="docDiscountValue">
              {docDiscountType === "AMOUNT" ? "ส่วนลด (บาท)" : "ส่วนลด (เปอร์เซ็นต์)"}
            </label>
            <input
              id="docDiscountValue"
              name="docDiscountValue"
              type="text"
              inputMode="decimal"
              size={10}
              value={docDiscountValue}
              onChange={(e) => setDocDiscountValue(e.target.value)}
              aria-invalid={errors.docDiscountValue ? true : undefined}
              aria-describedby={errors.docDiscountValue ? "docDiscountValue-error" : undefined}
            />
            {errors.docDiscountValue ? (
              <p id="docDiscountValue-error" className="field-error">
                {errors.docDiscountValue}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>ผู้ลงนามท้ายเอกสาร</legend>
        <p className="hint">
          ปกติช่องลงนามจะใช้ชื่อลูกค้าและชื่อกิจการ ติ๊กช่องด้านล่างเมื่อผู้ลงนามเป็นคนละชื่อ
        </p>

        <div className="field">
          <label>
            <input
              type="checkbox"
              name="custSignatoryDiff"
              checked={custSignatoryDiff}
              onChange={(e) => setCustSignatoryDiff(e.target.checked)}
            />{" "}
            ผู้ลงนามฝั่งลูกค้า (ผู้สั่งซื้อสินค้า) ไม่ใช่ชื่อลูกค้า
          </label>
          {custSignatoryDiff ? (
            <div className="field">
              <label htmlFor="custSignatoryName">ชื่อผู้ลงนามฝั่งลูกค้า</label>
              <input
                id="custSignatoryName"
                name="custSignatoryName"
                type="text"
                size={40}
                value={custSignatoryName}
                onChange={(e) => setCustSignatoryName(e.target.value)}
                aria-invalid={errors.custSignatoryName ? true : undefined}
                aria-describedby={errors.custSignatoryName ? "custSignatoryName-error" : undefined}
              />
              {errors.custSignatoryName ? (
                <p id="custSignatoryName-error" className="field-error">
                  {errors.custSignatoryName}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              name="sellerSignatoryDiff"
              checked={sellerSignatoryDiff}
              onChange={(e) => setSellerSignatoryDiff(e.target.checked)}
            />{" "}
            ผู้ลงนามฝั่งผู้ขาย (ผู้อนุมัติ) ไม่ใช่ชื่อกิจการ
          </label>
          {sellerSignatoryDiff ? (
            <div className="field">
              <label htmlFor="sellerSignatoryName">ชื่อผู้ลงนามฝั่งผู้ขาย</label>
              <input
                id="sellerSignatoryName"
                name="sellerSignatoryName"
                type="text"
                size={40}
                value={sellerSignatoryName}
                onChange={(e) => setSellerSignatoryName(e.target.value)}
                aria-invalid={errors.sellerSignatoryName ? true : undefined}
                aria-describedby={
                  errors.sellerSignatoryName ? "sellerSignatoryName-error" : undefined
                }
              />
              {errors.sellerSignatoryName ? (
                <p id="sellerSignatoryName-error" className="field-error">
                  {errors.sellerSignatoryName}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              name="showSignatureImage"
              checked={showSignatureImage}
              onChange={(e) => setShowSignatureImage(e.target.checked)}
            />{" "}
            แสดงรูปลายเซ็นในเอกสาร
          </label>
          <p className="hint">
            หากไม่ติ๊ก ช่องผู้อนุมัติจะเว้นว่างไว้สำหรับเซ็นด้วยปากกา (ยังแสดงวันที่)
          </p>
        </div>
      </fieldset>

      <section aria-label="สรุปยอด">
        <h2>สรุปยอด</h2>
        <table className="data" style={{ maxWidth: "28rem" }}>
          <tbody>
            <tr>
              <th scope="row">รวมเป็นเงิน</th>
              <td className="num">{formatSatang(totals.subtotalSatang)} บาท</td>
            </tr>
            {totals.show.discount ? (
              <>
                <tr>
                  <th scope="row">ส่วนลด</th>
                  <td className="num">{formatSatang(totals.discountSatang)} บาท</td>
                </tr>
                <tr>
                  <th scope="row">มูลค่าหลังหักส่วนลด</th>
                  <td className="num">{formatSatang(totals.afterDiscountSatang)} บาท</td>
                </tr>
              </>
            ) : null}
            {totals.show.vat ? (
              <tr>
                <th scope="row">ภาษีมูลค่าเพิ่ม 7%</th>
                <td className="num">{formatSatang(totals.vatSatang)} บาท</td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">จำนวนเงินรวมทั้งสิ้น</th>
              <td className="num">{formatSatang(totals.grandTotalSatang)} บาท</td>
            </tr>
            {totals.show.wht ? (
              <>
                <tr>
                  <th scope="row">หักภาษี ณ ที่จ่าย</th>
                  <td className="num">{formatSatang(totals.whtSatang)} บาท</td>
                </tr>
                <tr>
                  <th scope="row">ยอดชำระ</th>
                  <td className="num">{formatSatang(totals.payableSatang)} บาท</td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
        <p aria-live="polite" className="hint">
          {spokenTotal}
        </p>
      </section>

      <div className="field">
        <label htmlFor="remark">หมายเหตุ</label>
        <textarea
          id="remark"
          name="remark"
          rows={2}
          defaultValue={initial.remark}
        />
      </div>

      <div className="field">
        <label htmlFor="notes">บันทึกภายใน (ไม่แสดงในเอกสาร)</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={initial.notes}
        />
      </div>

      <button type="submit" className="primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : submitLabel}
      </button>
    </form>
  );
}
