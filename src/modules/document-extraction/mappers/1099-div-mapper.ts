/**
 * 1099-DIV Field Mapper — Maps OCR text to structured 1099-DIV TaxLineItems.
 * Covers boxes: 1a (ordinary dividends), 1b (qualified dividends),
 * 2a (capital gains distributions), 4 (federal tax withheld).
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── Field Definitions ──────────────────────────────────────────────

interface DIVFieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
  pattern: RegExp;
  groupIndex: number;
}

const DIV_FIELDS: DIVFieldDef[] = [
  {
    fieldPath: 'ordinaryDividends',
    label: 'Ordinary dividends',
    boxNumber: '1a',
    pattern: /(?:box\s*1a|1a\s*\W|total\s+ordinary).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'qualifiedDividends',
    label: 'Qualified dividends',
    boxNumber: '1b',
    pattern: /(?:box\s*1b|1b\s*\W|qualified).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'capitalGainsDistributions',
    label: 'Capital gains distributions',
    boxNumber: '2a',
    pattern: /(?:box\s*2a|2a\s*\W|capital\s+gain\s+dist).*?(\$?[\d,]+\.\d{2})/i,
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
  def: DIVFieldDef,
  value: number,
  confidence: number,
): TaxLineItem {
  return {
    value,
    label: def.label,
    source: { documentId: docId, formType: '1099-DIV', boxNumber: def.boxNumber },
    trace: {
      irsPublication: 'IRS Form 1099-DIV',
      calculationNote: `Box ${def.boxNumber}`,
    },
    flagged: confidence < 0.5,
    flagReason:
      confidence < 0.5
        ? `Low OCR confidence: ${Math.round(confidence * 100)}%`
        : undefined,
  };
}

// ─── Main Mapper ────────────────────────────────────────────────────

/**
 * Map OCR text to structured 1099-DIV ExtractedDocument.
 * Qualified dividends (1b) are critical for preferential tax rate calculation.
 *
 * @param ocrResult - Raw OCR output
 * @returns ExtractedDocument with 1099-DIV fields
 */
export function map1099Div(ocrResult: OCRResult): ExtractedDocument {
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
      source: { documentId: docId, formType: '1099-DIV', boxNumber: 'ssn' },
      trace: { irsPublication: 'IRS Form 1099-DIV' },
      flagged: false,
    };
    confidence.recipientSSN = ssn.confidence;
  }

  // Dollar fields
  for (const def of DIV_FIELDS) {
    const match = text.match(def.pattern);
    if (match && match[def.groupIndex]) {
      const value = parseDollar(match[def.groupIndex]);
      const fieldConf = Math.min(1, ocrResult.overallConfidence + 0.15);
      fields[def.fieldPath] = makeTaxLineItem(docId, def, value, fieldConf);
      confidence[def.fieldPath] = fieldConf;
    }
  }

  // Validation: qualified dividends should not exceed ordinary dividends
  const ord = fields.ordinaryDividends?.value ?? 0;
  const qual = fields.qualifiedDividends?.value ?? 0;
  if (qual > ord && ord > 0) {
    fields.qualifiedDividends.flagged = true;
    fields.qualifiedDividends.flagReason =
      'Qualified dividends exceed ordinary dividends — possible OCR error';
    confidence.qualifiedDividends = Math.max(0, confidence.qualifiedDividends - 0.2);
  }

  return {
    id: docId,
    type: '1099-DIV',
    fields,
    confidence,
    sourceFile: ocrResult.sourceFile,
    reviewed: false,
  };
}
