# CONTEXT — Ubiquitous Language

Glossary of domain terms for the accessible FlowAccount clone. Terms are used exactly as defined here in code, UI, and conversation. Thai UI labels follow FlowAccount vocabulary.

## Documents

- **Document** — the shared core of every Thai business document (number, issue date, customer snapshot, lines, totals, status). Discriminated by **DocType**. One table for all six types.
- **DocType** — one of: **Quotation** (ใบเสนอราคา), **Billing Note** (ใบวางบิล), **Invoice** (ใบแจ้งหนี้), **Receipt** (ใบเสร็จรับเงิน), **Purchase Order** (ใบสั่งซื้อ), **Goods Receipt** (ใบรับสินค้า). Phase 1 implements only Quotation.
- **Document Number** (เลขที่) — unique per DocType. Auto-generated from the type's numbering pattern (e.g. `QT{YYYY}{MM}{DD}{NNNN}` with a daily counter in Asia/Bangkok time) but user-overridable; the uniqueness constraint, not the counter, is the source of truth.
- **Issue Date** (วันที่) — the date printed on the document, rendered CE `dd/MM/yyyy`.
- **Status** (สถานะ) — Draft (ร่าง) → Awaiting (รอตอบรับ) → Accepted (ยอมรับแล้ว) or Rejected (ปฏิเสธ).
- **Issue** — the act of moving a Draft to Awaiting.
- **Line** (รายการ) — free-text description + quantity + unit + unit price + optional line discount. No product catalog; lines own their text and prices.
- **Remark** (หมายเหตุ) — free text printed on the document, below the totals block. Part of the document snapshot (pinned into print history at issue). Distinct from the Internal Note.
- **Internal Note** (บันทึกภายใน) — staff-only free text on a Document. Never printed and never exposed to templates; for internal reference only.

## Parties

- **Company** (ข้อมูลกิจการ) — the single seller profile: name, address, tax ID, branch, phone, email, logo image, signature image. Exactly one.
- **Customer** (ลูกค้า) — a record in the customer database: name, address, tax ID, branch (สำนักงานใหญ่/สาขา + code), contact person, phone, email.
- **Customer Snapshot** (ข้อมูลลูกค้าในเอกสาร) — the copy of customer fields stored inside a Document at creation. Editable per document; never written back to the Customer record. Editing a Customer never changes existing Documents.
- **Signatory** (ผู้ลงนาม) — the name printed after "ในนาม" in a Document's signature block, per side (customer = ผู้สั่งซื้อสินค้า, seller = ผู้อนุมัติ). Defaults to the party name (Customer Snapshot name / Company name); each side can be overridden per document without affecting the party. A per-document flag also controls whether the stored signature image prints. Overrides are part of the document snapshot — immutable in print history via version pinning.

## Money & tax

All money amounts are integer **satang**; rates are integer **basis points** (700 = 7%); quantities are integer thousandths.

- **Subtotal** (รวมเป็นเงิน) — sum of line totals after line discounts.
- **Document Discount** (ส่วนลด) — amount or percent, applied to the Subtotal.
- **VAT Mode** — None, Exclusive (ราคาไม่รวมภาษีมูลค่าเพิ่ม), or Inclusive (ราคารวมภาษีมูลค่าเพิ่ม).
- **Grand Total** (จำนวนเงินรวมทั้งสิ้น) — amount including VAT.
- **Withholding Tax / WHT** (หักภาษี ณ ที่จ่าย) — optional percentage computed on the pre-VAT base.
- **Payable** (ยอดชำระ) — Grand Total minus WHT.
- **Baht Text** — the Thai spelled-out amount, e.g. หนึ่งแสนบาทถ้วน, auto-generated from the Grand Total.

## Templates

- **Template** (แบบฟอร์ม) — a named HTML + Handlebars source that renders one DocType. Users edit the source as code.
- **Template Version** — an immutable snapshot of a Template's source. Every save creates a new version.
- **Built-in Template** (แบบฟอร์มค่าเริ่มต้น) — the shipped default per DocType, read-only in the app. **Restore to default** re-reads the repo file into a new active version of the Built-in Template.
- **Active Version** — the version of a Template used for new prints.
- **Selected Template** (แบบฟอร์มที่เลือก) — the Template a Document is set to use, chosen on the document form (defaults to the Built-in). Changeable only while the document is a draft. A draft always renders its Selected Template's Active Version.
- **Pin** — the Template Version frozen into a Document when it is **issued** (draft → รอตอบรับ). Reprints of an issued document always use the pin (byte-identical). Reverting an issued document to draft clears the pin and reopens the Selected Template for change (ADR 0004, supersedes 0003's pin-at-first-print + reprint choice).
