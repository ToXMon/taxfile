# Tax Engine Module

## Purpose
Calculate federal and New Jersey state income taxes from extracted document data and taxpayer answers. Produces a `CompleteTaxReturn` with all form line items carrying full trace metadata.

## How It Works

1. **Income Aggregation** — Sum wages (W-2), interest/dividends (1099-INT/DIV), capital gains (1099-B), other income (1099-NEC/MISC) into gross income.
2. **Adjustments** — Apply above-the-line deductions (Schedule 1) to get AGI.
3. **Deduction Resolution** — Compare standard vs itemized (Schedule A), pick the larger.
4. **Tax Calculation** — Apply progressive brackets to taxable income.
5. **Credits** — Calculate CTC, EITC, education credits (Schedule 8812, Schedule 3).
6. **Additional Taxes** — Self-employment tax, NIIT (Schedule 2).
7. **Final Computation** — Total tax minus payments = refund/owed.
8. **NJ State** — Parallel calculation using NJ brackets, deductions, and credits.

## Type Contracts

### Input
- `TaxpayerInfo` (from `src/lib/types.ts`) — filing status, dependents, address
- `ExtractedDocument[]` — mapped fields from document-extraction module
- `AdditionalAnswers` — user-provided values not on documents

### Output
- `CompleteTaxReturn` — contains `FederalForms`, `NJForms`, `TaxSummary`, `TaxCalculationFlag[]`
- Each form is a `FormLineMap` (Record<string, TaxLineItem>)
- Every `TaxLineItem` has `source` (docId, formType, boxNumber) and `trace` (IRS pub section)

### Config Input (never hardcoded)
- `FEDERAL_TAX_2025` — brackets, standard deductions per filing status
- `NJ_TAX_2025` — NJ brackets, property tax deduction cap, NJ EITC rate
- `CREDITS_2025` — CTC, EITC, education, child care credit parameters

All from `src/config/tax-year/2025/index.ts`.

## Dependencies

### Internal
- `src/lib/types.ts` — CompleteTaxReturn, FederalForms, NJForms, TaxLineItem, TaxCalculationFlag, TaxSummary
- `src/config/tax-year/2025/` — all tax amounts, brackets, credit limits

### No Cross-Module Imports
This module does NOT import from document-extraction, forms-generation, or user-flow. Receives data through function parameters typed against shared types.

## File Structure Plan

``
tax-engine/
├── AGENTS.md
├── types.ts              # Module-internal calculation types
├── federal/
│   ├── AGENTS.md
│   ├── income.ts         # W-2 wages + 1099 income aggregation
│   ├── schedule-b.ts     # Interest & dividend detail
│   ├── schedule-1.ts     # Additional income & adjustments
│   ├── schedule-d.ts     # Capital gains calculation
│   ├── deductions.ts     # Standard vs itemized resolver
│   ├── schedule-a.ts     # Itemized deductions detail
│   ├── form-1040.ts      # Core 1040: taxable income + tax from brackets
│   ├── schedule-2.ts     # Additional taxes (SE, NIIT)
│   ├── schedule-3.ts     # Additional credits & payments
│   ├── ctc.ts            # Child Tax Credit + Schedule 8812
│   └── credits.ts        # EITC + education credits
├── nj/
│   ├── AGENTS.md
│   ├── income.ts         # NJ gross income
│   ├── deductions.ts     # NJ standard/itemized/property tax
│   ├── tax.ts            # NJ tax from brackets
│   └── credits.ts        # NJ EITC, other NJ credits
└── index.ts              # Public API: calculateFederalTax(), calculateNJTax()
```

## Module-Specific Standards

- **Pure functions** — all calculations are pure TypeScript, no side effects, no external libraries
- **No `any` types** — use `unknown` + explicit cast when needed
- **Config over literals** — every dollar amount comes from `src/config/tax-year/2025/` config files
- **Traceability** — every TaxLineItem has `trace.irsPublication` or `trace.njTaxCode` populated
- **Flag uncertainty** — ambiguous calculations produce a `TaxCalculationFlag` with `needsHumanReview: true`
- **No PII** — SSNs never appear in calculation logs; use `taxpayer.ssnMasked` only for display
- **File limit** — 300 lines max per file; split calculation sub-steps into separate files
- **Directory limit** — 20 files max per directory; use federal/, nj/, credits/, deductions/ subdirs
