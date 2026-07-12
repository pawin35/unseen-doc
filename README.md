# Unseen Docs — ระบบออกเอกสารธุรกิจที่ทุกคนเข้าถึงได้

ระบบออกเอกสารธุรกิจไทยที่เน้นการเข้าถึงด้วยโปรแกรมอ่านหน้าจอ (screen reader) ครอบคลุม
ใบเสนอราคา (เฟสแรก), ข้อมูลกิจการ และฐานข้อมูลลูกค้า พร้อมแบบฟอร์มเอกสารที่
**แก้ไขเป็นโค้ดได้** (HTML + Handlebars) บันทึกเป็นเวอร์ชัน และคืนค่าเริ่มต้นได้

- เอกสาร PDF ขนาด A4 ฟอนต์ CS ChatThai แบบ tagged (อ่านด้วย screen reader ได้)
- ข้อมูลเดียวกัน ⇒ เอกสารหน้าตาตรงตามเอกสารอ้างอิงใน `reference/` (ตรวจด้วย `npm run fidelity`)
- คำศัพท์ในโดเมนดู `CONTEXT.md`; การตัดสินใจเชิงสถาปัตยกรรมดู `docs/adr/`

## เริ่มใช้งาน (Windows / พัฒนา)

```powershell
npm install
npx playwright install chromium   # เบราว์เซอร์สำหรับสร้าง PDF
copy .env.example .env            # แล้วแก้รหัสผ่านตามต้องการ
npx prisma migrate dev            # สร้างฐานข้อมูล SQLite ใน data/
npm run db:seed                   # ข้อมูลตั้งต้น + เอกสารตัวอย่าง
npm run dev                       # http://localhost:3000
```

เข้าสู่ระบบด้วย `ADMIN_USERNAME` / `ADMIN_PASSWORD` จาก `.env`

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เซิร์ฟเวอร์พัฒนา |
| `npm test` | ชุดทดสอบเครื่องคำนวณเงิน/ตัวอักษรบาท |
| `npm run db:migrate` | สร้าง/ปรับ schema ฐานข้อมูล |
| `npm run db:seed` | ข้อมูลตั้งต้น (รันซ้ำได้ ไม่ทับข้อมูลที่แก้แล้ว) |
| `npm run fidelity` | เทียบเอกสารที่ระบบสร้างกับ `reference/example_qt.pdf` |

## Docker

```powershell
copy .env.docker.example .env.docker   # แก้รหัสผ่าน/secret
docker compose up --build
```

ข้อมูล (ฐานข้อมูล + ไฟล์อัปโหลด) อยู่ใน volume `./data-docker`

## สลับไป PostgreSQL

1. เปลี่ยน `provider` ใน `prisma/schema.prisma` เป็น `postgresql`
2. ติดตั้ง `@prisma/adapter-pg` และสลับ adapter ใน `src/lib/prisma.ts`
3. ตั้ง `DATABASE_URL` เป็น connection string ของ Postgres แล้วรัน `prisma migrate dev`

โค้ดไม่ใช้ SQL ดิบและไม่ใช้ type เฉพาะ SQLite (เงินเก็บเป็น integer สตางค์ — ADR 0001)
จึงไม่ต้องแก้โค้ดส่วนอื่น

## แบบฟอร์มเอกสาร (template)

- แก้ไขที่เมนู "แบบฟอร์มเอกสาร" — โค้ดเป็น HTML + Handlebars ใน `<textarea>` ธรรมดา
- บันทึกทุกครั้ง = เวอร์ชันใหม่ (เวอร์ชันเก่าไม่หาย) สร้างแบบฟอร์มใหม่ได้ด้วย "บันทึกเป็นแบบฟอร์มใหม่"
- แต่ละเอกสารเลือกแบบฟอร์มได้เอง (ช่อง "แบบฟอร์มเอกสาร" ในฟอร์ม) — เปลี่ยนได้เฉพาะตอนเป็นเอกสารร่าง
- เอกสารร่างใช้แบบฟอร์มเวอร์ชันล่าสุดเสมอ และ **ตรึงเวอร์ชันเมื่อออกเอกสาร** (ร่าง → รอตอบรับ); พิมพ์ซ้ำหลังออกเอกสารได้เหมือนเดิมทุกประการ
- แบบฟอร์มค่าเริ่มต้นแก้ไขไม่ได้ แต่ "คืนค่าเริ่มต้น" จากไฟล์ `src/templates/quotation-default.hbs` ได้เสมอ

