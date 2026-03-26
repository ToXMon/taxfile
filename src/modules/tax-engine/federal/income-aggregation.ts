/**
 * Income Aggregation — Sums income from all extracted documents.
 * W-2 wages, 1099-INT interest, 1099-DIV dividends, 1099-NEC/MISC income, 1099-B capital gains.
 * Every returned value is a TaxLineItem with full source tracing.
 */

import type { ExtractedDocument, TaxLineItem, TaxCalculationFlag } from '@/lib/types';
import type { IncomeSummary } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a trace string listing all contributing document IDs */
function buildAggSource(docs: ExtractedDocument[]): string {
  return docs.map((d) => d.id).join(', ');
}

/** Make a zero-value TaxLineItem for when no documents of a type exist */
function zeroItem(label: string, formType: string, boxNumber: string, irsRef: string): TaxLineItem {
  return {
    value: 0,
    label,
    source: { documentId: 'none', formType, boxNumber },
    trace: { irsPublication: irsRef, calculationNote: 'No documents of this type' },
    flagged: false,
  };
}

/** Sum a field across multiple documents of the same type */
function sumField(docs: ExtractedDocument[], fieldPath: string): number {
  return Math.round(
    docs.reduce((sum, doc) => sum + (doc.fields[fieldPath]?.value ?? 0), 0),
  );
}

/** Build an aggregated TaxLineItem from multiple documents */
function aggregateItem(
  docs: ExtractedDocument[],
  fieldPath: string,
  label: string,
  formType: string,
  boxNumber: string,
  irsRef: string,
): TaxLineItem {
  const value = sumField(docs, fieldPath);
  const hasFlagged = docs.some((d) => d.fields[fieldPath]?.flagged ?? false);
  return {
    value,
    label: `${label} (${docs.length} document${docs.length !== 1 ? 's' : ''})`,
    source: { documentId: buildAggSource(docs), formType, boxNumber },
    trace: { irsPublication: irsRef, calculationNote: `Aggregated ${fieldPath} from ${docs.length} document(s)` },
    flagged: hasFlagged,
    flagReason: hasFlagged ? 'One or more source fields flagged by OCR' : undefined,
  };
}

// ─── Capital Gains Calculation ──────────────────────────────────────

function calculateCapitalGains(
  docs1099B: ExtractedDocument[],
): { shortTerm: TaxLineItem; longTerm: TaxLineItem; flags: TaxCalculationFlag[] } {
  const flags: TaxCalculationFlag[] = [];

  const stProceeds = sumField(docs1099B, 'shortTermProceeds');
  const stCostBasis = sumField(docs1099B, 'shortTermCostBasis');
  const ltProceeds = sumField(docs1099B, 'longTermProceeds');
  const ltCostBasis = sumField(docs1099B, 'longTermCostBasis');

  const shortTermGain = Math.round(stProceeds - stCostBasis);
  const longTermGain = Math.round(ltProceeds - ltCostBasis);

  // Flag if cost basis data is missing (proceeds exist but no basis)
  const hasStProceeds = stProceeds > 0;
  const hasStBasis = docs1099B.some((d) => 'shortTermCostBasis' in d.fields);
  const hasLtProceeds = ltProceeds > 0;
  const hasLtBasis = docs1099B.some((d) => 'longTermCostBasis' in d.fields);

  if (hasStProceeds && !hasStBasis) {
    flags.push({
      fieldPath: 'shortTermCapitalGains',
      value: shortTermGain,
      reason: 'Short-term cost basis missing — gain calculated assuming $0 basis',
      sourceSection: 'IRC §1001',
      needsHumanReview: true,
    });
  }
  if (hasLtProceeds && !hasLtBasis) {
    flags.push({
      fieldPath: 'longTermCapitalGains',
      value: longTermGain,
      reason: 'Long-term cost basis missing — gain calculated assuming $0 basis',
      sourceSection: 'IRC §1001',
      needsHumanReview: true,
    });
  }

  const makeGainItem = (gain: number, label: string, box: string): TaxLineItem => ({
    value: gain,
    label: `${label} (${docs1099B.length} document${docs1099B.length !== 1 ? 's' : ''})`,
    source: { documentId: buildAggSource(docs1099B), formType: '1099-B', boxNumber: box },
    trace: { irsPublication: 'IRC §1222', calculationNote: `Proceeds minus cost basis` },
    flagged: flags.length > 0,
    flagReason: flags.length > 0 ? 'Review capital gain calculations' : undefined,
  });

  return {
    shortTerm: makeGainItem(shortTermGain, 'Short-term capital gain', 'ST'),
    longTerm: makeGainItem(longTermGain, 'Long-term capital gain', 'LT'),
    flags,
  };
}

