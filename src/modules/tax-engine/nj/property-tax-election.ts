/**
 * NJ Property Tax Deduction vs Credit Election Calculator
 * Taxpayer must choose ONE:
 *   (1) Deduction: min(property taxes, $1,000) reduces taxable income
 *   (2) Credit: 25% of (property taxes - $100 threshold), max $500, reduces tax directly
 * Recommends the option with higher dollar savings.
 * Sources: N.J.S.A. 54A:3-3 (deduction), N.J.S.A. 54A:4A-1 (credit)
 */

import type { TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';
import type { NJTaxConfig } from '@/config/tax-year/2025';
import type { TaxBracket } from '@/config/tax-year/2025';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-PT-ELECT', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

/** Get marginal rate for a given taxable income level */
function getMarginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
      return bracket.rate;
    }
  }
  // If income exceeds all bracket maxes (except Infinity), use last finite bracket rate
  const finite = brackets.filter(b => b.max !== Infinity);
 if (finite.length > 0) return finite[finite.length - 1].rate;
  return 0;
}

// ─── Types ──────────────────────────────────────────────────────────

export type PropertyTaxElection = 'deduction' | 'credit';

export interface PropertyTaxElectionInput {
  propertyTaxesPaid: number;
  njTaxableIncome: number;
  filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh';
}

export interface PropertyTaxElectionResult {
  formLines: FormLineMap;
  deductionAmount: number;
  deductionSavings: number;
  creditAmount: number;
  recommended: PropertyTaxElection;
  recommendedSavings: number;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ property tax deduction vs credit election.
 * Compares dollar savings of both options and recommends the better one.
 * All thresholds from config (dependency injection).
 */
export function calculatePropertyTaxElection(
  input: PropertyTaxElectionInput,
  config: NJTaxConfig,
): PropertyTaxElectionResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  const { propertyTaxesPaid, njTaxableIncome, filingStatus } = input;
  const brackets = config.brackets[filingStatus];
  const marginalRate = getMarginalRate(njTaxableIncome, brackets);

  // ── Option 1: Deduction ────────────────────────────────────────────
  const deductionAmount = Math.min(propertyTaxesPaid, config.propertyTaxDeductionCap);
  // Savings = deduction × marginal rate (reduces taxable income)
  const deductionSavings = Math.round(deductionAmount * marginalRate);

  lines['DED_AMOUNT'] = makeLine(deductionAmount, 'Property tax deduction amount', 'DED_AMOUNT',
    'N.J.S.A. 54A:3-3', `Min($${propertyTaxesPaid}, cap $${config.propertyTaxDeductionCap})`);
  lines['DED_RATE'] = makeLine(Math.round(marginalRate * 10000) / 100, 'Marginal tax rate', 'DED_RATE',
    config.source, `Rate at $${njTaxableIncome} taxable income`);
  lines['DED_SAVINGS'] = makeLine(deductionSavings, 'Deduction savings (est.)', 'DED_SAVINGS',
    'N.J.S.A. 54A:3-3', `$${deductionAmount} × ${Math.round(marginalRate * 10000) / 100}%`);

  // ── Option 2: Credit ───────────────────────────────────────────────
  const creditBase = Math.max(0, propertyTaxesPaid - config.propertyTaxCreditThreshold);
  const creditAmount = Math.min(
    Math.round(creditBase * config.propertyTaxCreditRate),
    config.propertyTaxCreditMax,
  );

  lines['CRED_BASE'] = makeLine(creditBase, 'Credit base (taxes - threshold)', 'CRED_BASE',
    'N.J.S.A. 54A:4A-1', `$${propertyTaxesPaid} - $${config.propertyTaxCreditThreshold}`);
  lines['CRED_AMOUNT'] = makeLine(creditAmount, 'Property tax credit amount', 'CRED_AMOUNT',
    'N.J.S.A. 54A:4A-1', `${Math.round(config.propertyTaxCreditRate * 100)}% × $${creditBase}, max $${config.propertyTaxCreditMax}`);
  lines['CRED_SAVINGS'] = makeLine(creditAmount, 'Credit savings (direct)', 'CRED_SAVINGS',
    'N.J.S.A. 54A:4A-1', 'Credit reduces tax dollar-for-dollar');

  // ── Comparison & Recommendation ────────────────────────────────────
  const recommended: PropertyTaxElection = deductionSavings >= creditAmount ? 'deduction' : 'credit';
  const recommendedSavings = Math.max(deductionSavings, creditAmount);
  const savingsDifference = Math.abs(deductionSavings - creditAmount);

  lines['RECOMMENDED'] = makeLine(recommendedSavings,
    `Recommended: ${recommended === 'deduction' ? 'DEDUCTION' : 'CREDIT'}`, 'RECOMMENDED',
    recommended === 'deduction' ? 'N.J.S.A. 54A:3-3' : 'N.J.S.A. 54A:4A-1',
    `${recommended} saves $${recommendedSavings} vs $${recommended === 'deduction' ? creditAmount : deductionSavings} for other option (diff: $${savingsDifference})`);

  // ── Flagging ──────────────────────────────────────────────────────

  if (propertyTaxesPaid === 0) {
    flags.push({
      fieldPath: 'nj.propertyTaxElection.taxesPaid', value: 0,
      reason: 'No property taxes paid. Neither deduction nor credit applies.',
      sourceSection: 'N.J.S.A. 54A:3-3', needsHumanReview: false,
    });
  }

  if (propertyTaxesPaid > 0 && propertyTaxesPaid <= config.propertyTaxCreditThreshold) {
    flags.push({
      fieldPath: 'nj.propertyTaxElection.belowThreshold', value: propertyTaxesPaid,
      reason: `Property taxes ($${propertyTaxesPaid}) do not exceed $${config.propertyTaxCreditThreshold} threshold. Credit = $0. Deduction may still apply.`,
      sourceSection: 'N.J.S.A. 54A:4A-1', needsHumanReview: false,
    });
  }

  if (savingsDifference === 0 && propertyTaxesPaid > 0) {
    flags.push({
      fieldPath: 'nj.propertyTaxElection.tie', value: savingsDifference,
      reason: 'Deduction and credit produce identical savings. Either option is valid.',
      sourceSection: 'N.J.S.A. 54A:3-3 / 54A:4A-1', needsHumanReview: false,
    });
  }

  return {
    formLines: lines,
    deductionAmount,
    deductionSavings,
    creditAmount,
    recommended,
    recommendedSavings,
    flags,
  };
}
