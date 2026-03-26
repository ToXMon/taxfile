# Federal Tax Engine Submodule

## Purpose
Calculate federal income tax per IRS 2025 rules. Produces `FederalTaxResult` with all schedule FormLineMaps.

## How It Works
1. **Income Aggregation** — Sum all document income sources into `IncomeSummary`
2. **Schedule B** — Detail interest and dividend sources if totals exceed thresholds
3. **Schedule 1** — Additional income (NEC, MISC) and adjustments (student loan, IRA, etc.)
4. **Schedule D** — Capital gains from 1099-B transactions
5. **Deduction Resolution** — Standard vs itemized comparison
6. **Schedule A** — Itemized deductions (SALT capped, mortgage interest, charity)
7. **Form 1040** — Taxable income + tax from brackets
8. **Schedule 2** — Additional taxes (self-employment, NIIT)
9. **Schedule 3** — Non-refundable credits, other payments
10. **CTC + 8812** — Child Tax Credit calculation with phase-out
11. **Credits** — EITC, education credits (AOTC, LLC)

## Type Contracts

### Input
- `ExtractedDocument[]` — all uploaded documents with mapped fields
- `AdditionalAnswers` — user-provided values
- `CalculationContext` — filing status, config, dependent counts

### Output per File
- `income-aggregation.ts` → `IncomeSummary`
- `schedule-b.ts` → `FormLineMap` (Schedule B lines)
- `schedule-1.ts` → `FormLineMap` (Schedule 1 lines)
- `schedule-d.ts` → `FormLineMap` (Schedule D lines)
- `deductions.ts` → `DeductionResult`
- `schedule-a.ts` → `FormLineMap` (Schedule A lines)
- `form-1040.ts` → `FormLineMap` (1040 lines)
- `schedule-2.ts` → `FormLineMap` (Schedule 2 lines)
- `schedule-3.ts` → `FormLineMap` (Schedule 3 lines)
- `ctc.ts` → `{ schedule8812: FormLineMap; credit: TaxLineItem }`
- `credits.ts` → `{ eitc: TaxLineItem; education: TaxLineItem[] }`

## Module-Specific Standards

- All dollar amounts from `FEDERAL_TAX_2025` config — zero hardcoded literals
- Every TaxLineItem has `trace.irsPublication` with specific IRC section or IRS form reference
- Rounding: `Math.round()` to nearest dollar for all intermediate and final values
- Source tracing: `source.documentId`, `source.formType`, `source.boxNumber` on every TaxLineItem
- Flag ambiguous calculations via `TaxCalculationFlag` with `needsHumanReview: true`
- Pure functions only — no side effects, no DB access, no logging of PII
