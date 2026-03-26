/**
 * Schedule B — Interest and Ordinary Dividends
 * Required when total interest > $1,500 or total ordinary dividends > $1,500.
 * Lists each payer and amount from 1099-INT and 1099-DIV documents.
 */

import type { ExtractedDocument, TaxLineItem, FormLineMap } from '@/lib/types';
import type { IncomeSummary } from '../types';

// ─── Constants ──────────────────────────────────────────────────────

/** Schedule B filing threshold per IRS instructions */
const SCHEDULE_B_THRESHOLD = 1500;

// ─── Types ──────────────────────────────────────────────────────────

interface PayerEntry {
  documentId: string;
  payerLabel: string;
  amount: TaxLineItem;
}

export interface ScheduleBResult {
  /** Whether Schedule B is required */
  required: boolean;
  /** Why Schedule B is (or isn't) required */
  requirementReason: string;
  /** Interest payer entries */
  interestPayers: PayerEntry[];
  /** Dividend payer entries */
  dividendPayers: PayerEntry[];
  /** Total interest (Line 2) */
  totalInterest: TaxLineItem;
  /** Total ordinary dividends (Line 6) */
  totalDividends: TaxLineItem;
  /** Schedule B form lines */
  formLines: FormLineMap;
  /** Flags generated */
  flags: Array<{ fieldPath: string; value: number; reason: string; sourceSection: string; needsHumanReview: boolean }>;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a payer entry from a document */
function makePayerEntry(
  doc: ExtractedDocument,
  fieldPath: string,
  label: string,
  boxNumber: string,
  irsRef: string,
): PayerEntry {
  return {
    documentId: doc.id,
    payerLabel: `Payer (Doc ${doc.id.slice(0, 8)})`,
    amount: {
      value: doc.fields[fieldPath]?.value ?? 0,
      label: `${label} from payer`,
      source: { documentId: doc.id, formType: doc.type, boxNumber },
      trace: { irsPublication: irsRef, calculationNote: `From ${doc.sourceFile}` },
      flagged: doc.fields[fieldPath]?.flagged ?? false,
      flagReason: doc.fields[fieldPath]?.flagReason,
    },
  };
}

/** Sum payer amounts into a total TaxLineItem */
function sumPayers(
  payers: PayerEntry[],
  label: string,
  formType: string,
  boxNumber: string,
  irsRef: string,
): TaxLineItem {
  const value = Math.round(payers.reduce((s, p) => s + p.amount.value, 0));
  const docIds = payers.map((p) => p.documentId).join(', ') || 'none';
  const hasFlagged = payers.some((p) => p.amount.flagged);
  return {
    value,
    label: `${label} (${payers.length} payer${payers.length !== 1 ? 's' : ''})`,
    source: { documentId: docIds, formType, boxNumber },
    trace: { irsPublication: irsRef, calculationNote: `Sum of ${payers.length} payer(s)` },
    flagged: hasFlagged,
    flagReason: hasFlagged ? 'One or more payer amounts flagged' : undefined,
  };
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Build Schedule B from documents and income aggregation.
 * Determines if Schedule B is required, lists payers, computes totals.
 *
 * @param documents - All extracted documents
 * @param income - IncomeSummary from aggregateIncome()
 * @returns ScheduleBResult with payer detail, totals, and form lines
 */
export function buildScheduleB(
  documents: ExtractedDocument[],
  income: IncomeSummary,
): ScheduleBResult {
  const flags: ScheduleBResult['flags'] = [];

  // Filter relevant documents
  const intDocs = documents.filter((d) => d.type === '1099-INT');
  const divDocs = documents.filter((d) => d.type === '1099-DIV');

  // Build payer entries
  const interestPayers = intDocs.map((d) =>
    makePayerEntry(d, 'interestIncome', 'Interest', '1', 'IRS Schedule B Part I'),
  );
  const dividendPayers = divDocs.map((d) =>
    makePayerEntry(d, 'ordinaryDividends', 'Ordinary dividends', '1a', 'IRS Schedule B Part II'),
  );

  // Totals
  const totalInterest = sumPayers(
    interestPayers, 'Total interest', '1099-INT', '1', 'IRS Schedule B Line 2',
  );
  const totalDividends = sumPayers(
    dividendPayers, 'Total ordinary dividends', '1099-DIV', '1a', 'IRS Schedule B Line 6',
  );

  // Validate totals match aggregation
  if (totalInterest.value !== income.interest.value) {
    flags.push({
      fieldPath: 'scheduleB.interestTotal',
      value: totalInterest.value,
      reason: `Schedule B interest total (${totalInterest.value}) does not match aggregation (${income.interest.value})`,
      sourceSection: 'IRS Schedule B Line 2',
      needsHumanReview: true,
    });
  }
  if (totalDividends.value !== income.ordinaryDividends.value) {
    flags.push({
      fieldPath: 'scheduleB.dividendTotal',
      value: totalDividends.value,
      reason: `Schedule B dividend total (${totalDividends.value}) does not match aggregation (${income.ordinaryDividends.value})`,
      sourceSection: 'IRS Schedule B Line 6',
      needsHumanReview: true,
    });
  }

  // Determine requirement
  const required = totalInterest.value > SCHEDULE_B_THRESHOLD
    || totalDividends.value > SCHEDULE_B_THRESHOLD;
  const reasons: string[] = [];
  if (totalInterest.value > SCHEDULE_B_THRESHOLD) {
    reasons.push(`Interest $${totalInterest.value} > $${SCHEDULE_B_THRESHOLD}`);
  }
  if (totalDividends.value > SCHEDULE_B_THRESHOLD) {
    reasons.push(`Dividends $${totalDividends.value} > $${SCHEDULE_B_THRESHOLD}`);
  }
  const requirementReason = required
    ? reasons.join('; ')
    : `Neither interest ($${totalInterest.value}) nor dividends ($${totalDividends.value}) exceed $${SCHEDULE_B_THRESHOLD} threshold`;

  // Build form lines
  const formLines: FormLineMap = {
    'L1': { ...totalInterest, label: 'List of interest (Part I)', source: { ...totalInterest.source, boxNumber: 'L1' } },
    'L2': totalInterest,
    'L4': { value: 0, label: 'Tax-exempt interest', source: { documentId: 'none', formType: '1099-INT', boxNumber: '8' }, trace: { irsPublication: 'IRS Schedule B Line 4' }, flagged: false },
    'L5': { value: totalInterest.value, label: 'Taxable interest (L2 - L4)', source: { documentId: 'AGGREGATED', formType: '1040', boxNumber: 'L5' }, trace: { irsPublication: 'IRS Schedule B Line 5', calculationNote: 'L2 minus L4' }, flagged: false },
    'L6': totalDividends,
  };

  return {
    required,
    requirementReason,
    interestPayers,
    dividendPayers,
    totalInterest,
    totalDividends,
    formLines,
    flags,
  };
}
