/**
 * 1099-B Field Mapper — Maps OCR text to structured 1099-B TaxLineItems.
 * Covers per-transaction boxes 1a-1h and summary boxes 2-5.
 * Separates short-term and long-term transactions.
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── Transaction Type ───────────────────────────────────────────────

export interface Transaction {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  adjustmentCode: string;
  adjustmentAmount: number;
 gainOrLoss: number;
 term: 'short' | 'long' | 'unknown';
  confidence: number;
}

// ─── Summary Field Definitions ──────────────────────────────────────

interface SummaryFieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
  pattern: RegExp;
  groupIndex: number;
}

const SUMMARY_FIELDS: SummaryFieldDef[] = [
  {
    fieldPath: 'shortTermProceeds',
    label: 'Short-term proceeds',
    boxNumber: '2',
    pattern: /(?:box\s*2|2\s*\W|short.?term\s+proceeds).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'shortTermCostBasis',
    label: 'Short-term cost basis',
    boxNumber: '3',
    pattern: /(?:box\s*3|3\s*\W|short.?term\s+cost).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'longTermProceeds',
    label: 'Long-term proceeds',
    boxNumber: '4',
    pattern: /(?:box\s*4|4\s*\W|long.?term\s+proceeds).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'longTermCostBasis',
    label: 'Long-term cost basis',
    boxNumber: '5',
    pattern: /(?:box\s*5|5\s*\W|long.?term\s+cost).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
];

// ─── OCR Error Correction ───────────────────────────────────────────

function correctOCRErrors(str: string): string {
  return str
    .replace(/[Oo]/g, (c, offset) => {
      const prev = str[offset - 1];
      const next = str[offset + 1];
      if (/[\d,.$]/.test(prev) || /[\d,.$]/.test(next)) return '0';
      return c;
    })
    .replace(/[lI|]/g, (c, offset) => {
      const prev = str[offset - 1];
      const next = str[offset + 1];
      if (/[\d,.$]/.test(prev) || /[\d,.$]/.test(next)) return '1';
      return c;
    })
    .replace(/\$/g, '')
    .replace(/,/g, '');
}

function parseDollar(str: string): number {
  const cleaned = correctOCRErrors(str);
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// ─── Term Detection ─────────────────────────────────────────────────

function detectTerm(text: string): 'short' | 'long' | 'unknown' {
  const lower = text.toLowerCase();
  if (lower.includes('short-term') || lower.includes('short term') || lower.includes('st ')) return 'short';
  if (lower.includes('long-term') || lower.includes('long term') || lower.includes('lt ')) return 'long';
  return 'unknown';
}

// ─── Transaction Parsing (Best-Effort) ─────────────────────────────

/**
 * Attempt to parse individual transactions from OCR text.
 * This is best-effort — table-like OCR data is inherently unreliable.
 * Summary boxes (2-5) should be used as the authoritative source.
 */
function parseTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];

  // Match rows that look like: description ... date ... date ... $amount ... $amount
  const rowPattern =
    /(.{3,40}?)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\$?[\d,]+\.\d{2})\s+(\$?[\d,]+\.\d{2})/g;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    const proceeds = parseDollar(match[4]);
    const costBasis = parseDollar(match[5]);
    transactions.push({
      description: match[1].trim(),
      dateAcquired: match[2],
      dateSold: match[3],
      proceeds,
      costBasis,
      adjustmentCode: '',
      adjustmentAmount: 0,
      gainOrLoss: Math.round((proceeds - costBasis) * 100) / 100,
      term: detectTerm(match[0]),
      confidence: 0.4, // low confidence for table-parsed data
    });
  }

  return transactions;
}

// ─── TaxLineItem Builder ────────────────────────────────────────────

function makeTaxLineItem(
  docId: string,
  def: SummaryFieldDef,
  value: number,
  confidence: number,
): TaxLineItem {
  return {
    value,
    label: def.label,
    source: { documentId: docId, formType: '1099-B', boxNumber: def.boxNumber },
    trace: { irsPublication: 'IRS Form 1099-B', calculationNote: `Box ${def.boxNumber}` },
    flagged: confidence < 0.5,
    flagReason: confidence < 0.5 ? `Low OCR confidence: ${Math.round(confidence * 100)}%` : undefined,
  };
}

// ─── Main Mapper ────────────────────────────────────────────────────

/**
 * Map OCR text to structured 1099-B ExtractedDocument.
 * Summary boxes (2-5) are the primary data source.
 * Individual transactions are parsed best-effort for audit trail.
 *
 * @param ocrResult - Raw OCR output
 * @returns ExtractedDocument with 1099-B fields and transaction data
 */
export function map1099B(ocrResult: OCRResult): ExtractedDocument {
  const docId = uuid();
  const text = ocrResult.fullText;
  const fields: Record<string, TaxLineItem> = {};
  const confidence: Record<string, number> = {};

  // Parse summary boxes (authoritative)
  for (const def of SUMMARY_FIELDS) {
    const match = text.match(def.pattern);
    if (match && match[def.groupIndex]) {
      const value = parseDollar(match[def.groupIndex]);
      const fieldConf = Math.min(1, ocrResult.overallConfidence + 0.15);
      fields[def.fieldPath] = makeTaxLineItem(docId, def, value, fieldConf);
      confidence[def.fieldPath] = fieldConf;
    }
  }

  // Parse transactions (best-effort)
  const transactions = parseTransactions(text);
  const shortTxns = transactions.filter((t) => t.term === 'short' || t.term === 'unknown');
  const longTxns = transactions.filter((t) => t.term === 'long');

  // If summary boxes missing, aggregate from transactions
  if (!fields.shortTermProceeds && shortTxns.length > 0) {
    const total = shortTxns.reduce((s, t) => s + t.proceeds, 0);
    fields.shortTermProceeds = makeTaxLineItem(
      docId,
      { fieldPath: 'shortTermProceeds', label: 'Short-term proceeds (aggregated)', boxNumber: '2', pattern: /./, groupIndex: 0 },
      Math.round(total * 100) / 100, 0.35,
    );
    confidence.shortTermProceeds = 0.35;
    fields.shortTermProceeds.flagReason = 'Aggregated from OCR-parsed transactions — verify against form';
  }

  if (!fields.longTermProceeds && longTxns.length > 0) {
    const total = longTxns.reduce((s, t) => s + t.proceeds, 0);
    fields.longTermProceeds = makeTaxLineItem(
      docId,
      { fieldPath: 'longTermProceeds', label: 'Long-term proceeds (aggregated)', boxNumber: '4', pattern: /./, groupIndex: 0 },
      Math.round(total * 100) / 100, 0.35,
    );
    confidence.longTermProceeds = 0.35;
    fields.longTermProceeds.flagReason = 'Aggregated from OCR-parsed transactions — verify against form';
  }

  // Store transaction count as metadata
  fields._transactionCount = {
    value: transactions.length,
    label: `Transactions parsed: ${transactions.length} (S:${shortTxns.length} L:${longTxns.length})`,
    source: { documentId: docId, formType: '1099-B', boxNumber: '_meta' },
    trace: { calculationNote: 'OCR-parsed transaction count' },
    flagged: transactions.length === 0,
    flagReason: transactions.length === 0 ? 'No individual transactions parsed from OCR' : undefined,
  };
  confidence._transactionCount = transactions.length > 0 ? 0.4 : 0;

  return {
    id: docId,
    type: '1099-B',
    fields,
    confidence,
    sourceFile: ocrResult.sourceFile,
    reviewed: false,
  };
}
