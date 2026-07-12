<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project rules

- Read `CONTEXT.md` for the domain glossary (ubiquitous language) and `docs/adr/` for architectural decisions before changing schema or rendering code.
- **Money**: integer satang only (`*Satang`), rates in basis points (`*Bp`), quantities in thousandths. Never `Decimal`/`Float` in Prisma models (ADR 0001). All rounding lives in `src/lib/calc/engine.ts`.
- **Portability**: no raw SQL, no SQLite-only features outside provider-gated code — Postgres swap must stay a config change.
- **Accessibility is the top product requirement**: semantic HTML first, native controls, no ARIA widget re-implementations, Thai labels (FlowAccount vocabulary), every page has a unique `<h1>`, forms return field-level errors with an error summary.
- **Templates**: `TemplateVersion` rows are immutable; built-in default source of truth is `src/templates/quotation-default.hbs`.
- UI text is Thai (`lang="th"`); dates render CE `dd/MM/yyyy`; timezone is Asia/Bangkok everywhere (numbering datekeys via `Intl.DateTimeFormat` with explicit timeZone).
