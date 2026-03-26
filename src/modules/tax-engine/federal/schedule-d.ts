/**
 * Schedule D — Capital Gains and Losses
 * Part I: Short-term (held 1 year or less)
 * Part II: Long-term (held more than 1 year)
 * Maps to: IRS Schedule D (Form 1040)
 */

import type { ExtractedDocument, FormLineMap, TaxLineItem, TaxCalculationFlag } from '@/lib/types';
const uuid = () => crypto.randomUUID();

export interface ScheduleDResult {
  formLines: FormLineMap;
  shortTermNet: number;
  longTermNet: number;
  totalNet: number;
  flags: TaxCalculationFlag[];
}

function makeLine(label: string, value: number, line: string, note: string, pub?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: uuid(), formType: 'Schedule D', boxNumber: line },
    trace: { irsPublication: pub ?? 'IRS Schedule D (Form 1040)', calculationNote: note },
    flagged: false,
  };
}

function sumField(docs: ExtractedDocument[], fieldPath: string): number {
  return docs
    .filter((d) => d.type === '1099-B' && d.fields[fieldPath])
    .reduce((sum, d) => sum + (d.fields[fieldPath]?.value ?? 0), 0);
}

/**
 * Calculate Schedule D from 1099-B documents.
 *
 * Part I (Short-Term):
 * - Line 1b: Total short-term proceeds (from 1099-B box 2)
 * - Line 1e: Total short-term cost basis (from 1099-B box 3)
 * - Line 6: Net short-term gain/(loss)
 *
 * Part II (Long-Term):
 * - Line 8b: Total long-term proceeds (from 1099-B box 4)
 * - Line 8e: Total long-term cost basis (from 1099-B box 5)
 * - Line 16: Net long-term gain/(loss)
 *
 * Line 21: Total net gain/(loss)
 *
 * @param documents - All extracted documents
 * @returns ScheduleDResult with form lines and net calculations
 */
export function calculateScheduleD(documents: ExtractedDocument[]): ScheduleDResult {
  const formLines: FormLineMap = {};
  const flags: TaxCalculationFlag[] = [];

  // Part I: Short-Term Capital Gains and Losses
  const stProceeds = sumField(documents, 'shortTermProceeds');
  const stCostBasis = sumField(documents, 'shortTermCostBasis');
  const stNet = stProceeds - stCostBasis;

  formLines['L1b'] = makeLine('Total short-term proceeds', stProceeds, '1b', 'From 1099-B box 2');
  formLines['L1e'] = makeLine('Total short-term cost basis', stCostBasis, '1e', 'From 1099-B box 3');
  formLines['L6'] = makeLine('Net short-term gain/(loss)', stNet, '6', `Proceeds($${stProceeds}) - Cost($${stCostBasis})`);

  // Part II: Long-Term Capital Gains and Losses
  const ltProceeds = sumField(documents, 'longTermProceeds');
  const ltCostBasis = sumField(documents, 'longTermCostBasis');
  const ltNet = ltProceeds - ltCostBasis;

  formLines['L8b'] = makeLine('Total long-term proceeds', ltProceeds, '8b', 'From 1099-B box 4');
  formLines['L8e'] = makeLine('Total long-term cost basis', ltCostBasis, '8e', 'From 1099-B box 5');
  formLines['L16'] = makeLine('Net long-term gain/(loss)', ltNet, '16', `Proceeds($${ltProceeds}) - Cost($${ltCostBasis})`);

  // Total net
  const totalNet = stNet + ltNet;
  formLines['L21'] = makeLine(
    'Total net gain/(loss)', totalNet, '21',
    `ST($${stNet}) + LT($${ltNet})`,
  );

  // Check for wash sale adjustments — flag if cost basis differs from proceeds
  // in a way suggesting disallowed losses (simplified heuristic)
  const has1099B = documents.some((d) => d.type === '1099-B');
  const hasMetaField = documents.some((d) => d.fields._transactionCount);
  if (has1099B && hasMetaField) {
    const txnCount = documents
      .filter((d) => d.type === '1099-B' && d.fields._transactionCount)
      .reduce((s, d) => s + (d.fields._transactionCount?.value ?? 0), 0);
    if (txnCount > 0) {
      flags.push({
        fieldPath: 'washSale', value: 0,
        reason: `${txnCount} transaction(s) parsed — wash sale adjustments not automatically detected. Verify manually per IRC \u00a71091`,
        sourceSection: 'IRC \u00a71091', needsHumanReview: true,
      });
    }
  }

  // Flag if no cost basis data (gains calculation unreliable)
  if (stProceeds > 0 && stCostBasis === 0) {
    flags.push({
      fieldPath: 'shortTermCostBasis', value: 0,
      reason: 'Short-term proceeds present but no cost basis — gain/loss cannot be calculated',
      sourceSection: 'Schedule D Part I', needsHumanReview: true,
    });
  }
  if (ltProceeds > 0 && ltCostBasis === 0) {
    flags.push({
      fieldPath: 'longTermCostBasis', value: 0,
      reason: 'Long-term proceeds present but no cost basis — gain/loss cannot be calculated',
      sourceSection: 'Schedule D Part II', needsHumanReview: true,
    });
  }

  return {
    formLines,
    shortTermNet: Math.round(stNet),
    longTermNet: Math.round(ltNet),
    totalNet: Math.round(totalNet),
    flags,
  };
}
