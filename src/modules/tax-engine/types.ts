/**
 * Tax Engine — Module Internal Types
 * Not shared across modules. For cross-module types, see src/lib/types.ts.
 */

import type { FilingStatus, FormLineMap, TaxLineItem, TaxCalculationFlag } from '@/lib/types';
import type { FederalTaxConfig } from '@/config/tax-year/2025';

/** Context passed through all calculation functions */
export interface CalculationContext {
  filingStatus: FilingStatus;
  federalConfig: FederalTaxConfig;
  /** Number of qualifying children for CTC/EITC */
  qualifyingChildCount: number;
  /** Whether taxpayer or spouse is 65+ */
  over65Count: number;
  /** Whether taxpayer or spouse is blind */
  blindCount: number;
  /** Earned income for EITC (wages + self-employment) */
  earnedIncome: number;
}

/** Income aggregation result with per-source breakdown */
export interface IncomeSummary {
  /** Total W-2 wages (Form 1040 Line 1) */
  wages: TaxLineItem;
  /** Total interest income (Schedule B) */
  interest: TaxLineItem;
  /** Total ordinary dividends (Schedule B) */
  ordinaryDividends: TaxLineItem;
  /** Total qualified dividends (for preferential rate calc) */
  qualifiedDividends: TaxLineItem;
  /** Total 1099-NEC nonemployee compensation (Schedule 1 Line 8) */
  nonemployeeComp: TaxLineItem;
  /** Total 1099-MISC other income (Schedule 1 Line 8z) */
  otherIncome: TaxLineItem;
  /** Total rental income from 1099-MISC (Schedule E) */
  rentalIncome: TaxLineItem;
  /** Total gross income (wages + all 1099 income) */
  grossIncome: TaxLineItem;
  /** Short-term capital gains from 1099-B */
  shortTermCapitalGains: TaxLineItem;
  /** Long-term capital gains from 1099-B */
  longTermCapitalGains: TaxLineItem;
  /** All flags generated during aggregation */
  flags: TaxCalculationFlag[];
}

/** Deduction comparison result */
export interface DeductionResult {
  /** Standard deduction amount */
  standardDeduction: TaxLineItem;
  /** Itemized deduction amount */
  itemizedDeduction: TaxLineItem;
  /** Chosen deduction amount */
  chosen: TaxLineItem;
  /** Whether itemized was chosen */
  isItemized: boolean;
  /** Schedule A form lines (if itemized) */
  scheduleA: FormLineMap;
}

/** Federal tax calculation result */
export interface FederalTaxResult {
  form1040: FormLineMap;
  schedule1: FormLineMap;
  schedule2: FormLineMap;
  schedule3: FormLineMap;
  scheduleA: FormLineMap;
  scheduleB: FormLineMap;
  scheduleD: FormLineMap;
  schedule8812: FormLineMap;
  flags: TaxCalculationFlag[];
}

/** NJ state tax calculation result */
export interface NJTaxResult {
  nj1040: FormLineMap;
  scheduleA: FormLineMap;
  scheduleB: FormLineMap;
  scheduleC: FormLineMap;
  flags: TaxCalculationFlag[];
}
