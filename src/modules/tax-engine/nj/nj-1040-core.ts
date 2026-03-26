/**
 * NJ-1040 Core — Taxable Income, Tax from Brackets, Credits, Payments, Refund/Owed
 * NJ brackets: 1.4% to 10.75% (MFJ top rate) per N.J.A.C. 18:35-1.5
 * Credits: NJ EITC (40% of federal per N.J.S.A. 54A:4-7.1), property tax credit
 * Sources: N.J.A.C. 18:35-1.5, N.J.S.A. 54A:1-2 through 54A:4A-1
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';
import type { NJTaxConfig } from '@/config/tax-year/2025';
import type { NJCreditsConfig } from '@/config/tax-year/2025';
import type { TaxBracket } from '@/config/tax-year/2025';
import { toNJFilingStatus } from './income-aggregation';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-1040', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

/** Apply NJ marginal tax brackets to taxable income */
function calculateNJTaxes(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let remaining = income;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }
  return Math.round(tax);
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NJ1040CoreInput {
  njGrossIncome: number;
  deductionAmount: number;
  isItemized: boolean;
  filingStatus: FilingStatus;
  federalEITC: number;
  propertyTaxCreditElected: boolean;
  propertyTaxCreditAmount: number;
  njWithholding: number;
  estimatedPayments: number;
}

export interface NJ1040CoreResult {
  formLines: FormLineMap;
  taxableIncome: number;
  njTax: number;
  totalCredits: number;
  totalPayments: number;
  refundOrOwed: number;
  isRefund: boolean;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ-1040 core: taxable income → tax → credits → payments → refund/owed.
 * All config values via dependency injection (NJTaxConfig, NJCreditsConfig).
 */
export function calculateNJ1040(
  input: NJ1040CoreInput,
  taxConfig: NJTaxConfig,
  creditsConfig: NJCreditsConfig,
): NJ1040CoreResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Taxable Income ────────────────────────────────────────────────
  lines['L38'] = makeLine(input.njGrossIncome, 'NJ gross income', 'L38',
    'N.J.S.A. 54A:1-2', 'From NJ income aggregation');

  lines['L39'] = makeLine(input.deductionAmount,
    input.isItemized ? 'NJ itemized deductions' : 'Federal standard/itemized deduction', 'L39',
    'N.J.S.A. 54A:2-1', input.isItemized ? 'From NJ Schedule A' : 'Federal deduction used on NJ return');

  const taxableIncome = Math.max(0, input.njGrossIncome - input.deductionAmount);
  lines['L40'] = makeLine(taxableIncome, 'NJ taxable income', 'L40',
    'N.J.S.A. 54A:1-2', `L38($${input.njGrossIncome}) - L39($${input.deductionAmount})`);

  // ── Tax from NJ Brackets ──────────────────────────────────────────
  const njFS = toNJFilingStatus(input.filingStatus);
  const brackets = taxConfig.brackets[njFS];
  const njTax = calculateNJTaxes(taxableIncome, brackets);

  lines['L41'] = makeLine(njTax, 'NJ tax', 'L41',
    taxConfig.source, `Marginal brackets (${brackets.length} tiers), ${njFS} filing status`);

  if (taxableIncome > 0 && njTax === 0) {
    flags.push({
      fieldPath: 'nj1040.L41', value: njTax,
      reason: 'Taxable income > 0 but NJ tax = 0. Verify bracket calculation.',
      sourceSection: taxConfig.source, needsHumanReview: true,
    });
  }

  // ── Credits ───────────────────────────────────────────────────────

  // NJ EITC: 40% of federal EITC per N.J.S.A. 54A:4-7.1
  const njEITC = Math.round(input.federalEITC * creditsConfig.eitcPercentOfFederal);
  lines['L42'] = makeLine(njEITC, 'NJ Earned Income Tax Credit', 'L42',
    creditsConfig.source, `${Math.round(creditsConfig.eitcPercentOfFederal * 100)}% × Federal EITC($${input.federalEITC})`);

  // Property tax credit (if elected in Schedule A)
  const propCredit = input.propertyTaxCreditElected ? input.propertyTaxCreditAmount : 0;
  lines['L43'] = makeLine(propCredit, 'Property tax credit', 'L43',
    'N.J.S.A. 54A:4A-1', input.propertyTaxCreditElected
      ? `Elected: $${propCredit} from Schedule A` : 'Not elected — using property tax deduction instead');

  const totalCredits = njEITC + propCredit;
  lines['L44'] = makeLine(totalCredits, 'Total credits', 'L44',
    'N.J.S.A. 54A:4', `L42($${njEITC}) + L43($${propCredit})`);

  // Tax after credits (cannot go below 0)
  const taxAfterCredits = Math.max(0, njTax - totalCredits);
  lines['L45'] = makeLine(taxAfterCredits, 'Tax after credits', 'L45',
    'N.J.S.A. 54A:4', `L41($${njTax}) - L44($${totalCredits})`);

  // ── Payments ──────────────────────────────────────────────────────
  lines['L46'] = makeLine(input.njWithholding, 'NJ income tax withheld', 'L46',
    'N.J.S.A. 54A:8-1', 'From W-2 box 17');
  lines['L47'] = makeLine(input.estimatedPayments, 'Estimated tax payments', 'L47',
    'N.J.S.A. 54A:8-3', 'User-reported quarterly payments');

  const totalPayments = input.njWithholding + input.estimatedPayments;
  lines['L48'] = makeLine(totalPayments, 'Total payments', 'L48',
    'N.J.S.A. 54A:8', `L46($${input.njWithholding}) + L47($${input.estimatedPayments})`);

  // ── Refund or Owed ────────────────────────────────────────────────
  const refundOrOwed = totalPayments - taxAfterCredits;
  const isRefund = refundOrOwed >= 0;

  lines['L49'] = makeLine(isRefund ? refundOrOwed : 0, 'NJ refund', 'L49',
    'N.J.S.A. 54A:8-6', isRefund ? `Overpayment: $${refundOrOwed}` : 'No refund');
  lines['L50'] = makeLine(isRefund ? 0 : Math.abs(refundOrOwed), 'NJ tax owed', 'L50',
    'N.J.S.A. 54A:8-4', isRefund ? 'No amount owed' : `Underpayment: $${Math.abs(refundOrOwed)}`);

  // ── Flagging ──────────────────────────────────────────────────────

  if (totalCredits > njTax) {
    flags.push({
      fieldPath: 'nj1040.creditsExcess', value: totalCredits - njTax,
      reason: `NJ credits ($${totalCredits}) exceed NJ tax ($${njTax}). Excess credits do not carry forward on NJ return.`,
      sourceSection: 'N.J.S.A. 54A:4', needsHumanReview: false,
    });
  }

  if (!isRefund && refundOrOwed < -500) {
    flags.push({
      fieldPath: 'nj1040.amountOwed', value: Math.abs(refundOrOwed),
      reason: `NJ tax owed $${Math.abs(refundOrOwed)} exceeds $500. Consider estimated tax payments to avoid underpayment penalty.`,
      sourceSection: 'N.J.S.A. 54A:8-4', needsHumanReview: true,
    });
  }

  return {
    formLines: lines,
    taxableIncome,
    njTax,
    totalCredits,
    totalPayments,
    refundOrOwed: Math.abs(refundOrOwed),
    isRefund,
    flags,
  };
}
