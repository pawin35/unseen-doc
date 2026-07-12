# Unseen Doc — an accessible Thai business-document generator

A screen-reader-first system for issuing Thai business documents: quotations (ใบเสนอราคา, phase 1),
the company profile, and a customer database. Document forms are **editable as code**
(HTML + Handlebars), versioned on every save, and restorable to the shipped default.

- Renders tagged A4 PDFs in the CS ChatThai font, so the output is readable with a screen reader.
- Same data ⇒ same document: output is diffed against the reference PDFs in `reference/` (`npm run fidelity`).
- Domain vocabulary lives in `CONTEXT.md`; architectural decisions in `docs/adr/`.

The product UI and the printed documents are in Thai (standard Thai tax-invoice vocabulary);
the code, comments, and docs are in English.

## Getting started (Windows / development)

```powershell
npm install
npx playwright install chromium   # the browser used to render PDFs
copy .env.example .env            # then set your own admin password / session secret
npx prisma migrate dev            # creates the SQLite database in data/
npm run db:seed                   # seed data + one example document
npm run dev                       # http://localhost:3000
```

Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` (a single admin; there is no user table).

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests for the money engine and the baht-text speller |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply database migrations |
| `npm run db:seed` | Seed data (idempotent — safe to re-run) |
| `npm run fidelity` | Render the seeded document plus variants and diff them against the reference PDFs |

`npm run fidelity` expects the reference PDFs in `reference/`. That folder is **not committed**
(third-party output and a real signature image), so the check only runs where those files are present locally.

## Docker

```powershell
copy .env.docker.example .env.docker   # set the password / secret
docker compose up --build
```

The database and uploaded files live in the `./data-docker` volume.

## Switching to PostgreSQL

1. Change `provider` in `prisma/schema.prisma` to `postgresql`.
2. Install `@prisma/adapter-pg` and swap the adapter in `src/lib/prisma.ts`.
3. Point `DATABASE_URL` at your Postgres connection string and run `prisma migrate dev`.

No other code changes are needed: the codebase uses no raw SQL and no SQLite-specific types
(money is stored as integer satang — ADR 0001).

## Document templates

- Edit them under "แบบฟอร์มเอกสาร" — the source is HTML + Handlebars in a plain `<textarea>`.
- Every save creates a new version (old versions are never lost); "บันทึกเป็นแบบฟอร์มใหม่" forks a new template.
- Each document picks its own template (the "แบบฟอร์มเอกสาร" field on the form) — changeable only while it is a draft.
- A draft always renders the template's latest version. **Issuing the document (ร่าง → รอตอบรับ) freezes that
  version**, so reprints of an issued document are byte-identical forever.
- The built-in template is read-only, but "คืนค่าเริ่มต้น" always restores it from `src/templates/quotation-default.hbs`.

### Variables available in a template

| Variable | Meaning |
|---|---|
| `{{doc.typeLabel}}` `{{doc.number}}` `{{doc.date}}` | Document type, number, and issue date (CE `dd/MM/yyyy`) |
| `{{doc.remark}}` | Remark (หมายเหตุ) printed below the totals. Internal notes are never exposed to templates. |
| `{{company.name}}` `{{company.address}}` `{{company.taxId}}` `{{company.phone}}` | The issuing company |
| `{{company.logoDataUri}}` `{{company.signatureDataUri}}` | Logo / signature images (use as the `src` of an `<img>`) |
| `{{customer.name}}` `{{customer.address}}` `{{customer.taxId}}` | Customer (the snapshot pinned to this document) |
| `{{#each lines}} … {{/each}}` | Line items: `{{no}}` `{{description}}` `{{qty}}` `{{unit}}` `{{unitPrice}}` `{{discount}}` `{{amount}}` |
| `{{totals.subtotal}}` `{{totals.discount}}` `{{totals.afterDiscount}}` | Subtotal / discount (pre-formatted) |
| `{{totals.vatLabel}}` `{{totals.vat}}` `{{totals.grandTotal}}` | VAT and grand total |
| `{{totals.whtLabel}}` `{{totals.wht}}` `{{totals.payable}}` | Withholding tax and the payable amount |
| `{{totals.bahtText}}` | The amount spelled out in Thai, e.g. หนึ่งแสนบาทถ้วน |
| `{{totals.show.discount}}` `{{totals.show.vat}}` `{{totals.show.wht}}` | Use with `{{#if}}` to show a row only when it applies |
| `{{signing.customerName}}` `{{signing.sellerName}}` | Names printed in the signature block (default to the customer / company name) |
| `{{signing.showSignatureImage}}` | Use with `{{#if}}` to control whether the stored signature image prints |

The "CS ChatThai" font is embedded automatically — just use `font-family: "CS ChatThai"`
(weights 300/400/700, plus the "CS ChatThai UI" family).

A template that needs more than one page paginates itself with a small client-side script and marks
`<html data-paginating>` while it runs; the PDF renderer waits for that flag to clear (ADR 0005).

## Key files

```
prisma/schema.prisma                 Data model (money as integer satang)
src/lib/calc/engine.ts               Totals engine (pure, unit-tested)
src/lib/render/                      Handlebars → HTML → Chromium → tagged PDF
src/templates/quotation-default.hbs  The built-in template (source of truth)
scripts/compare-fidelity.ts          Diffs rendered output against the reference PDFs
scripts/a11y-walkthrough.ts          Scripted screen-reader-oriented end-to-end walkthrough
```

## Font credit

CS ChatThai by CS@nok, released via [f0nt.com](https://www.f0nt.com/release/cs-chatthai/).
Free for personal and commercial use under the author's licence (the font files may not be resold on their own).
