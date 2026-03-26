/**
 * 1099-INT Field Mapper — Maps OCR text to structured 1099-INT TaxLineItems.
 * Covers boxes: 1 (interest income), 2 (early withdrawal penalty),
 * 4 (federal income tax withheld).
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── Field Definitions ──────────────────────────────────────────────

interface INTFieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
  pattern: RegExp;
  groupIndex: number;
}

const INT_FIELDS: INTFieldDef[] = [
  {
    fieldPath: 'interestIncome',
    label: 'Interest income',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|interest\s+income).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'earlyWithdrawalPenalty',
    label: 'Early withdrawal penalty',
    boxNumber: '2',
    pattern: /(?:box\s*2|2\s*\W|early\s+withdrawal).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'federalTaxWithheld',
    label: 'Federal income tax withheld',
    boxNumber: '4',
    pattern: /(?:box\s*4|4\s*\W|federal\s+income\s+tax).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
];

// ─── SSN Masking ────────────────────────────────────────────────────

const SSN_PATTERN = /\b(\d{3})[ -]?(\d{2})[ -]?(\d{4})\b/;

function extractMaskedSSN(text: string): { masked: string; confidence: number } {
  const match = text.match(SSN_PATTERN);
  if (!match) return { masked: 'XXX-XX-XXXX', confidence: 0 };
  return { masked: `XXX-XX-${match[3]}`, confidence: 0.85 };
}

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

// ─── TaxLineItem Builder ────────────────────────────────────────────

function makeTaxLineItem(
  docId: string,
  def: INTFieldDef,
  value: number,
  confidence: number,
): TaxLineItem {
  return {
    value,
    label: def.label,
    source: { documentId: docId, formType: '1099-INT', boxNumber: def.boxNumber },
    trace: { irsPublication: 'IRS Form 1099-INT', calculationNote: `Box ${def.boxNumber}` },
    flagged: confidence < 0.5,
    flagReason: confidence < 0.5 ? `Low OCR confidence: ${Math.round(confidence * 100)}%` : undefined,
  };
}

// ─── Main Mapper ────────────────────────────────────────────────────

/**
 * Map OCR text to structured 1099-INT ExtractedDocument.
 *
 * @param ocrResult - Raw OCR output
 * @returns ExtractedDocument with 1099-INT fields
 */
export function map1099Int(ocrResult: OCRResult): ExtractedDocument {
  const docId = uuid();
  const text = ocrResult.fullText;
  const fields: Record<string, TaxLineItem> = {};
  const confidence: Record<string, number> = {};

  // SSN
  const ssn = extractMaskedSSN(text);
  if (ssn.confidence > 0) {
    fields.recipientSSN = {
      value: 0,
      label: 'Recipient SSN (masked)',
      source: { documentId: docId, formType: '1099-INT', boxNumber: 'ssn' },
      trace: { irsPublication: 'IRS Form 1099-INT' },
      flagged: false,
    };
    confidence.recipientSSN = ssn.confidence;
  }

  // Dollar fields
  for (const def of INT_FIELDS) {
    const match = text.match(def.pattern);
    if (match && match[def.groupIndex]) {
      const value = parseDollar(match[def.groupIndex]);
      const fieldConf = Math.min(1, ocrResult.overallConfidence + 0.15);
      fields[def.fieldPath] = makeTaxLineItem(docId, def, value, fieldConf);
      confidence[def.fieldPath] = fieldConf;
    }
  }

  return {
    id: docId,
    type: '1099-INT',
    fields,
    confidence,
    sourceFile: ocrResult.sourceFile,
    reviewed: false,
  };
}
