/**
 * NJ Schedule C — Business Income (Simplified)
 * Reports net profit/loss from 1099-NEC and basic expense deductions.
 * NJ Schedule C is simpler than federal — no Part III cost of goods sold
 * or Part IV vehicle expense in this scope.
 * Source: NJ-1040 Instructions Schedule C, N.J.S.A. 54A:1-2
 */

import type { ExtractedDocument, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-SCH-C', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NJScheduleCInput {
  documents: ExtractedDocument[];
  additionalExpenses: {
    advertising: number;
    insurance: number;
    officeSupplies: number;
    travel: number;
    meals: number;
    professionalServices: number;
    otherExpenses: number;
  };
}

export interface NJScheduleCResult {
  formLines: FormLineMap;
  grossIncome: number;
  totalExpenses: number;
  netProfitOrLoss: number;
  flags: TaxCalculationFlag[];
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ Schedule C — Business Income.
 * Aggregates 1099-NEC income, applies basic expense deductions,
 * reports net profit/loss for NJ-1040 Line 40.
 */
export function calculateNJScheduleC(input: NJScheduleCInput): NJScheduleCResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  // ── Gross Income from 1099-NEC ────────────────────────────────────
  const necDocs = input.documents.filter(d => d.type === '1099-NEC');
  const grossIncome = necDocs.reduce(
    (sum, doc) => sum + (doc.fields['box1']?.value ?? 0), 0,
  );

  lines['L1'] = makeLine(grossIncome, 'Gross receipts or sales (1099-NEC)', 'L1',
    'N.J.S.A. 54A:1-2', `${necDocs.length} 1099-NEC document(s)`);

  // ── Expense Deductions ────────────────────────────────────────────
  const { additionalExpenses: exp } = input;

  lines['L8'] = makeLine(exp.advertising, 'Advertising', 'L8',
    'N.J.S.A. 54A:4-1', 'Business advertising costs');

  lines['L15'] = makeLine(exp.insurance, 'Insurance (business)', 'L15',
    'N.J.S.A. 54A:4-1', 'Business liability insurance');

  lines['L22'] = makeLine(exp.officeSupplies, 'Office supplies', 'L22',
    'N.J.S.A. 54A:4-1', 'Consumable office supplies');

  lines['L24a'] = makeLine(exp.travel, 'Travel', 'L24a',
    'N.J.S.A. 54A:4-1', 'Business travel (no meals)');

  // Meals: 50% deductible per IRC §274(n) (NJ follows federal treatment)
  const mealsDeductible = Math.round(exp.meals * 0.50);
  lines['L24b'] = makeLine(exp.meals, 'Meals (total)', 'L24b',
    'N.J.S.A. 54A:4-1', 'Total meal expenses');
  lines['L24c'] = makeLine(mealsDeductible, 'Meals (50% deductible)', 'L24c',
    'IRC §274(n)', `50% × $${exp.meals}`);

  lines['L27'] = makeLine(exp.professionalServices, 'Professional services', 'L27',
    'N.J.S.A. 54A:4-1', 'Legal, accounting, consulting');

  lines['L28'] = makeLine(exp.otherExpenses, 'Other expenses', 'L28',
    'N.J.S.A. 54A:4-1', 'Other deductible business expenses');

  // ── Total Expenses ────────────────────────────────────────────────
  const totalExpenses = Math.round(
    exp.advertising + exp.insurance + exp.officeSupplies
    + exp.travel + mealsDeductible + exp.professionalServices + exp.otherExpenses,
  );
  lines['L29'] = makeLine(totalExpenses, 'Total expenses', 'L29',
    'N.J.S.A. 54A:4-1', 'Sum of expense lines');

  // ── Net Profit or Loss ────────────────────────────────────────────
  const netProfitOrLoss = grossIncome - totalExpenses;
  const isProfit = netProfitOrLoss >= 0;
  lines['L30'] = makeLine(netProfitOrLoss, isProfit ? 'Net profit' : 'Net loss', 'L30',
    'N.J.S.A. 54A:1-2', `Gross($${grossIncome}) - Expenses($${totalExpenses})`);

  // ── Flagging ──────────────────────────────────────────────────────

  if (necDocs.length === 0 && grossIncome === 0) {
    flags.push({
      fieldPath: 'nj.scheduleC.grossIncome', value: 0,
      reason: 'No 1099-NEC documents found. NJ Schedule C has zero gross income.',
      sourceSection: 'N.J.S.A. 54A:1-2', needsHumanReview: false,
    });
  }

  if (!isProfit) {
    flags.push({
      fieldPath: 'nj.scheduleC.netLoss', value: netProfitOrLoss,
      reason: `NJ Schedule C shows net loss of $${Math.abs(netProfitOrLoss)}. NJ allows loss deduction but subject to at-risk and passive activity rules (not calculated here).`,
      sourceSection: 'N.J.S.A. 54A:1-2', needsHumanReview: true,
    });
  }

  if (exp.meals > 0 && mealsDeductible > 0) {
    flags.push({
      fieldPath: 'nj.scheduleC.meals', value: mealsDeductible,
      reason: `Meals deduction limited to 50% per IRC §274(n). Only $${mealsDeductible} of $${exp.meals} is deductible.`,
      sourceSection: 'IRC §274(n)', needsHumanReview: false,
    });
  }

  return {
    formLines: lines,
    grossIncome,
    totalExpenses,
    netProfitOrLoss,
    flags,
  };
}
