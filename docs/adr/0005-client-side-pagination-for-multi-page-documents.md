# 0005 — Multi-page documents paginate in the template with a client-side script

Date: 2026-07-12
Status: Accepted

## Context

The quotation template was a single fixed A4 `.page` div with `overflow: hidden`; anything past one page (a long line-item list or a long หมายเหตุ remark) was silently clipped. The reference documents flow onto multiple pages, repeating the full document header and the item-column header on every page, printing "หน้าที่ N/M" per page, and pinning the signature block to the bottom of the **last** page (see `reference/example_qt_long_remark_and_list.pdf`).

The obvious CSS mechanism — put the repeating header in a `<thead>` and let the print engine repeat it — **does not work in our pipeline**. Rendering is done by Playwright's headless Chromium `page.pdf()` (ADR 0002), which does not repeat `table-header-group`/`table-footer-group` across printed pages (verified empirically). `position: fixed` elements *do* repeat per page, but a fixed header cannot reserve per-page space for flowing content without dynamic `@page` margins, and mixing `@page` margins with the JS-driven signature/footer positioning we need creates an intractable body-coordinate-to-page mapping.

## Decision

The built-in template renders all content as one continuous flow, then a small inline `<script>` (running after `document.fonts.ready`) **builds the pages itself**:

- It measures the document header, each item row, the totals+remark tail, and the signature block, then packs whole rows into A4-height `.page` divs, cloning the header into each page.
- The totals+remark tail and the signature block are placed on the last page; the signature block is absolutely pinned to that page's bottom. "หน้าที่ N/M" footers are added only when there are 2+ pages.
- **Rows are never split mid-cell.** A row that doesn't fit moves whole to the next page. This is the one deliberate deviation from the reference layout, which splits a row's description across the page boundary; a dense document may therefore use one more page than the reference would. This was chosen over the substantial complexity (and fragility on unstructured descriptions) of client-side mid-row text splitting.

The script marks `<html data-paginating>` while it runs and clears it when done. `renderPdf` waits for the attribute to clear (bounded timeout) before generating the PDF. Templates without the script never set the attribute, so the wait is a no-op — **older pinned template versions still render unchanged** (ADR 0004).

## Consequences

- Multi-page quotations render correctly in headless Chromium without relying on unsupported print-pagination features; the header repeats, page numbers are correct, and signatures sit at the bottom of the last page.
- Single-page documents (the common case) are unaffected and remain pixel-accurate to `reference/example_qt.pdf`.
- The on-screen preview iframes show a continuous strip rather than discrete pages (the pagination is tuned for print geometry); the PDF is the fidelity target.
- Custom user templates may omit the script entirely (single-page) or adopt the same `data-paginating` contract; `renderPdf` supports both.
- Fidelity is guarded by `scripts/compare-fidelity.ts`, which now covers four scenarios (base, remark+WHT, remark without WHT, and the long 2-vs-3-page stress doc) with per-page text assertions and a repeating-header check.
