/**
 * Earned Income Tax Credit (EITC) + Education Credits (AOTC/LLC)
 * EITC: IRC §32 — bracket lookup with phase-in and phase-out
 * AOTC: IRC §25A(c) — 25% of first $4,000 expenses/student, max $2,500, 40% refundable
 * LLC: IRC §25A(d) — 20% of expenses, max $2,000, nonrefundable
 * Sources: IRC §32, IRC §25A, 2025 inflation-adjusted amounts from config
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';
import type { EITCConfig, EITCFilingStatus, EducationCreditConfig } from '@/config/tax-year/2025';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'EITC-EDU', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

/** Map central FilingStatus to EITC config key ('qw' -> 'hoh') */
function toEitcFS(fs: FilingStatus): EITCFilingStatus {
  if (fs === 'qw') return 'hoh';
  if (fs === 'mfs') return 'mfs';
  return fs as EITCFilingStatus;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface EITCInput {
  earnedIncome: number;
  investmentIncome: number;
  qualifyingChildCount: number;
  filingStatus: FilingStatus;
}

export interface EITCResult {
  formLines: FormLineMap;
  credit: number;
  flags: TaxCalculationFlag[];
}

export interface EducationInput {
  aotcStudents: number;
  aotcExpenses: number;
  llcStudents: number;
  llcExpenses: number;
}

export interface EducationResult {
  formLines: FormLineMap;
  aotcTotal: number;
  aotcRefundable: number;
  aotcNonRefundable: number;
  llcTotal: number;
  flags: TaxCalculationFlag[];
}

// ─── EITC Calculation ──────────────────────────────────────────────

/**
 * Calculate Earned Income Tax Credit per IRC §32.
 * Uses bracket lookup from config (dependency injection).
 */
export function calculateEITC(input: EITCInput, config: EITCConfig): EITCResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  const { earnedIncome, investmentIncome, qualifyingChildCount, filingStatus } = input;
  const status = toEitcFS(filingStatus);
  const childKey = Math.min(qualifyingChildCount, 3) as 0 | 1 | 2 | 3;

  // Investment income gate
  lines['INV_LIMIT'] = makeLine(config.investmentIncomeLimit, 'Investment income limit', 'INV_LIMIT',
    config.source, 'Disqualifies if exceeded');
  lines['INV_ACTUAL'] = makeLine(investmentIncome, 'Actual investment income', 'INV_ACTUAL',
    config.source, 'From Schedule D + 1099-INT/DIV');

  if (investmentIncome > config.investmentIncomeLimit) {
    lines['CREDIT'] = makeLine(0, 'EITC — disqualified by investment income', 'CREDIT', config.source,
      `Investment income $${investmentIncome} > limit $${config.investmentIncomeLimit}`);
    flags.push({
      fieldPath: 'eitc.investmentIncome', value: investmentIncome,
      reason: `EITC disqualified: investment income $${investmentIncome} exceeds $${config.investmentIncomeLimit} limit`,
      sourceSection: config.source, needsHumanReview: false,
    });
    return { formLines: lines, credit: 0, flags };
  }

  // Bracket lookup
  const bracket = config.brackets[status][childKey];
  if (!bracket) {
    lines['CREDIT'] = makeLine(0, 'EITC — no matching bracket', 'CREDIT', config.source,
      `Status: ${status}, Children: ${childKey}`);
    return { formLines: lines, credit: 0, flags };
  }

  lines['BRACKET'] = makeLine(bracket.maxCredit, `EITC bracket: ${childKey} child(ren), max $${bracket.maxCredit}`, 'BRACKET',
    config.source, `Phase-out end: $${bracket.phaseOutEnd}`);

  let credit: number;
  if (earnedIncome <= bracket.maxIncome) {
    // Phase-in: credit increases linearly from $0 to maxCredit
    credit = bracket.minIncome > 0 && earnedIncome < bracket.minIncome
      ? 0
      : (earnedIncome / bracket.maxIncome) * bracket.maxCredit;
    lines['PHASE'] = makeLine(credit, 'EITC (phase-in)', 'PHASE', config.source,
      `Earned($${earnedIncome}) / MaxIncome($${bracket.maxIncome}) × MaxCredit($${bracket.maxCredit})`);
  } else if (earnedIncome <= bracket.phaseOutEnd) {
    // Phase-out: credit decreases from maxCredit to $0
    const phaseOutRange = bracket.phaseOutEnd - bracket.maxIncome;
    const excess = earnedIncome - bracket.maxIncome;
    credit = bracket.maxCredit - (excess / phaseOutRange) * bracket.maxCredit;
    lines['PHASE'] = makeLine(credit, 'EITC (phase-out)', 'PHASE', config.source,
      `MaxCredit($${bracket.maxCredit}) - (($${excess}) / ($${phaseOutRange})) × $${bracket.maxCredit}`);
  } else {
    credit = 0;
    lines['PHASE'] = makeLine(0, 'EITC — fully phased out', 'PHASE', config.source,
      `Earned income $${earnedIncome} > phase-out end $${bracket.phaseOutEnd}`);
  }

  credit = Math.max(0, Math.round(credit));
  lines['CREDIT'] = makeLine(credit, 'Earned Income Tax Credit', 'CREDIT', config.source,
    `${status}, ${childKey} child(ren), earned income $${earnedIncome}`);

  return { formLines: lines, credit, flags };
}