// ─── Main Aggregation ───────────────────────────────────────────────

/**
 * Aggregate income from all extracted documents.
 * Groups by document type, sums relevant fields, produces IncomeSummary.
 *
 * @param documents - All extracted documents from the document-extraction module
 * @returns IncomeSummary with per-source breakdown and total gross income
 */
export function aggregateIncome(documents: ExtractedDocument[]): IncomeSummary {
  const flags: TaxCalculationFlag[] = [];

  // Group documents by type
  const w2s = documents.filter((d) => d.type === 'W2');
  const ints = documents.filter((d) => d.type === '1099-INT');
  const divs = documents.filter((d) => d.type === '1099-DIV');
  const necs = documents.filter((d) => d.type === '1099-NEC');
  const miscs = documents.filter((d) => d.type === '1099-MISC');
  const b1099s = documents.filter((d) => d.type === '1099-B');

  // Per-source aggregation
  const wages = w2s.length > 0
    ? aggregateItem(w2s, 'wages', 'W-2 wages', 'W2', '1', 'IRS Form 1040 Line 1')
    : zeroItem('W-2 wages', 'W2', '1', 'IRS Form 1040 Line 1');

  const interest = ints.length > 0
    ? aggregateItem(ints, 'interestIncome', 'Interest income', '1099-INT', '1', 'IRS Schedule B Line 1')
    : zeroItem('Interest income', '1099-INT', '1', 'IRS Schedule B Line 1');

  const ordinaryDividends = divs.length > 0
    ? aggregateItem(divs, 'ordinaryDividends', 'Ordinary dividends', '1099-DIV', '1a', 'IRS Schedule B Line 5')
    : zeroItem('Ordinary dividends', '1099-DIV', '1a', 'IRS Schedule B Line 5');

  const qualifiedDividends = divs.length > 0
    ? aggregateItem(divs, 'qualifiedDividends', 'Qualified dividends', '1099-DIV', '1b', 'IRC §1(h)(11)')
    : zeroItem('Qualified dividends', '1099-DIV', '1b', 'IRC §1(h)(11)');

  const nonemployeeComp = necs.length > 0
    ? aggregateItem(necs, 'nonemployeeComp', 'Nonemployee compensation', '1099-NEC', '1', 'IRS Schedule 1 Line 8')
    : zeroItem('Nonemployee compensation', '1099-NEC', '1', 'IRS Schedule 1 Line 8');

  const rentalIncome = miscs.length > 0
    ? aggregateItem(miscs, 'rents', 'Rental income', '1099-MISC', '1', 'IRS Schedule E')
    : zeroItem('Rental income', '1099-MISC', '1', 'IRS Schedule E');

  const otherIncome = miscs.length > 0
    ? aggregateItem(miscs, 'otherIncome', 'Other income', '1099-MISC', '3', 'IRS Schedule 1 Line 8z')
    : zeroItem('Other income', '1099-MISC', '3', 'IRS Schedule 1 Line 8z');

  // Capital gains (proceeds - cost basis)
 const { shortTerm: shortTermCapitalGains, longTerm: longTermCapitalGains, flags: cgFlags } =
    b1099s.length > 0
      ? calculateCapitalGains(b1099s)
      : { shortTerm: zeroItem('Short-term capital gain', '1099-B', 'ST', 'IRC §1222'), longTerm: zeroItem('Long-term capital gain', '1099-B', 'LT', 'IRC §1222'), flags: [] };
  flags.push(...cgFlags);

  // Gross income = wages + interest + ordinary divs + NEC + rental + other + ST gains + LT gains
  const grossIncomeValue = Math.round(
    wages.value + interest.value + ordinaryDividends.value
    + nonemployeeComp.value + rentalIncome.value + otherIncome.value
    + shortTermCapitalGains.value + longTermCapitalGains.value,
  );

  const grossIncome: TaxLineItem = {
    value: grossIncomeValue,
    label: 'Gross income',
    source: { documentId: 'AGGREGATED', formType: '1040', boxNumber: 'L7b' },
    trace: { irsPublication: 'IRS Form 1040 Line 7b', calculationNote: 'Sum of all income sources' },
    flagged: false,
  };

  return {
    wages,
    interest,
    ordinaryDividends,
    qualifiedDividends,
    nonemployeeComp,
    otherIncome,
    rentalIncome,
    grossIncome,
    shortTermCapitalGains,
    longTermCapitalGains,
    flags,
  };
}
