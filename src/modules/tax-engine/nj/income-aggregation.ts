/**
 * NJ Income Aggregation — Federal AGI → NJ Taxable Income Base
 * NJ does NOT tax: Social Security, military pensions, NJ government pensions
 * NJ DOES tax: wages, interest, dividends, capital gains, business income
 * Sources: N.J.S.A. 54A:1-2, N.J.A.C. 18:35-1.5
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-1040', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

/** Map central FilingStatus to NJ config key ('qw' -> 'hoh') */
export function toNJFilingStatus(fs: FilingStatus): 'single' | 'mfj' | 'mfs' | 'hoh' {
  if (fs === 'qw') return 'hoh';
  return fs as 'single' | 'mfj' | 'mfs' | 'hoh';
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NJExemptIncome {
  socialSecurity: number;
  militaryPension: number;
  njGovPension: number;
  otherExempt: number;
}

export interface NJIncomeAggregationInput {
  federalAGI: number;
  wages: number;
  interest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
 businessIncome: number;
 filingStatus: FilingStatus;
 exemptIncome: NJExemptIncome;
}

export interface NJIncomeSummary {
  formLines: FormLineMap;
 njGrossIncome: number;
 njExemptTotal: number;
 flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ income starting from federal AGI with NJ-specific modifications.
 * Pure function — no external dependencies, all values from input parameters.
 */
export function aggregateNJIncome(input: NJIncomeAggregationInput): NJIncomeSummary {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // Line A: Federal AGI (starting point)
  lines['L_A'] = makeLine(input.federalAGI, 'Federal AGI (starting point)', 'L_A',
    'N.J.S.A. 54A:1-2', 'From federal Form 1040 Line 11');

  // ── NJ-Exempt Income Subtractions ──────────────────────────────────

  const exempt = input.exemptIncome;

  // Social Security — exempt per N.J.S.A. 54A:6-11
  lines['L_B1'] = makeLine(exempt.socialSecurity, 'Social Security benefits (NJ-exempt)', 'L_B1',
    'N.J.S.A. 54A:6-11', 'Not taxable on NJ return');

  // Military pension — exempt per N.J.S.A. 54A:6-10
  lines['L_B2'] = makeLine(exempt.militaryPension, 'Military pension (NJ-exempt)', 'L_B2',
    'N.J.S.A. 54A:6-10', 'Not taxable on NJ return');

  // NJ government pension — exempt per N.J.S.A. 54A:6-9
  lines['L_B3'] = makeLine(exempt.njGovPension, 'NJ government pension (NJ-exempt)', 'L_B3',
    'N.J.S.A. 54A:6-9', 'Not taxable on NJ return');

  // Other exempt income
  lines['L_B4'] = makeLine(exempt.otherExempt, 'Other NJ-exempt income', 'L_B4',
    'N.J.S.A. 54A:6', 'User-reported exempt income');

  // Total NJ-exempt income
  const totalExempt = exempt.socialSecurity + exempt.militaryPension + exempt.njGovPension + exempt.otherExempt;
  lines['L_B'] = makeLine(totalExempt, 'Total NJ-exempt income', 'L_B',
    'N.J.S.A. 54A:6', 'L_B1 + L_B2 + L_B3 + L_B4');

  // ── NJ Income Components (for verification) ────────────────────────

  const totalWages = input.wages;
  lines['L_WAGES'] = makeLine(totalWages, 'Wages, salaries, tips (NJ-taxable)', 'L_WAGES',
    'N.J.S.A. 54A:1-2', 'From W-2 box 1');

  const totalInterest = input.interest;
  lines['L_INTEREST'] = makeLine(totalInterest, 'Taxable interest (NJ-taxable)', 'L_INTEREST',
    'N.J.S.A. 54A:1-2', 'From 1099-INT box 1');

  const totalDividends = input.ordinaryDividends;
  lines['L_DIVIDENDS'] = makeLine(totalDividends, 'Ordinary dividends (NJ-taxable)', 'L_DIVIDENDS',
    'N.J.S.A. 54A:1-2', 'From 1099-DIV box 1a');

  const totalCapGains = input.shortTermCapitalGains + input.longTermCapitalGains;
  lines['L_CAPGAINS'] = makeLine(totalCapGains, 'Net capital gains (NJ-taxable)', 'L_CAPGAINS',
    'N.J.S.A. 54A:1-2', 'Short-term + long-term from 1099-B');

  lines['L_BUSINESS'] = makeLine(input.businessIncome, 'Business income (NJ-taxable)', 'L_BUSINESS',
    'N.J.S.A. 54A:1-2', 'From Schedule C');

  // ── NJ Gross Income ────────────────────────────────────────────────

  // NJ gross income = Federal AGI - NJ-exempt income
  const njGrossIncome = Math.max(0, input.federalAGI - totalExempt);
  lines['L_C'] = makeLine(njGrossIncome, 'NJ gross income', 'L_C',
    'N.J.S.A. 54A:1-2', `Federal AGI($${input.federalAGI}) - NJ-exempt($${totalExempt})`);

  // ── Flagging ──────────────────────────────────────────────────────

  if (totalExempt > 0 && totalExempt > input.federalAGI * 0.5) {
    flags.push({
      fieldPath: 'nj.exemptIncome', value: totalExempt,
      reason: `NJ-exempt income ($${totalExempt}) exceeds 50% of federal AGI ($${input.federalAGI}). Verify exempt income classifications.`,
      sourceSection: 'N.J.S.A. 54A:6', needsHumanReview: true,
    });
  }

  if (njGrossIncome < 0) {
    flags.push({
      fieldPath: 'nj.njGrossIncome', value: njGrossIncome,
      reason: 'NJ gross income is negative — exempt income may exceed federal AGI. Verify inputs.',
      sourceSection: 'N.J.S.A. 54A:1-2', needsHumanReview: true,
    });
  }

  return {
    formLines: lines,
    njGrossIncome,
    njExemptTotal: totalExempt,
    flags,
  };
}
