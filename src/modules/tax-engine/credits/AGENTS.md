# Tax Engine — Credits Submodule

## Purpose
Implements federal tax credit calculations including Child Tax Credit (Schedule 8812),
Earned Income Tax Credit, and Education Credits (AOTC/LLC).

## How It Works
Each credit is a pure TypeScript function that accepts config via dependency injection.
All monetary values come from `src/config/tax-year/2025/credits.ts`.
Each function returns a FormLineMap keyed by Schedule line numbers (e.g., `L1`, `L2`).

## Type Contracts
- **Inputs**: Config types from `@/config/tax-year/2025` + FilingStatus from `@/lib/types`
- **Outputs**: `FormLineMap` (per-schedule lines) + `TaxCalculationFlag[]` for ambiguities

## Standards
- No `any` types — use `unknown` + cast if needed
- Every TaxLineItem must have `source.formType`, `source.boxNumber`, and `trace` fields
- Flag ambiguities with `TaxCalculationFlag { needsHumanReview: true }`
- File limit: 300 lines. Split into sub-files if approaching limit.

## Dependencies
- `@/lib/types` — TaxLineItem, FormLineMap, TaxCalculationFlag, FilingStatus
- `@/config/tax-year/2025` — Credit configuration values (never hardcode amounts)
- No cross-imports with other tax-engine submodules
