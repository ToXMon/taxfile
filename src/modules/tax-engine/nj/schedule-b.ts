/**
 * NJ Schedule B — Interest and Dividend Payer Detail
 * Required when total interest + dividends > $10,000 (NJ threshold per NJ-1040 instructions).
 * Lists each payer from 1099-INT and 1099-DIV documents.
 * Source: NJ Division of Taxation, NJ-1040 Instructions Schedule B
 */

import type { ExtractedDocument, TaxLineItem, FormLineMap, TaxCalculationFlag } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────

/** NJ Schedule B filing threshold per NJ-1040 instructions */
const NJ_SCHEDULE_B_THRESHOLD = 10000;

// ─── Types ──────────────────────────────────────────────────────────

interface PayerEntry {
  documentId: string;
  payerLabel: string;
  amount: TaxLineItem;
}

export interface NJScheduleBResult {
  required: boolean;
  requirementReason: string;
  interestPayers: PayerEntry[];
  dividendPayers: PayerEntry[];
  totalInterest: TaxLineItem;
  totalDividends: TaxLineItem;
  formLines: FormLineMap;
  flags: TaxCalculationFlag[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-SCH-B', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

function makePayerEntry(
  doc: ExtractedDocument,
  fieldPath: string,
  label: string,
  boxNumber: string,
  njCode: string,
): PayerEntry {
  const field = doc.fields[fieldPath];
  return {
    documentId: doc.id,
    payerLabel: label,
    amount: field ?? makeLine(0, label, boxNumber, njCode, 'Missing field'),
  };
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Calculate NJ Schedule B — Interest and Dividend Payer Detail.
 * Required when interest + dividends > $10,000 (NJ threshold).
 */
export function calculateNJScheduleB(documents: ExtractedDocument[]): NJScheduleBResult {
  const flags: TaxCalculationFlag[] = [];
  const lines: FormLineMap = {};

  const intDocs = documents.filter(d => d.type === '1099-INT');
  const divDocs = documents.filter(d => d.type === '1099-DIV');

  // Build payer entries
  const interestPayers: PayerEntry[] = intDocs.map(doc => {
    const payer = doc.fields['payer']?.label ?? 'Unknown Payer';
    return makePayerEntry(doc, 'box1', payer, 'L1', 'N.J.S.A. 54A:1-2');
  });

  const dividendPayers: PayerEntry[] = divDocs.map(doc => {
    const payer = doc.fields['payer']?.label ?? 'Unknown Payer';
    return makePayerEntry(doc, 'box1a', payer, 'L5', 'N.J.S.A. 54A:1-2');
  });

  // Totals
  const totalInterest = interestPayers.reduce((sum, p) => sum + p.amount.value, 0);
  const totalDividends = dividendPayers.reduce((sum, p) => sum + p.amount.value, 0);
  const combined = totalInterest + totalDividends;

  lines['L1'] = makeLine(totalInterest, 'Total taxable interest', 'L1', 'N.J.S.A. 54A:1-2',
    `${interestPayers.length} payer(s) from 1099-INT`);
  lines['L5'] = makeLine(totalDividends, 'Total ordinary dividends', 'L5', 'N.J.S.A. 54A:1-2',
    `${dividendPayers.length} payer(s) from 1099-DIV`);
  lines['L7'] = makeLine(combined, 'Total interest + dividends', 'L7', 'NJ-1040 Instructions',
    `L1($${totalInterest}) + L5($${totalDividends})`);

  // Determine requirement
  const required = combined > NJ_SCHEDULE_B_THRESHOLD;
  const reason = required
    ? `Required: interest+dividends ($${combined}) > NJ threshold ($${NJ_SCHEDULE_B_THRESHOLD})`
    : `Not required: interest+dividends ($${combined}) <= NJ threshold ($${NJ_SCHEDULE_B_THRESHOLD})`;
  lines['THRESHOLD'] = makeLine(NJ_SCHEDULE_B_THRESHOLD, 'NJ Schedule B threshold', 'THRESHOLD',
    'NJ-1040 Instructions', 'Schedule B required when combined exceeds this amount');

  if (!required && (totalInterest > 0 || totalDividends > 0)) {
    flags.push({
      fieldPath: 'nj.scheduleB.combined', value: combined,
      reason: `Interest+dividends ($${combined}) below NJ Schedule B threshold ($${NJ_SCHEDULE_B_THRESHOLD}). Payer detail not required but amounts reported.`,
      sourceSection: 'NJ-1040 Instructions', needsHumanReview: false,
    });
  }

  return {
    required,
    requirementReason: reason,
    interestPayers,
    dividendPayers,
    totalInterest: lines['L1'],
    totalDividends: lines['L5'],
    formLines: lines,
    flags,
  };
}
