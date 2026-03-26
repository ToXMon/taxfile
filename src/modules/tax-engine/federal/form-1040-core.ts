/**
 * Form 1040 Core — Taxable Income + Tax From Brackets
 * Lines 1-22 of Form 1040 including marginal bracket calculation
 * and Qualified Dividend/Capital Gain (QDI/LTCG) preferential rate worksheet.
 * Maps to: IRS Form 1040, Rev. Proc. 2024-40 brackets
 */

import type { FilingStatus, FormLineMap, TaxLineItem, TaxCalculationFlag } from '@/lib/types';
import type { IncomeSummary } from '../types';
import { FEDERAL_TAX_2025 } from '@/config/tax-year/2025';
import type { TaxBracket } from '@/config/tax-year/2025';

// ─── Helpers ────────────────────────────────────────────────────────

/** Map central FilingStatus to config key ('qw' -> 'hoh') */
function toConfigFS(fs: FilingStatus): 'single' | 'mfj' | 'mfs' | 'hoh' {
  if (fs === 'qw') return 'hoh';
  return fs as 'single' | 'mfj' | 'mfs' | 'hoh';
}

function makeLine(label: string, value: number, line: string, note: string, pub?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: '1040', boxNumber: line },
    trace: { irsPublication: pub ?? 'IRS Form 1040', calculationNote: note },
    flagged: false,
  };
}

