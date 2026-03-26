/**
 * Combined 1098 Family Field Mapper
 * 1098: mortgage interest (box 1), outstanding (box 2), MIP (box 5), property taxes (box 10)
 * 1098-E: student loan interest (box 1)
 * 1098-T: tuition (box 1), scholarships (box 5)
 * Auto-detects form variant from OCR header text.
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── Types ──────────────────────────────────────────────────────────

interface FormFieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
  pattern: RegExp;
  groupIndex: number;
}

export type Detected1098Type = '1098' | '1098-E' | '1098-T' | 'unknown';

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

// ─── Form Type Detection ────────────────────────────────────────────

/** Detect 1098 variant from OCR header text */
export function detect1098Variant(text: string): Detected1098Type {
  const lower = text.toLowerCase();
  if (lower.includes('1098-e') || lower.includes('student loan interest')) return '1098-E';
  if (lower.includes('1098-t') || lower.includes('tuition statement')) return '1098-T';
  if (lower.includes('1098') || lower.includes('mortgage interest')) return '1098';
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

// ─── Shared Extraction ──────────────────────────────────────────────

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

// ─── 1098 (Mortgage) Fields ─────────────────────────────────────────

const MORTGAGE_FIELDS: FormFieldDef[] = [
  {
    fieldPath: 'mortgageInterest',
    label: 'Mortgage interest received',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|mortgage\s+interest).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'outstandingPrincipal',
    label: 'Outstanding mortgage principal',
    boxNumber: '2',
    pattern: /(?:box\s*2|2\s*\W|outstanding).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'mortgageInsurancePremium',
    label: 'Mortgage insurance premiums',
    boxNumber: '5',
    pattern: /(?:box\s*5|5\s*\W|mip|insurance\s+premium).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'propertyTaxes',
    label: 'Property taxes paid',
    boxNumber: '10',
    pattern: /(?:box\s*10|10\s*\W|property\s+tax).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
];

// ─── 1098-E Fields ──────────────────────────────────────────────────

const STUDENT_LOAN_FIELDS: FormFieldDef[] = [
  {
    fieldPath: 'studentLoanInterest',
    label: 'Student loan interest received',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|student\s+loan\s+interest).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
];

// ─── 1098-T Fields ──────────────────────────────────────────────────

const TUITION_FIELDS: FormFieldDef[] = [
  {
    fieldPath: 'tuitionExpenses',
    label: 'Tuition and related expenses',
    boxNumber: '1',
    pattern: /(?:box\s*1|1\s*\W|tuition|qualified\s+tuition).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
  {
    fieldPath: 'scholarships',
    label: 'Scholarships or grants',
    boxNumber: '5',
    pattern: /(?:box\s*5|5\s*\W|scholarship|grant).*?(\$?[\d,]+\.\d{2})/i,
    groupIndex: 1,
  },
];

// ─── Public Mapper Functions ────────────────────────────────────────

/** Map OCR text to 1098 (Mortgage) ExtractedDocument */
export function map1098(ocrResult: OCRResult): ExtractedDocument {
  return extractFields(ocrResult, '1098', MORTGAGE_FIELDS);
}

/** Map OCR text to 1098-E (Student Loan) ExtractedDocument */
export function map1098E(ocrResult: OCRResult): ExtractedDocument {
  return extractFields(ocrResult, '1098-E', STUDENT_LOAN_FIELDS);
}

/** Map OCR text to 1098-T (Tuition) ExtractedDocument */
export function map1098T(ocrResult: OCRResult): ExtractedDocument {
  return extractFields(ocrResult, '1098-T', TUITION_FIELDS);
}

/**
 * Auto-detect and map the correct 1098 variant.
 * Falls back to 1098 (mortgage) if detection fails.
 */
export function map1098Auto(ocrResult: OCRResult): ExtractedDocument {
  const variant = detect1098Variant(ocrResult.fullText);
  switch (variant) {
    case '1098-E': return map1098E(ocrResult);
    case '1098-T': return map1098T(ocrResult);
    default: return map1098(ocrResult);
  }
}
