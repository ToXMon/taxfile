/**
 * NJ Schedule A — Itemized Deductions (NJ-Specific Rules)
 * Key differences from federal:
 *   - Medical expenses: 2% of income floor (not 7.5% federal)
 *   - Miscellaneous expenses: 2% of income floor
 *   - Property taxes: separated for deduction vs credit election
 *   - No SALT cap on NJ state return (federal $10,000 cap applies only federally)
 * Sources: N.J.S.A. 54A:3-1 through 54A:3-6, NJ-1040 Instructions Schedule A
 */

import type { FormLineMap, TaxLineItem, TaxCalculationFlag } from '@/lib/types';
import type { NJTaxConfig } from '@/config/tax-year/2025';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-SCH-A', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NJScheduleAInput {
  njGrossIncome: number;
  federalStandardDeduction: number;
  federalItemizedDeduction: number;
  isFederalItemized: boolean;
  medicalExpenses: number;
  propertyTaxesPaid: number;
  mortgageInterest: number;
  charitableContributions: number;
  miscellaneousExpenses: number;
  casualtyLosses: number;
}

export interface NJScheduleAResult {
  formLines: FormLineMap;
  totalNJItemized: number;
  propertyTaxForDeduction: number;
  propertyTaxForCredit: number;
  chosenDeduction: number;
  isItemized: boolean;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ Schedule A with NJ-specific deduction rules.
 * NJ medical floor is 2% (not federal 7.5%). Property taxes can be
 * taken as deduction OR credit (not both).
 * All NJ-specific thresholds from config (dependency injection).
 */
export function calculateNJScheduleA(input: NJScheduleAInput, config: NJTaxConfig): NJScheduleAResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Line 1: Medical Expenses (2% floor per N.J.S.A. 54A:3-2) ─────
  const medicalFloor = input.njGrossIncome * 0.02;
  const medicalDeduction = Math.max(0, input.medicalExpenses - medicalFloor);
  lines['L1'] = makeLine(input.medicalExpenses, 'Medical and dental expenses', 'L1',
    'N.J.S.A. 54A:3-2', 'Total medical expenses');
  lines['L2'] = makeLine(medicalFloor, '2% of NJ gross income', 'L2',
    'N.J.S.A. 54A:3-2', `2% × $${input.njGrossIncome}`);
  lines['L3'] = makeLine(medicalDeduction, 'Medical deduction (excess over 2%)', 'L3',
    'N.J.S.A. 54A:3-2', `Expenses($${input.medicalExpenses}) - Floor($${Math.round(medicalFloor)})`);

  if (input.medicalExpenses > 0 && medicalDeduction === 0) {
    lines['L3'].flagged = true;
    lines['L3'].flagReason = 'Below 2% NJ gross income floor';
  }

  // ── Line 4: Property Taxes (separated for deduction/credit election) ─
  lines['L4'] = makeLine(input.propertyTaxesPaid, 'Property taxes paid', 'L4',
    'N.J.S.A. 54A:3-3', 'From 1098 box 10 + other property tax payments');

  // Property tax deduction: capped at config.propertyTaxDeductionCap ($1,000)
  const propertyTaxDeduction = Math.min(input.propertyTaxesPaid, config.propertyTaxDeductionCap);
  lines['L5'] = makeLine(propertyTaxDeduction, 'Property tax deduction (capped)', 'L5',
    'N.J.S.A. 54A:3-3', `Min($${input.propertyTaxesPaid}, cap $${config.propertyTaxDeductionCap})`);

  // Property tax credit: 25% of (property tax - $100 threshold), max $500
  const creditBase = Math.max(0, input.propertyTaxesPaid - config.propertyTaxCreditThreshold);
  const propertyTaxCredit = Math.min(
    Math.round(creditBase * config.propertyTaxCreditRate),
    config.propertyTaxCreditMax,
  );
  lines['L6'] = makeLine(propertyTaxCredit, 'Property tax credit (if elected)', 'L6',
    'N.J.S.A. 54A:4A-1', `${Math.round(config.propertyTaxCreditRate * 100)}% × ($${input.propertyTaxesPaid} - $${config.propertyTaxCreditThreshold}), max $${config.propertyTaxCreditMax}`);

