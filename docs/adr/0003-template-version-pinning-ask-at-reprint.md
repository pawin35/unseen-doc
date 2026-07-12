# 0003 — Template versions are immutable; documents pin a version; reprint asks pinned-vs-latest

Date: 2026-07-11
Status: Accepted — **partially superseded by [ADR 0004](0004-per-document-template-selection-freeze-at-issue.md)**

> **Superseded parts:** the *pin-at-first-print* timing and the *pinned-vs-latest reprint choice* are replaced by ADR 0004 (per-document template selection; pin frozen at issue; no reprint choice). Still in force: template versions are immutable, deletion is guarded by document references, and the built-in's source of truth is the repo file.

## Context

Templates are user-editable, but a quotation already sent to a customer is a business record: a reprint that silently differs from what the customer received is a correctness problem. At the same time, the user sometimes *wants* reprints to pick up template fixes. A single mutable template per type cannot satisfy both.

## Decision

Every save of a template creates a new immutable `TemplateVersion`; the parent `Template` tracks an active version. At a document's first print, the version used is pinned to the document. Reprinting offers an explicit choice: the pinned version (byte-identical to the original) or the latest active version (optionally re-pinning). "Restore to default" is just another new version on the read-only built-in Template, sourced from the repo file.

## Consequences

- Reprints are reproducible by default; template evolution never corrupts history.
- Old versions accumulate; deletion is only safe for versions no document pins (enforce via relation).
- The built-in template's source of truth is the repo file `src/templates/quotation-default.hbs`, so fidelity fixes ship as code.
