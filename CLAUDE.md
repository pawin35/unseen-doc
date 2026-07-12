# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The rules in AGENTS.md above are binding. Read `CONTEXT.md` (domain glossary) and `docs/adr/` (architecture decisions) before changing schema, money math, or rendering. This file adds the commands and cross-file architecture those rules assume.

## Commands

```bash
npm run dev            # Next.js dev server (localhost:3000)
npm run build          # production build
npm test               # vitest (calc engine, bahtText, money) — pure-unit, fast
npm run lint           # eslint
npm run db:migrate     # prisma migrate dev (SQLite in data/)
npm run db:seed        # idempotent seed: company, numbering, built-in template, example QT202607060001
npm run fidelity       # render seeded doc + variants, diff vs reference/*.pdf (text asserts + per-page pixelmatch)
npx prisma generate    # REQUIRED after any schema.prisma change — client is generated to src/generated/prisma
npx tsc --noEmit       # typecheck (not wired to a script)
```

- **Single test:** `npx vitest run src/lib/calc/engine.test.ts` (or `-t "name"` for one case).
- **End-to-end accessibility walkthrough:** `npx tsx scripts/a11y-walkthrough.ts` with the dev server running. Set `WALKTHROUGH_BASE_URL=http://localhost:3001` if 3000 is taken. It drives login → CRUD → quotation → PDF → template editor and asserts focus management, aria-live totals, labelled fields. **The user is blind — verify changes with `npm run fidelity` and this walkthrough, not just "it looks right."**
- **Position tuning:** `npx tsx scripts/compare-positions.ts` dumps per-line mm coordinates from PDFs (via pdfjs) — use this, not screenshots, to tune the template against references.
- First-time setup also needs `npx playwright install chromium` (PDF engine) and `cp .env.example .env`.

## Architecture

**Stack:** Next.js 16 (App Router, Turbopack, React 19 Server Components + Server Actions) · Prisma 7 on SQLite via `@prisma/adapter-better-sqlite3` · Playwright headless Chromium for PDFs · iron-session auth. No client data-fetching layer; mutations are Server Actions in `src/actions/`.

**Auth is a single admin, no User table.** Credentials come from env (`ADMIN_USERNAME`/`ADMIN_PASSWORD`), session via iron-session cookie (`SESSION_SECRET`). `src/lib/session.ts` gates the `src/app/(authed)/` route group; API routes call `isAuthed()` themselves.

**Prisma client is generated to `src/generated/prisma`** (not `node_modules`), imported as `@/generated/prisma/client`. `src/lib/prisma.ts` wires the SQLite adapter and enforces the Postgres-portability rule (throws on non-`file:` URLs until you swap the adapter). SQLite has **no enums** — enum-like columns are `String`, and `src/lib/domain.ts` holds the zod unions + Thai labels that are their single source of truth.

**The render pipeline** (`src/lib/render/`) is the heart of the app and runs in four stages:
1. `context.ts` — `buildRenderContext(documentId)` loads the document, resolves which template version to use (see freezing below), and builds a `RenderContext` (all money pre-formatted via `src/lib/money.ts`, dates via `src/lib/dates.ts`). `buildContextFromData(doc, company)` is the exported seam that builds a context from plain in-memory rows — used by the fidelity harness to render variants without touching the DB.
2. `handlebars.ts` — compiles the template source against the context. **Handlebars helper names must not collide with context field names** (a `qty` helper once silently shadowed `{{qty}}`; helpers are prefixed `fmt*`).
3. `html.ts` — `injectFonts()` inlines the CS ChatThai `@font-face` as data URIs so preview iframes and Chromium render identically with zero network fetches.
4. `pdf.ts` — `renderPdf(html)` runs headless Chromium to a **tagged** A4 PDF. It waits for `document.fonts.ready` and for `<html data-paginating>` to clear (multi-page templates set this while their layout script runs; templates without it are a no-op).

**Templates are user-editable code with immutable versioning** (ADR 0003/0004). A `Template` has many immutable `TemplateVersion`s. Each `Document` selects a template (changeable only while a draft) and renders its *latest* version; **issuing (DRAFT → AWAITING) freezes the version into `templateVersionId`** so reprints of an issued business record are byte-identical. Reverting to draft clears the pin. The built-in template's source of truth is the repo file `src/templates/quotation-default.hbs`; `prisma/seed.ts` republishes it as a new version whenever that file changes (runs on every container start), and "restore to default" re-reads it.

**Multi-page rendering is done by an in-template client-side script, not CSS print pagination** (ADR 0005) — headless Chromium's `page.pdf()` does not repeat `<thead>` across pages. The script measures rows and builds A4-height page divs, cloning the header onto each page, pinning signatures to the last page, and adding "หน้าที่ N/M" footers. Whole rows only (no mid-cell splitting).

**Money never uses float/Decimal** (ADR 0001): integer satang, basis points, and thousandths throughout. All rounding lives in `src/lib/calc/engine.ts` (pure, half-away-from-zero, rounded exactly once), with `bahtText.ts` for the spelled-out Thai amount. Totals are computed here and denormalized onto the `Document` row for list views and immutable print history.

**Document numbering** (`src/lib/numbering.ts`) generates per-type numbers from a pattern (e.g. `QT{YYYY}{MM}{DD}{NNNN}`) using a daily counter keyed by an Asia/Bangkok datekey; the uniqueness constraint, not the counter, is the source of truth (create retries on collision).

## Conventions specific to this repo

- All UI/output text is **Thai** (`lang="th"`), FlowAccount vocabulary; dates render CE `dd/MM/yyyy`; timezone is Asia/Bangkok everywhere (use `Intl.DateTimeFormat` with an explicit `timeZone`).
- The template editor is a plain `<textarea>` **by design** (screen-reader preference over a code editor like Monaco).
- Uploads (logo/signature) live under `DATA_DIR`; served through `src/app/api/uploads/[...path]/route.ts`, embedded as data URIs at render time.
- pdfjs pitfall: `getDocument({data})` **detaches** the buffer you pass — always `.slice()`. Reference PDFs decompose `ำ` into `ํ`+`า` — normalize before text comparison.