  // Flag: credit may be more valuable than deduction
  if (propertyTaxCredit > propertyTaxDeduction && input.propertyTaxesPaid > 0) {
    flags.push({
      fieldPath: 'nj.scheduleA.propertyTaxElection', value: propertyTaxCredit - propertyTaxDeduction,
      reason: `Property tax credit ($${propertyTaxCredit}) exceeds deduction ($${propertyTaxDeduction}). Taxpayer should elect credit instead of deduction.`,
      sourceSection: 'N.J.S.A. 54A:4A-1', needsHumanReview: false,
    });
  }

  // ── Line 7: Mortgage Interest (N.J.S.A. 54A:3-4) ──────────────────
  lines['L7'] = makeLine(input.mortgageInterest, 'Home mortgage interest', 'L7',
    'N.J.S.A. 54A:3-4', 'From 1098 box 1');

  // ── Line 8: Charitable Contributions (N.J.S.A. 54A:3-5) ────────────
  // NJ does NOT have AGI limits on charitable contributions like federal
  lines['L8'] = makeLine(input.charitableContributions, 'Charitable contributions', 'L8',
    'N.J.S.A. 54A:3-5', 'No AGI limitation on NJ return');

  // ── Line 9: Miscellaneous (2% floor per N.J.S.A. 54A:3-6) ─────────
  const miscFloor = input.njGrossIncome * 0.02;
  const miscDeduction = Math.max(0, input.miscellaneousExpenses - miscFloor);
  lines['L9a'] = makeLine(input.miscellaneousExpenses, 'Miscellaneous expenses', 'L9a',
    'N.J.S.A. 54A:3-6', 'Unreimbursed employee expenses, etc.');
  lines['L9b'] = makeLine(miscFloor, '2% of NJ gross income', 'L9b',
    'N.J.S.A. 54A:3-6', `2% × $${input.njGrossIncome}`);
  lines['L9c'] = makeLine(miscDeduction, 'Miscellaneous deduction (excess over 2%)', 'L9c',
    'N.J.S.A. 54A:3-6', `Expenses($${input.miscellaneousExpenses}) - Floor($${Math.round(miscFloor)})`);

  // ── Line 10: Casualty Losses ───────────────────────────────────────
  lines['L10'] = makeLine(input.casualtyLosses, 'Casualty and theft losses', 'L10',
    'N.J.S.A. 54A:3-7', 'Not in 2025 scope — set to 0 unless specified');

  // ── Total NJ Itemized (using property tax deduction, not credit) ───
  const totalNJItemized = Math.round(
    medicalDeduction + propertyTaxDeduction + input.mortgageInterest
    + input.charitableContributions + miscDeduction + input.casualtyLosses,
  );
  lines['L11'] = makeLine(totalNJItemized, 'Total NJ itemized deductions', 'L11',
    'N.J.S.A. 54A:3-1', 'L3 + L5 + L7 + L8 + L9c + L10 (using property tax deduction)');

  // ── Standard vs Itemized Comparison ───────────────────────────────
  // NJ uses federal standard or itemized as the base comparison
  const federalDeduction = input.isFederalItemized
    ? input.federalItemizedDeduction
    : input.federalStandardDeduction;

  lines['L12'] = makeLine(federalDeduction, 'Federal deduction (standard or itemized)', 'L12',
    'N.J.S.A. 54A:2-1', input.isFederalItemized ? 'Federal itemized from Schedule A' : 'Federal standard deduction');

  // NJ taxpayer chooses: federal deduction OR NJ itemized (whichever is larger)
  const isItemized = totalNJItemized > federalDeduction;
  const chosenDeduction = isItemized ? totalNJItemized : federalDeduction;
  lines['L13'] = makeLine(chosenDeduction, 'NJ deduction (greater of federal or NJ itemized)', 'L13',
    'N.J.S.A. 54A:2-1', isItemized
      ? `NJ itemized($${totalNJItemized}) > federal($${federalDeduction})`
      : `Federal($${federalDeduction}) >= NJ itemized($${totalNJItemized})`);

  return {
    formLines: lines,
    totalNJItemized,
    propertyTaxForDeduction: propertyTaxDeduction,
    propertyTaxForCredit: propertyTaxCredit,
    chosenDeduction,
    isItemized,
    flags,
  };
}