// ─── Education Credits Calculation ──────────────────────────────────

/** AOTC expense cap per student per IRC §25A(c)(2)(B) */
const AOTC_EXPENSE_CAP = 4000;

/**
 * Calculate AOTC and LLC education credits per IRC §25A.
 * AOTC is prioritized (more valuable). Mutual exclusivity per student per IRC §25A(d)(4).
 */
export function calculateEducationCredits(input: EducationInput, config: EducationCreditConfig): EducationResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── AOTC (IRC §25A(c)) ──────────────────────────────────────────
  const aotcPerStudent = Math.min(
    input.aotcExpenses / Math.max(1, input.aotcStudents),
    AOTC_EXPENSE_CAP,
  );
  const aotcTotal = Math.min(
    Math.round(aotcPerStudent * input.aotcStudents * 0.25),
    config.aotc.maxAmount * input.aotcStudents,
  );
  const aotcRefundable = Math.round(aotcTotal * config.aotc.refundablePercent);
  const aotcNonRefundable = aotcTotal - aotcRefundable;

  lines['AOTC_TOTAL'] = makeLine(aotcTotal, `AOTC total (${input.aotcStudents} student(s))`, 'AOTC_TOTAL',
    config.aotc.source, `25% of $${Math.round(aotcPerStudent)}/student, capped at $${config.aotc.maxAmount}/student`);
  lines['AOTC_REFUND'] = makeLine(aotcRefundable, 'AOTC refundable (40%)', 'AOTC_REFUND',
    config.aotc.source, `${Math.round(config.aotc.refundablePercent * 100)}% of $${aotcTotal}`);
  lines['AOTC_NONREF'] = makeLine(aotcNonRefundable, 'AOTC non-refundable', 'AOTC_NONREF',
    config.aotc.source, `$${aotcTotal} - $${aotcRefundable}`);

  if (input.aotcStudents > config.aotc.maxYears) {
    flags.push({
      fieldPath: 'education.aotcStudents', value: input.aotcStudents,
      reason: `AOTC claimed for ${input.aotcStudents} student(s) — verify none exceed ${config.aotc.maxYears} years of eligibility`,
      sourceSection: config.aotc.source, needsHumanReview: true,
    });
  }

  // ── LLC (IRC §25A(d)) ────────────────────────────────────────────
  const llcTotal = Math.min(
    Math.round(input.llcExpenses * 0.20),
    config.llc.maxAmount,
  );
  lines['LLC_TOTAL'] = makeLine(llcTotal, `Lifetime Learning Credit (${input.llcStudents} student(s))`, 'LLC_TOTAL',
    config.llc.source, `20% of $${input.llcExpenses}, capped at $${config.llc.maxAmount}`);
  lines['LLC_REFUND'] = makeLine(0, 'LLC refundable', 'LLC_REFUND',
    config.llc.source, 'LLC is non-refundable (0%)');
  lines['LLC_NONREF'] = makeLine(llcTotal, 'LLC non-refundable', 'LLC_NONREF',
    config.llc.source, `Full amount $${llcTotal} is non-refundable`);

  // ── Mutual Exclusivity Check (IRC §25A(d)(4)) ────────────────────
  if (input.aotcStudents > 0 && input.llcStudents > 0) {
    flags.push({
      fieldPath: 'education.mutualExclusivity', value: aotcTotal + llcTotal,
      reason: 'AOTC and LLC both claimed — allowed per IRC §25A(d)(4) for different students, but verify no student receives both credits',
      sourceSection: 'IRC §25A(d)(4)', needsHumanReview: true,
    });
  }

  return {
    formLines: lines,
    aotcTotal,
    aotcRefundable,
    aotcNonRefundable,
    llcTotal,
    flags,
  };
}
