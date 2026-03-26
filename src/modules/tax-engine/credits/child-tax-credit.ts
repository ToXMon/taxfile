/**
 * Child Tax Credit + Schedule 8812
 * Part I: CTC after phase-out (IRC §24)
 * Part II: Additional CTC — refundable portion (15% of earned income over $2,500)
 * Sources: IRC §24(f)(1), Schedule 8812 (Rev. Jan 2025)
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';
import type { ChildTaxCreditConfig } from '@/config/tax-year/2025';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: '8812', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

function isMfj(fs: FilingStatus): boolean {
  return fs === 'mfj';
}

// ─── Types ──────────────────────────────────────────────────────────

export interface ChildTaxCreditInput {
  qualifyingChildCount: number;
  magi: number;
  earnedIncome: number;
  filingStatus: FilingStatus;
  taxLiability: number;
  otherNonRefundableCredits: number;
}

export interface ChildTaxCreditData {
  schedule8812: FormLineMap;
  totalCTC: number;
  refundableCTC: number;
  nonRefundableCTC: number;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate Child Tax Credit and Schedule 8812.
 * All monetary thresholds from config (dependency injection).
 */
export function calculateCTC(
  input: ChildTaxCreditInput,
  config: ChildTaxCreditConfig,
): ChildTaxCreditData {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  const { qualifyingChildCount, magi, earnedIncome, filingStatus, taxLiability, otherNonRefundableCredits } = input;

  // ── Part I: Child Tax Credit After Phase-Out ──────────────────────

  // Line 1: Number of qualifying children × max per child
  const line1 = qualifyingChildCount * config.maxPerChild;
  lines['L1'] = makeLine(line1, `${qualifyingChildCount} children × $${config.maxPerChild}`, 'L1',
    config.source, `${qualifyingChildCount} qualifying children under 17`);

  // Line 2: Other dependents × $500 (not in current scope — 0)
  lines['L2'] = makeLine(0, 'Credit for other dependents', 'L2', 'IRC §24(h)', 'Not implemented');

  // Line 3: Total before phase-out
  const line3 = line1;
  lines['L3'] = makeLine(line3, 'Total before phase-out', 'L3', 'IRC §24(f)', 'L1 + L2');

  // Line 4: MAGI
  lines['L4'] = makeLine(magi, 'Modified AGI', 'L4', 'IRS Schedule 8812', 'From Form 1040 Line 11');

  // Line 5: Phase-out threshold
  const threshold = isMfj(filingStatus) ? config.phaseOutStartMfj : config.phaseOutStartOther;
  lines['L5'] = makeLine(threshold, 'Phase-out threshold', 'L5', config.source,
    isMfj(filingStatus) ? 'MFJ threshold' : 'Single/MFS/HOH threshold');

  // Line 6: Excess MAGI over threshold
  const excess = Math.max(0, magi - threshold);
  lines['L6'] = makeLine(excess, 'Excess MAGI', 'L6', config.source, `MAGI($${magi}) - Threshold($${threshold})`);

  // Line 7: Phase-out amount (excess / $1,000 × $50)
  const phaseOutReduction = Math.floor(excess / 1000) * config.phaseOutRatePer1000;
  lines['L7'] = makeLine(phaseOutReduction, 'Phase-out reduction', 'L7', config.source,
    `Floor($${excess} / $1,000) × $${config.phaseOutRatePer1000}`);

  // Line 8: CTC after phase-out
  const ctcAfterPhaseOut = Math.max(0, line3 - phaseOutReduction);
  lines['L8'] = makeLine(ctcAfterPhaseOut, 'CTC after phase-out', 'L8', config.source,
    `L3($${line3}) - L7($${phaseOutReduction})`);

  // ── Part II: Additional Child Tax Credit ──────────────────────────

  // Line 11: Earned income
  lines['L11'] = makeLine(earnedIncome, 'Earned income', 'L11', 'IRC §32(c)', 'From Form 1040/Schedule 1');

  // Line 12: Earned income exceeding $2,500
  const earnedOverThreshold = Math.max(0, earnedIncome - 2500);
  lines['L12'] = makeLine(earnedOverThreshold, 'Earned income over $2,500', 'L12', 'IRC §24(d)',
    `Earned($${earnedIncome}) - $2,500`);

  // Line 13: 15% of Line 12
  const additionalCTCFromIncome = Math.round(earnedOverThreshold * 0.15);
  lines['L13'] = makeLine(additionalCTCFromIncome, '15% of earned income over $2,500', 'L13', 'IRC §24(d)(1)',
    `$${earnedOverThreshold} × 15%`);

  // Line 14: Number of qualifying children
  lines['L14'] = makeLine(qualifyingChildCount, 'Number of qualifying children under 17', 'L14', 'IRC §24(c)', '');

  // Line 15: Max refundable per child × children
  const maxRefundable = qualifyingChildCount * config.maxRefundablePerChild;
  lines['L15'] = makeLine(maxRefundable, `${qualifyingChildCount} × $${config.maxRefundablePerChild}`, 'L15',
    config.source, `Max refundable amount`);

  // Line 16: Smaller of Line 13 or Line 15
  const refundableFromAdditional = Math.min(additionalCTCFromIncome, maxRefundable);
  lines['L16'] = makeLine(refundableFromAdditional, 'Additional CTC (refundable)', 'L16', 'IRC §24(d)(1)',
    `Min(L13=$${additionalCTCFromIncome}, L15=$${maxRefundable})`);

  // Line 17: Subtract Line 16 from Line 8 (non-refundable portion candidate)
  const nonRefundableCandidate = ctcAfterPhaseOut - refundableFromAdditional;
  lines['L17'] = makeLine(nonRefundableCandidate, 'CTC minus additional CTC', 'L17', 'IRC §24(d)',
    `L8($${ctcAfterPhaseOut}) - L16($${refundableFromAdditional})`);

  // Line 18: Tax liability
  lines['L18'] = makeLine(taxLiability, 'Tax liability', 'L18', 'IRS Form 1040 Line 16', 'From Form 1040');

  // Line 19: Other non-refundable credits
  lines['L19'] = makeLine(otherNonRefundableCredits, 'Other non-refundable credits', 'L19', 'IRS Schedule 3 Line 8',
    'From Schedule 3');

  // Line 20: Tax liability minus other credits
  const taxAfterCredits = Math.max(0, taxLiability - otherNonRefundableCredits);
  lines['L20'] = makeLine(taxAfterCredits, 'Tax after other credits', 'L20', 'IRC §26(a)',
    `L18($${taxLiability}) - L19($${otherNonRefundableCredits})`);

  // Line 21: Non-refundable CTC allowed (smaller of L17 or L20)
  const nonRefundableAllowed = Math.min(Math.max(0, nonRefundableCandidate), taxAfterCredits);
  lines['L21'] = makeLine(nonRefundableAllowed, 'Non-refundable CTC allowed', 'L21', 'IRC §26(a)',
    `Min(L17=$${nonRefundableCandidate}, L20=$${taxAfterCredits})`);

  // Line 22: Subtract Line 21 from Line 8
  const remainder = Math.max(0, ctcAfterPhaseOut - nonRefundableAllowed);
  lines['L22'] = makeLine(remainder, 'Remaining CTC', 'L22', 'IRC §24(d)',
    `L8($${ctcAfterPhaseOut}) - L21($${nonRefundableAllowed})`);

  // Line 23: Total refundable CTC = L16 + L22
  const totalRefundable = refundableFromAdditional + remainder;
  lines['L23'] = makeLine(totalRefundable, 'Total refundable CTC', 'L23', 'IRC §24(d)(1)',
    `L16($${refundableFromAdditional}) + L22($${remainder})`);

  // ── Flags ──────────────────────────────────────────────────────────

  if (phaseOutReduction > 0 && phaseOutReduction >= line3) {
    flags.push({
      fieldPath: 'schedule8812.L8', value: ctcAfterPhaseOut,
      reason: `CTC fully phased out. MAGI $${magi} exceeds threshold by $${excess}.`,
      sourceSection: config.source, needsHumanReview: false,
    });
  }

  return {
    schedule8812: lines,
    totalCTC: ctcAfterPhaseOut,
    refundableCTC: totalRefundable,
    nonRefundableCTC: nonRefundableAllowed,
    flags,
  };
}
