/**
 * Combined 1099-NEC + 1099-MISC Field Mapper
 * 1099-NEC: nonemployee compensation (box 1), federal tax withheld (box 4)
 * 1099-MISC: rents (box 1), other income (box 3), federal tax withheld (box 4)
 * Auto-detects form type from OCR header text.
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── Shared Field Definition ───────────────────────────────────────

interface FormFieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
  pattern: RegExp;
  groupIndex: number;
}

// ─── OCR Error Correction (shared) ──────────────────────────────────

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

// ─── Form Type Detection ────────────────────────────────────────────

export type DetectedFormType = '1099-NEC' | '1099-MISC' | 'unknown';

/** Detect form type from OCR header text */
export function detectNECorMISC(text: string): DetectedFormType {
  const lower = text.toLowerCase();
  if (lower.includes('1099-nec') || lower.includes('nonemployee compensation')) return '1099-NEC';
  if (lower.includes('1099-misc') || lower.includes('miscellaneous income')) return '1099-MISC';
  return 'unknown';
}

// ─── TaxLineItem Builder ────────────────────────────────────────────

function makeTaxLineItem(
  docId: string,
  formType: string,
  def: FormFieldDef,
  value: number,
  confidence: number,
): TaxLineItem {
  return {
    value,
    label: def.label,
    source: { documentId: docId, formType, boxNumber: def.boxNumber },
    trace: { irsPublication: `IRS Form ${formType}`, calculationNote: `Box ${def.boxNumber}` },
    flagged: confidence < 0.5,
    flagReason: confidence < 0.5 ? `Low OCR confidence: ${Math.round(confidence * 100)}%` : undefined,
  };
}

// ─── Shared Extraction Logic ────────────────────────────────────────

function extractFields(
  ocrResult: OCRResult,
  formType: string,
  fieldDefs: FormFieldDef[],
): ExtractedDocument {
  const docId = uuid();
  const text = ocrResult.fullText;
  const fields: Record<string, TaxLineItem> = {};
  const confidence: Record<string, number> = {};

  for (const def of fieldDefs) {
    const match = text.match(def.pattern);
    if (match && match[def.groupIndex]) {
      const value = parseDollar(match[def.groupIndex]);
      const fieldConf = Math.min(1, ocrResult.overallConfidence + 0.15);
      fields[def.fieldPath] = makeTaxLineItem(docId, formType, def, value, fieldConf);
      confidence[def.fieldPath] = fieldConf;
    }
  }

  return {
    id: docId,
    type: formType as ExtractedDocument['type'],
    fields,
    confidence,
    sourceFile: ocrResult.sourceFile,
    reviewed: false,
  };
}

// ─── NEC Fields ─────────────────────────────────────────────────────

const NEC_FIELDS: FormFieldDef[] = [
  {
    fieldPath: 'nonemployeeComp',
    label: 'Nonemployee compensation',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|nonemployee\s+comp).*?(\$?[\d,]+\.\d{2})/i,
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

// ─── MISC Fields ────────────────────────────────────────────────────

const MISC_FIELDS: FormFieldDef[] = [
  {
    fieldPath: 'rents',
    label: 'Rental income',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|rents?\s+received).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'otherIncome',
    label: 'Other income',
    boxNumber: '3',
    pattern: /(?:box\s*3|3\s*\W|other\s+income).*?(\$?[\d,]+\.\d{2})/i,
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

// ─── Public Mapper Functions ────────────────────────────────────────

/** Map OCR text to 1099-NEC ExtractedDocument */
export function map1099Nec(ocrResult: OCRResult): ExtractedDocument {
  return extractFields(ocrResult, '1099-NEC', NEC_FIELDS);
}

/** Map OCR text to 1099-MISC ExtractedDocument */
export function map1099Misc(ocrResult: OCRResult): ExtractedDocument {
  return extractFields(ocrResult, '1099-MISC', MISC_FIELDS);
}

/**
 * Auto-detect and map either 1099-NEC or 1099-MISC.
 * Falls back to 1099-NEC if detection fails.
 */
export function map1099NecOrMisc(ocrResult: OCRResult): ExtractedDocument {
  const detected = detectNECorMISC(ocrResult.fullText);
  if (detected === '1099-MISC') return map1099Misc(ocrResult);
  return map1099Nec(ocrResult);
}
