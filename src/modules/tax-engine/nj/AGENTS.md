# Tax Engine — NJ State Submodule

## Purpose
Implements New Jersey state income tax calculations for NJ-1040 and schedules.
NJ has progressive brackets with NO standard deduction — uses federal standard or itemized.

## How It Works
Starts from federal AGI, applies NJ-specific modifications:
- **Subtracts**: NJ-exempt income (Social Security, military pensions, NJ government pensions)
- **Adds back**: Federal-exempt income that NJ taxes (rare — NJ generally follows federal exemptions)
- **Calculates**: NJ tax using marginal brackets from `src/config/tax-year/2025/nj-brackets.ts`
- **Credits**: NJ EITC (40% of federal EITC per N.J.S.A. 54A:4-7.1), property tax credit

## Type Contracts
- **Inputs**: Federal AGI + exempt income amounts, FilingStatus, NJ config from `@/config/tax-year/2025`
- **Outputs**: `NJTaxResult` with `nj1040: FormLineMap`, schedules, and `TaxCalculationFlag[]`

## Standards
- No `any` types — use `unknown` + cast if needed
- Every TaxLineItem: `source.formType` = 'NJ-1040', `trace.njTaxCode` populated
- All monetary values from config files — no hardcoded amounts
- File limit: 300 lines. Directory limit: 20 files.

## Dependencies
- `@/lib/types` — TaxLineItem, FormLineMap, TaxCalculationFlag, FilingStatus
- `@/config/tax-year/2025/nj-brackets` — NJ brackets, property tax deduction/credit config
- `@/config/tax-year/2025/credits` — NJ EITC percentage
- No cross-imports with federal/ submodule (they share types via @/lib/types only)

## NJ-Specific Notes
- NJ does NOT have a standard deduction — uses federal standard or itemized
- Property tax deduction: capped at $1,000 OR 25% credit on property tax over $100 threshold, max $500
- SALT cap ($10,000) applies on federal return only — NJ does not cap on state return
- NJ filing statuses: single, mfj, mfs, hoh (same as federal minus 'qw')