### ตัวแปรที่ใช้ได้ในแบบฟอร์ม

| ตัวแปร | ความหมาย |
|---|---|
| `{{doc.typeLabel}}` `{{doc.number}}` `{{doc.date}}` | ชนิดเอกสาร เลขที่ วันที่ (วว/ดด/ปปปป ค.ศ.) |
| `{{company.name}}` `{{company.address}}` `{{company.taxId}}` `{{company.phone}}` | ผู้ออกเอกสาร |
| `{{company.logoDataUri}}` `{{company.signatureDataUri}}` | รูปโลโก้/ลายเซ็น (ใส่ใน `src` ของ `<img>`) |
| `{{customer.name}}` `{{customer.address}}` `{{customer.taxId}}` | ลูกค้า (สำเนาที่ตรึงกับเอกสาร) |
| `{{#each lines}} … {{/each}}` | วนรายการ: `{{no}}` `{{description}}` `{{qty}}` `{{unit}}` `{{unitPrice}}` `{{discount}}` `{{amount}}` |
| `{{totals.subtotal}}` `{{totals.discount}}` `{{totals.afterDiscount}}` | ยอดรวม/ส่วนลด (จัดรูปแบบแล้ว) |
| `{{totals.vatLabel}}` `{{totals.vat}}` `{{totals.grandTotal}}` | ภาษีมูลค่าเพิ่ม/ยอดรวมทั้งสิ้น |
| `{{totals.whtLabel}}` `{{totals.wht}}` `{{totals.payable}}` | หัก ณ ที่จ่าย/ยอดชำระ |
| `{{totals.bahtText}}` | จำนวนเงินเป็นตัวอักษร เช่น หนึ่งแสนบาทถ้วน |
| `{{totals.show.discount}}` `{{totals.show.vat}}` `{{totals.show.wht}}` | ใช้กับ `{{#if}}` เพื่อแสดงแถวเฉพาะเมื่อมีข้อมูล |
| `{{signing.customerName}}` `{{signing.sellerName}}` | ชื่อผู้ลงนามท้ายเอกสาร (คืนค่าชื่อลูกค้า/กิจการเมื่อไม่กำหนดเอง) |
| `{{signing.showSignatureImage}}` | ใช้กับ `{{#if}}` ควบคุมการแสดงรูปลายเซ็นที่บันทึกไว้ |

ฟอนต์ "CS ChatThai" ถูกฝังให้อัตโนมัติ — ใช้ `font-family: "CS ChatThai"` ได้ทันที
(น้ำหนัก 300/400/700 และ "CS ChatThai UI" อีกตระกูล)

## โครงสร้างสำคัญ

```
prisma/schema.prisma        โมเดลข้อมูล (เงินเป็น integer สตางค์)
src/lib/calc/engine.ts      เครื่องคำนวณยอด (pure, มีเทสต์)
src/lib/render/             Handlebars → HTML → Chromium → tagged PDF
src/templates/quotation-default.hbs  แบบฟอร์มค่าเริ่มต้น (ต้นฉบับ)
scripts/compare-fidelity.ts เทียบผลลัพธ์กับเอกสารอ้างอิง
```

## เครดิตฟอนต์

CS ChatThai โดย CS@nok เผยแพร่ผ่าน [f0nt.com](https://www.f0nt.com/release/cs-chatthai/)
ใช้ได้ฟรีทั้งงานส่วนตัวและเชิงพาณิชย์ตามสัญญาอนุญาตของผู้สร้าง (ห้ามขายไฟล์ฟอนต์แยก)
