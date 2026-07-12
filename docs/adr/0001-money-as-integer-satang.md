# 0001 — Money as integer satang, rates as basis points

Date: 2026-07-11
Status: Accepted

## Context

The app must run on SQLite today and swap to Postgres via a Prisma datasource change only. Prisma's `Decimal` type on SQLite is backed by floating-point numeric affinity — precision is not guaranteed and behavior differs from Postgres `numeric`. Financial documents cannot tolerate rounding drift, and calculation results must be reproducible byte-for-byte on reprints.

## Decision

Store all money as integer satang (`*Satang` columns), all percentages as integer basis points (`*Bp`, 700 = 7%), and quantities as integer thousandths (`qtyThousandths`, 1500 = 1.5). No `Decimal` or `Float` anywhere in the schema. All arithmetic and rounding happen in one pure module (`src/lib/calc/engine.ts`), rounding half away from zero to whole satang at exactly one site per figure.

## Consequences

- Identical behavior on SQLite and Postgres; the datasource swap needs no data or code changes.
- Formatting (comma-grouped, 2 dp) is a display concern in render helpers, never in storage.
- Every new numeric field must follow the naming convention so the unit is visible at the type level.
