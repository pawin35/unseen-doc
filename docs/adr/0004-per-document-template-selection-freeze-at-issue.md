# 0004 — Documents select a template; the version freezes at issue

Date: 2026-07-11
Status: Accepted (supersedes the pin-timing and reprint-choice parts of [ADR 0003](0003-template-version-pinning-ask-at-reprint.md))

## Context

ADR 0003 pinned a document's template version lazily, at first PDF print, and offered a pinned-vs-latest choice when reprinting. Two gaps emerged in use:

- The user maintains **multiple** templates per DocType (creatable via "บันทึกเป็นแบบฟอร์มใหม่") but a document could never be pointed at one — it always resolved to the built-in.
- The pinned-vs-latest reprint choice was unwanted; the real need is to **switch a document's template** and have it re-pin to the new template's current version.

The core value of ADR 0003 still holds: an **issued** quotation is a business record whose reprints must not silently change.

## Decision

A `Document` carries a **Selected Template** (`templateId`, defaults to the built-in) alongside the frozen pin (`templateVersionId`).

- **While a draft** (`status = DRAFT`): the document renders its Selected Template's **active (latest) version**; `templateVersionId` is null. The template is freely changeable on the document form.
- **At issue** (DRAFT → AWAITING): the Selected Template's current active version is written to `templateVersionId` — the pin **freezes**.
- **After issue**: the template selector is locked; every print/reprint uses the frozen pin (byte-identical).
- **Revert** (AWAITING → DRAFT): `templateVersionId` is cleared, reopening the document to dynamic-latest rendering and template changes. Re-issuing re-freezes at the then-current version.

Render resolution order: frozen `templateVersion` → Selected Template's `activeVersion` → built-in active version (legacy/fallback). The `?version=pinned|latest` request parameter and the pinned-vs-latest reprint links are **removed**.

## Consequences

- Documents can use any template in the library; switching a draft re-pins on save.
- Issued documents remain reproducible; the freeze happens at the business-record boundary (issue) instead of at first print.
- Reverting to draft is an explicit "reopen": a subsequent re-issue may freeze a newer version than the first issue did. This is intended.
- Legacy documents (created before this change, `templateId` null) fall through to the built-in's latest version — unchanged behavior.
- A template cannot be deleted while any document pins one of its versions **or** selects it as a draft (`deleteTemplate` guard).
- Retained from ADR 0003: template versions are immutable, and `src/templates/quotation-default.hbs` is the built-in's source of truth.