/** Apply marginal tax brackets to taxable income */
function calculateMarginalTax(income: number, brackets: TaxBracket[]): number {
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

/**
 * QDI/LTCG Preferential Rate Worksheet (simplified).
 * Calculates tax on ordinary income at ordinary rates, then adds
 * preferential tax on QDI+LTCG at 0%/15%/20% rates from config.
 */
function calculateTaxWithQDI(
  taxableIncome: number,
  qualifiedDividends: number,
  longTermGains: number,
  filingStatus: FilingStatus,
): { tax: number; preferentialTax: number; ordinaryTax: number; flag?: TaxCalculationFlag } {
  const cfg = FEDERAL_TAX_2025.statuses[toConfigFS(filingStatus)];
  const qdi = FEDERAL_TAX_2025.qdiThresholds[toConfigFS(filingStatus)];
  const qdiLtcg = Math.max(0, qualifiedDividends + longTermGains);
  const ordinaryIncome = Math.max(0, taxableIncome - qdiLtcg);

  const ordinaryTax = calculateMarginalTax(ordinaryIncome, cfg.brackets);

  let preferentialTax = 0;
  let remaining = qdiLtcg;

  // 0% bracket
  const at0 = Math.min(remaining, qdi.rate0End);
  preferentialTax += at0 * 0;
  remaining -= at0;

  // 15% bracket
  const at15 = Math.min(remaining, qdi.rate15End - qdi.rate0End);
  preferentialTax += at15 * 0.15;
  remaining -= at15;

  // 20% bracket (above threshold)
  preferentialTax += remaining * 0.20;

  const totalTax = Math.round(ordinaryTax + preferentialTax);
  const flag: TaxCalculationFlag | undefined = qdiLtcg > 0 ? {
    fieldPath: 'qdiLtcg', value: qdiLtcg,
    reason: `Simplified QDI/LTCG worksheet used. Full 15-line worksheet (IRS Pub 550) should be verified. QDI+LTCG=$${qdiLtcg}`,
    sourceSection: qdi.source, needsHumanReview: qdiLtcg > 50000,
  } : undefined;

  return { tax: totalTax, preferentialTax: Math.round(preferentialTax), ordinaryTax: Math.round(ordinaryTax), flag };
}

// ─── Types ──────────────────────────────────────────────────────────

export interface Form1040CoreInput {
  income: IncomeSummary;
  schedule1AdditionalIncome: number;
  schedule1Adjustments: number;
  deductionAmount: number;
  isItemized: boolean;
  qualifiedDividends: number;
  longTermGains: number;
  filingStatus: FilingStatus;
}

export interface Form1040CoreResult {
  formLines: FormLineMap;
  totalIncome: number;
  agi: number;
  taxableIncome: number;
  tax: number;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate Form 1040 Lines 1-22 (core tax computation).
 */
export function calculate1040Core(input: Form1040CoreInput): Form1040CoreResult {
  const formLines: FormLineMap = {};
  const flags: TaxCalculationFlag[] = [];

  // Line 1: Wages
  formLines['L1'] = makeLine('Wages, salaries, tips', input.income.wages.value, '1', 'From W-2 box 1');
  // Lines 2a-3b: Interest + Dividends
  formLines['L2a'] = makeLine('Tax-exempt interest', 0, '2a', 'Not in 2025 scope');
  formLines['L2b'] = makeLine('Taxable interest', input.income.interest.value, '2b', 'From 1099-INT box 1');
  formLines['L3a'] = makeLine('Qualified dividends', input.qualifiedDividends, '3a', 'From 1099-DIV box 1b');
  formLines['L3b'] = makeLine('Ordinary dividends', input.income.ordinaryDividends.value, '3b', 'From 1099-DIV box 1a');

  // Line 7: Capital gain (net, from Schedule D)
  const netCapGain = input.income.shortTermCapitalGains.value + input.income.longTermCapitalGains.value;
  formLines['L7'] = makeLine('Capital gain or (loss)', netCapGain, '7', 'Net from Schedule D line 16');

  // Line 9: Total income
  const totalIncome = Math.round(
    input.income.wages.value + input.income.interest.value
    + input.income.ordinaryDividends.value + input.schedule1AdditionalIncome + netCapGain,
  );
  formLines['L9'] = makeLine('Total income', totalIncome, '9', 'Sum of lines 1z through 8z');

  // Line 10: Adjustments
  formLines['L10'] = makeLine('Adjustments to income', input.schedule1Adjustments, '10', 'From Schedule 1 line 26');

  // Line 11: AGI
  const agi = totalIncome - input.schedule1Adjustments;
  formLines['L11'] = makeLine('Adjusted Gross Income (AGI)', agi, '11', `Line 9($${totalIncome}) - Line 10($${input.schedule1Adjustments})`);

  // Line 12: Deduction
  formLines['L12'] = makeLine(
    input.isItemized ? 'Itemized deductions (Schedule A)' : 'Standard deduction',
    input.deductionAmount, '12', input.isItemized ? 'From Schedule A line 17' : 'From IRC §63(c)',
  );

  // Line 14: Total deductions (same as line 12 for 2025)
  formLines['L14'] = makeLine('Total deductions', input.deductionAmount, '14', 'Same as line 12');

  // Line 15: Taxable income
  const taxableIncome = Math.max(0, agi - input.deductionAmount);
  formLines['L15'] = makeLine('Taxable income', taxableIncome, '15', `AGI($${agi}) - Deductions($${input.deductionAmount})`);

  // Line 16: Tax
  const hasQDI = input.qualifiedDividends > 0 || input.longTermGains > 0;
  let tax: number;
  if (hasQDI && taxableIncome > 0) {
    const qdiResult = calculateTaxWithQDI(taxableIncome, input.qualifiedDividends, input.longTermGains, input.filingStatus);
    tax = qdiResult.tax;
    formLines['L16'] = makeLine('Tax', tax, '16',
      `Ordinary($${qdiResult.ordinaryTax}) + QDI/LTCG preferential($${qdiResult.preferentialTax})`,
      'IRC §1(h) QDI worksheet');
    if (qdiResult.flag) flags.push(qdiResult.flag);
  } else {
    const cfg = FEDERAL_TAX_2025.statuses[toConfigFS(input.filingStatus)];
    tax = calculateMarginalTax(taxableIncome, cfg.brackets);
    formLines['L16'] = makeLine('Tax', tax, '16', `Marginal brackets, ${cfg.brackets.length} tiers`, 'IRC §1(a)-(g)');
  }

  return { formLines, totalIncome, agi, taxableIncome, tax, flags };
}
