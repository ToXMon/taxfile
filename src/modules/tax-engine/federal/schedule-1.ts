/**
 * Schedule 1 — Additional Income and Adjustments to Income
 * Part I: Additional income (NEC, other income, capital gains from Sch D)
 * Part II: Adjustments (educator, IRA, student loan, HSA, alimony)
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag, AdditionalAnswers } from '@/lib/types';
import type { IncomeSummary } from '../types';
import type { StudentLoanInterestConfig, EducatorExpenseConfig } from '@/config/tax-year/2025';

// ─── Types ──────────────────────────────────────────────────────────

export interface Schedule1Result {
  formLines: FormLineMap;
  totalAdditionalIncome: TaxLineItem;
  totalAdjustments: TaxLineItem;
  flags: TaxCalculationFlag[];
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Normalize filing status to config keys (qw -> hoh) */
function toConfigStatus(fs: FilingStatus): 'mfj' | 'other' {
  return fs === 'mfj' ? 'mfj' : 'other';
}

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value),
    label,
    source: { documentId: 'CALCULATED', formType: '1040-S1', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

// ─── Student Loan Interest Phase-Out ────────────────────────────────

/**
 * Calculate allowable student loan interest deduction with phase-out.
 * IRC §221(d): deduction reduced ratably over $30,000 range.
 * Uses wages as MAGI proxy (MAGI = AGI before this deduction, approximated by gross income - adjustments above).
 *
 * @param paid - Amount of student loan interest paid
 * @param magiProxy - Modified AGI proxy (wages + NEC as approximation)
 * @param config - Student loan interest config with phase-out thresholds
 * @returns Allowable deduction amount
 */
function calculateStudentLoanDeduction(
  paid: number,
  magiProxy: number,
  config: StudentLoanInterestConfig,
  filingStatus: FilingStatus,
): { deduction: number; flag?: TaxCalculationFlag } {
  if (paid <= 0) return { deduction: 0 };

  const status = toConfigStatus(filingStatus);
  const phaseOutStart = status === 'mfj' ? config.phaseOutStartMfj : config.phaseOutStartOther;
  const phaseOutEnd = status === 'mfj' ? config.phaseOutEndMfj : config.phaseOutEndOther;

  if (magiProxy <= phaseOutStart) {
    return { deduction: Math.min(paid, config.maxDeduction) };
  }

  if (magiProxy >= phaseOutEnd) {
    return {
      deduction: 0,
      flag: {
        fieldPath: 'schedule1.L21',
        value: 0,
        reason: `MAGI proxy ($${magiProxy}) exceeds phase-out end ($${phaseOutEnd}) — no deduction allowed`,
        sourceSection: config.source,
        needsHumanReview: true,
      },
    };
  }

  // Linear phase-out over the range
  const phaseOutRange = phaseOutEnd - phaseOutStart;
  const excess = magiProxy - phaseOutStart;
  const reductionFraction = excess / phaseOutRange;
  const reducedMax = Math.round(config.maxDeduction * (1 - reductionFraction));
  const deduction = Math.min(paid, reducedMax);

  return { deduction };
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate Schedule 1 — Additional Income and Adjustments.
 *
 * @param income - IncomeSummary from aggregateIncome()
 * @param answers - AdditionalAnswers from user input
 * @param filingStatus - Taxpayer filing status
 * @param studentLoanConfig - Student loan interest config (from CREDITS_2025.adjustments)
 * @param educatorConfig - Educator expense config (from CREDITS_2025.adjustments)
 * @param scheduleDNetGain - Net capital gain from Schedule D (0 if not yet calculated)
 */
export function calculateSchedule1(
  income: IncomeSummary,
  answers: AdditionalAnswers,
  filingStatus: FilingStatus,
  studentLoanConfig: StudentLoanInterestConfig,
  educatorConfig: EducatorExpenseConfig,
  scheduleDNetGain: number = 0,
): Schedule1Result {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Part I: Additional Income ─────────────────────────────────────

  // Line 8: Taxable income from 1099-NEC (nonemployee compensation)
  lines['L8'] = makeLine(
    income.nonemployeeComp.value,
    'Nonemployee compensation (1099-NEC)',
    'L8', 'IRS Schedule 1 Line 8',
    `From ${income.nonemployeeComp.source.documentId}`,
  );

  // Line 8z: Other income (MISC other + user-reported other)
  const otherIncomeTotal = Math.round(income.otherIncome.value + answers.otherIncome);
  lines['L8z'] = makeLine(
    otherIncomeTotal,
    'Other income',
    'L8z', 'IRS Schedule 1 Line 8z',
    `1099-MISC box 3 ($${income.otherIncome.value}) + user-reported ($${answers.otherIncome})`,
  );

  // Line 9: Total additional income before Sch D (placeholder for other lines 4-7)
  const additionalBeforeSchD = lines['L8'].value + lines['L8z'].value;
  lines['L9'] = makeLine(additionalBeforeSchD, 'Subtotal (L8 + L8z)', 'L9', 'IRS Schedule 1 Line 9');

  // Line 10: Total additional income (including Sch D net gain)
  const totalAdditionalIncome = Math.round(additionalBeforeSchD + scheduleDNetGain);
  lines['L10'] = makeLine(
    totalAdditionalIncome,
    'Total additional income',
    'L10', 'IRS Schedule 1 Line 10',
    `L9 + Schedule D net gain ($${scheduleDNetGain})`,
  );

  const totalAdditionalIncomeItem = makeLine(
    totalAdditionalIncome, 'Total additional income', 'L10', 'IRS Schedule 1 Line 10',
  );

  // ── Part II: Adjustments to Income ────────────────────────────────

  // Line 19: Educator expenses (max $300, no phase-out)
  const educatorDeduction = Math.min(answers.educatorExpenses, educatorConfig.maxDeduction);
  lines['L19'] = makeLine(
    educatorDeduction,
    'Educator expenses',
    'L19', educatorConfig.source,
    `Min of paid ($${answers.educatorExpenses}) and max ($${educatorConfig.maxDeduction})`,
  );

  // Line 20: IRA deduction
  lines['L20'] = makeLine(
    answers.iraContributions,
    'IRA deduction',
    'L20', 'IRC §219',
    `User-reported: $${answers.iraContributions}`,
  );

  // Line 21: Student loan interest deduction (with phase-out)
  const magiProxy = Math.round(income.wages.value + income.nonemployeeComp.value);
  const { deduction: slDeduction, flag: slFlag } = calculateStudentLoanDeduction(
    answers.studentLoanInterestPaid, magiProxy, studentLoanConfig, filingStatus,
  );
  if (slFlag) flags.push(slFlag);
  lines['L21'] = makeLine(
    slDeduction,
    'Student loan interest deduction',
    'L21', studentLoanConfig.source,
    `Paid: $${answers.studentLoanInterestPaid}, MAGI proxy: $${magiProxy}`,
  );

  // Line 23: HSA deduction
  lines['L23'] = makeLine(
    answers.hsaContributions,
    'HSA deduction',
    'L23', 'IRC §223',
    `User-reported: $${answers.hsaContributions}`,
  );

  // Line 24: Alimony paid (pre-2019 divorces only — flag for review)
  let alimonyDeduction = 0;
  if (answers.alimonyPaid > 0) {
    alimonyDeduction = answers.alimonyPaid;
    flags.push({
      fieldPath: 'schedule1.L24',
      value: alimonyDeduction,
      reason: 'Alimony deduction only allowed for divorces finalized before 2019 (TCJA elimination) — verify divorce date',
      sourceSection: 'IRC §215 (repealed by TCJA for post-2018 agreements)',
      needsHumanReview: true,
    });
  }
  lines['L24'] = makeLine(alimonyDeduction, 'Alimony paid', 'L24', 'IRC §215', 'Flagged: verify pre-2019 divorce');

  // Line 26: Total adjustments
  const totalAdjustments = Math.round(
    lines['L19'].value + lines['L20'].value + lines['L21'].value
    + lines['L23'].value + lines['L24'].value + answers.otherAdjustments,
  );
  lines['L26'] = makeLine(
    totalAdjustments,
    'Total adjustments to income',
    'L26', 'IRS Schedule 1 Line 26',
    'Sum of L19 + L20 + L21 + L23 + L24 + other adjustments',
  );

  const totalAdjustmentsItem = makeLine(
    totalAdjustments, 'Total adjustments to income', 'L26', 'IRS Schedule 1 Line 26',
  );

  return {
    formLines: lines,
    totalAdditionalIncome: totalAdditionalIncomeItem,
    totalAdjustments: totalAdjustmentsItem,
    flags,
  };
}
