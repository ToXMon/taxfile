/**
 * Schedule 3 — Additional Credits and Payments
 * Part I: Non-refundable credits (child care, AOTC, LLC, foreign tax)
 * Part II: Other payments (excess SS withheld, extension payments)
 */

import type { TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';
import type { EducationCreditConfig, ChildCareCreditConfig } from '@/config/tax-year/2025';
import type { FilingStatus } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface Schedule3Result {
  formLines: FormLineMap;
  totalNonRefundableCredits: number;
  totalPayments: number;
  flags: TaxCalculationFlag[];
}

export interface EducationInputs {
  aotcStudents: number;
  llcStudents: number;
  aotcExpenses: number;
  llcExpenses: number;
  childCareQualifyingPersons: number;
  childCareExpenses: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: '1040-S3', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

function toConfigFS(fs: FilingStatus): 'mfj' | 'other' {
  return fs === 'mfj' ? 'mfj' : 'other';
}

/** AOTC expense cap per student per IRC §25A(c)(2)(B) */
const AOTC_EXPENSE_CAP_PER_STUDENT = 4000;

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate Schedule 3 — Additional Credits and Payments.
 */
export function calculateSchedule3(
  inputs: EducationInputs,
  agi: number,
  filingStatus: FilingStatus,
  eduConfig: EducationCreditConfig,
  ccConfig: ChildCareCreditConfig,
): Schedule3Result {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Part I: Non-Refundable Credits ──────────────────────────────────

  // Line 2: Child and Dependent Care Credit (IRC §21)
  const ccStatus = toConfigFS(filingStatus);
  const ccPhaseStart = ccStatus === 'mfj' ? ccConfig.phaseOutStartMfj : ccConfig.phaseOutStartSingle;
  const ccPhaseEnd = ccStatus === 'mfj' ? ccConfig.phaseOutEndMfj : ccConfig.phaseOutEndSingle;
  const ccMaxExpense = inputs.childCareQualifyingPersons >= 2 ? ccConfig.maxExpenseTwoPlus : ccConfig.maxExpenseOneChild;
  const ccEligibleExpense = Math.min(inputs.childCareExpenses, ccMaxExpense);

  let ccRate = ccConfig.maxRate;
  if (agi > ccPhaseEnd) {
    ccRate = ccConfig.minRate;
  } else if (agi > ccPhaseStart) {
    const phaseRange = ccPhaseEnd - ccPhaseStart;
    const excess = agi - ccPhaseStart;
    const reduction = (excess / phaseRange) * (ccConfig.maxRate - ccConfig.minRate);
    ccRate = Math.max(ccConfig.minRate, ccConfig.maxRate - reduction);
  }
  const childCareCredit = Math.round(ccEligibleExpense * ccRate);
  lines['L2'] = makeLine(childCareCredit, 'Child and dependent care credit', 'L2', ccConfig.source,
    `Expense: $${ccEligibleExpense}, Rate: ${Math.round(ccRate * 100)}% (AGI: $${agi})`);

  // Line 3: AOTC (IRC §25A(c)) — 25% of first $4,000 expenses per student, max $2,500
  const aotcPerStudent = Math.min(inputs.aotcExpenses / Math.max(1, inputs.aotcStudents), AOTC_EXPENSE_CAP_PER_STUDENT);
  const aotcTotal = Math.min(
    Math.round(aotcPerStudent * inputs.aotcStudents * 0.25),
    eduConfig.aotc.maxAmount * inputs.aotcStudents,
  );
  const aotcRefundable = Math.round(aotcTotal * eduConfig.aotc.refundablePercent);
  const aotcNonRefundable = aotcTotal - aotcRefundable;
  lines['L3'] = makeLine(aotcNonRefundable, 'American Opportunity Credit (non-refundable portion)', 'L3', eduConfig.aotc.source,
    `Total: $${aotcTotal} (${inputs.aotcStudents} student(s)), Refundable: $${aotcRefundable}`);

  if (inputs.aotcStudents > eduConfig.aotc.maxYears) {
    flags.push({
      fieldPath: 'schedule3.L3', value: aotcTotal,
      reason: `AOTC claimed for ${inputs.aotcStudents} student(s) but max ${eduConfig.aotc.maxYears} years per student — verify eligibility`,
      sourceSection: eduConfig.aotc.source, needsHumanReview: true,
    });
  }

  // Line 4: Lifetime Learning Credit (IRC §25A(d)) — 20% of expenses, max $2,000 total
  const llcTotal = Math.min(
    Math.round(inputs.llcExpenses * 0.20),
    eduConfig.llc.maxAmount,
  );
  lines['L4'] = makeLine(llcTotal, 'Lifetime Learning Credit', 'L4', eduConfig.llc.source,
    `20% of $${inputs.llcExpenses}, capped at $${eduConfig.llc.maxAmount}`);

  // AOTC/LLC mutual exclusivity per student (IRC §25A(d)(4))
  if (inputs.aotcStudents > 0 && inputs.llcStudents > 0) {
    flags.push({
      fieldPath: 'schedule3.L3_L4', value: aotcNonRefundable + llcTotal,
      reason: 'AOTC and LLC claimed for different students — allowed per IRC §25A(d)(4), but verify no overlap per student',
      sourceSection: 'IRC §25A(d)(4)', needsHumanReview: true,
    });
  }

  // Line 8: Total non-refundable credits
  const totalNonRefundable = Math.round(childCareCredit + aotcNonRefundable + llcTotal);
  lines['L8'] = makeLine(totalNonRefundable, 'Total non-refundable credits', 'L8', 'IRS Schedule 3 Line 8', 'L2 + L3 + L4');

  // ── Part II: Other Payments ────────────────────────────────────────
  lines['L9'] = makeLine(0, 'Net premium tax credit', 'L9', 'IRC §36B', 'Not implemented');
  lines['L10'] = makeLine(0, 'Amount paid with extension', 'L10', 'IRC §6651', 'User-reported if applicable');
  lines['L13'] = makeLine(0, 'Excess social security withheld', 'L13', 'IRC §6413', 'Not implemented');
  lines['L15'] = makeLine(0, 'Total other payments', 'L15', 'IRS Schedule 3 Line 15', 'L9 + L10 + L13');

  return {
    formLines: lines,
    totalNonRefundableCredits: totalNonRefundable,
    totalPayments: 0,
    flags,
  };
}
