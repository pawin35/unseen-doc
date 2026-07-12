# 0002 — Document templates are HTML + Handlebars, rendered to PDF by headless Chromium

Date: 2026-07-11
Status: Accepted

## Context

The user is blind and must be able to read and edit document templates as code with a screen reader. The output PDF must visually match FlowAccount's real output (`reference/example_qt.pdf`) for identical input, on A4, in Thai (CS ChatThai), including complex Thai line breaking. Alternatives considered: Typst (clean source but hand-translating FlowAccount's layout pixel-for-pixel is hard and it's a niche language), @react-pdf/pdfmake (weak Thai line breaking, limited layout primitives), LaTeX (heavyweight, unpleasant source).

## Decision

A template is a complete HTML document with embedded CSS and Handlebars placeholders, stored as text. Rendering: build context → Handlebars → inject `lang="th"` shell + `@font-face` fonts and images as base64 data URIs → Playwright headless Chromium `page.pdf({ format: 'A4', tagged: true, printBackground: true, preferCSSPageSize: true })`. The same HTML powers the in-app preview iframe, so preview and PDF cannot drift.

## Consequences

- Templates are plain text: linear, screen-reader-friendly, diff-able, safe to evaluate (no arbitrary code execution — Handlebars only).
- The server needs Chromium (Playwright); the Docker image is pinned to the matching `mcr.microsoft.com/playwright` base.
- PDFs are structure-tagged (accessible) but not full PDF/UA; document language relies on `lang="th"`.
- Data URIs make rendering self-contained — no HTTP fetches from the render page.
