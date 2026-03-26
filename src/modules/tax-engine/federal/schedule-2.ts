/**
 * Schedule 2 — Additional Taxes
 * Part I: AMT (flagged for review), excess APTC repayment
 * Part II: Self-employment tax (1099-NEC income × 92.35% × 15.3%), deductible half
 */

import type { TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface Schedule2Result {
  formLines: FormLineMap;
  selfEmploymentTax: number;
  deductibleHalfSE: number;
  totalAdditionalTax: number;
  flags: TaxCalculationFlag[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: '1040-S2', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

// ─── Constants (statutory rates from IRC §1401) ────────────────────

/** Net earnings factor: 92.35% of gross SE income per IRC §1402(a) */
const SE_NET_EARNINGS_FACTOR = 0.9235;

/** Combined SE tax rate: 12.4% SS + 2.9% Medicare = 15.3% per IRC §1401 */

/** Social security wage base limit (2025) — half of SE tax only applies below this */
const SS_WAGE_BASE_2025 = 176100;

/** SS portion rate per IRC §1401(a) */
const SS_RATE = 0.124;

/** Medicare portion rate per IRC §1401(b) */
const MEDICARE_RATE = 0.029;

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate Schedule 2 — Additional Taxes.
 *
 * @param nonemployeeComp - Total 1099-NEC nonemployee compensation
 * @param rentalIncome - Total 1099-MISC rental income (may be SE income)
 * @param wagesAlreadyTaxed - W-2 SS wages (for SS wage base coordination)
 * @returns Schedule2Result with SE tax, deductible half, and flags
 */
export function calculateSchedule2(
  nonemployeeComp: number,
  rentalIncome: number,
  wagesAlreadyTaxed: number,
): Schedule2Result {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Part I: AMT (flagged, not calculated) ─────────────────────────
  lines['L1'] = makeLine(0, 'Alternative Minimum Tax', 'L1', 'IRC §55', 'AMT calculation not implemented — flagged for review');
  flags.push({
    fieldPath: 'schedule2.L1',
    value: 0,
    reason: 'AMT calculation requires Form 6251 (not implemented). If ISO exercises, large deductions, or high income, AMT may apply.',
    sourceSection: 'IRC §55',
    needsHumanReview: true,
  });

  // ── Part II: Self-Employment Tax ──────────────────────────────────
  const grossSE = Math.round(nonemployeeComp + rentalIncome);

  if (grossSE <= 0) {
    lines['L4'] = makeLine(0, 'Self-employment tax', 'L4', 'IRC §1401', 'No SE income');
    lines['L5'] = makeLine(0, 'Deductible half of SE tax', 'L5', 'IRC §164(f)', 'No SE tax');
    lines['L17'] = makeLine(0, 'Total additional tax', 'L17', 'IRS Schedule 2 Line 17', 'No additional taxes');
    return { formLines: lines, selfEmploymentTax: 0, deductibleHalfSE: 0, totalAdditionalTax: 0, flags };
  }

  // Net earnings from SE (92.35% of gross)
  const netEarnings = Math.round(grossSE * SE_NET_EARNINGS_FACTOR);
  lines['L3'] = makeLine(netEarnings, 'Net earnings from self-employment', 'L3', 'IRC §1402(a)',
    `$${grossSE} × ${SE_NET_EARNINGS_FACTOR * 100}%`);

  // SS portion: only on earnings below wage base (minus W-2 SS wages already taxed)
  const remainingSSBase = Math.max(0, SS_WAGE_BASE_2025 - wagesAlreadyTaxed);
  const ssEarnings = Math.min(netEarnings, remainingSSBase);
  const ssTax = Math.round(ssEarnings * SS_RATE);

  // Medicare portion: on all net earnings (no cap)
  const medicareTax = Math.round(netEarnings * MEDICARE_RATE);

  const totalSETax = ssTax + medicareTax;
  const deductibleHalf = Math.round(totalSETax / 2);

  lines['L4'] = makeLine(totalSETax, 'Self-employment tax', 'L4', 'IRC §1401',
    `SS: $${ssTax} (on $${ssEarnings}) + Medicare: $${medicareTax} (on $${netEarnings})`);
  lines['L5'] = makeLine(deductibleHalf, 'Deductible half of SE tax', 'L5', 'IRC §164(f)',
    `$${totalSETax} / 2 — flows to Schedule 1 Line 15`);

  // Flag if SE income is high (additional Medicare may apply)
  if (netEarnings > 200000) {
    flags.push({
      fieldPath: 'schedule2.L4',
      value: totalSETax,
      reason: `Net SE earnings $${netEarnings} may trigger Additional Medicare Tax (0.9%) per IRC §1401(b)(2) — not included in calculation`,
      sourceSection: 'IRC §1401(b)(2)',
      needsHumanReview: true,
    });
  }

  // Total additional tax
  const totalAdditionalTax = totalSETax; // AMT not calculated (flagged)
  lines['L17'] = makeLine(totalAdditionalTax, 'Total additional tax', 'L17', 'IRS Schedule 2 Line 17',
    'L1 (AMT flagged) + L4 (SE tax)');

  return {
    formLines: lines,
    selfEmploymentTax: totalSETax,
    deductibleHalfSE: deductibleHalf,
    totalAdditionalTax,
    flags,
  };
}
