/**
 * W-2 Field Mapper — Maps OCR text to structured W-2 TaxLineItems.
 * Covers boxes: 1 (wages), 2 (fed tax), 3 (SS wages), 4 (SS tax),
 * 5 (Medicare wages), 6 (Medicare tax), 16 (state wages), 17 (state tax),
 * 18 (local wages), 19 (local tax).
 */

import type { TaxLineItem, ExtractedDocument } from '@/lib/types';
import type { OCRResult } from '../types';
const uuid = () => crypto.randomUUID();

// ─── W-2 Field Definitions ──────────────────────────────────────────

interface W2FieldDef {
  fieldPath: string;
  label: string;
  boxNumber: string;
 /** Regex to find the dollar value near the box label */
  pattern: RegExp;
  groupIndex: number; // which capture group has the number
  isDollar: boolean;
}

const W2_FIELDS: W2FieldDef[] = [
  { fieldPath: 'wages', label: 'Wages', boxNumber: '1', pattern: /(?:box\s*1|1\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'federalTax', label: 'Federal tax withheld', boxNumber: '2', pattern: /(?:box\s*2|2\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'ssWages', label: 'Social security wages', boxNumber: '3', pattern: /(?:box\s*3|3\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'ssTax', label: 'Social security tax withheld', boxNumber: '4', pattern: /(?:box\s*4|4\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'medicareWages', label: 'Medicare wages', boxNumber: '5', pattern: /(?:box\s*5|5\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'medicareTax', label: 'Medicare tax withheld', boxNumber: '6', pattern: /(?:box\s*6|6\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'stateWages', label: 'State wages', boxNumber: '16', pattern: /(?:box\s*16|16\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'stateTax', label: 'State income tax withheld', boxNumber: '17', pattern: /(?:box\s*17|17\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'localWages', label: 'Local wages', boxNumber: '18', pattern: /(?:box\s*18|18\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
  { fieldPath: 'localTax', label: 'Local income tax withheld', boxNumber: '19', pattern: /(?:box\s*19|19\s*\W).*?(\$?[\d,]+\.\d{2})/i, groupIndex: 1, isDollar: true },
];

// ─── SSN Detection & Masking ────────────────────────────────────────

const SSN_PATTERN = /\b(\d{3})[ -]?(\d{2})[ -]?(\d{4})\b/;

/** Mask SSN to XXX-XX-1234 format */
function maskSSN(raw: string): string {
  const match = raw.match(SSN_PATTERN);
  if (!match) return 'XXX-XX-XXXX';
  return `XXX-XX-${match[3]}`;
}

/** Extract and mask SSN from OCR text */
function extractSSN(text: string): { masked: string; confidence: number } {
  const match = text.match(SSN_PATTERN);
  if (!match) return { masked: 'XXX-XX-XXXX', confidence: 0 };
  return { masked: maskSSN(match[0]), confidence: 0.85 };
}

// ─── EIN Detection ──────────────────────────────────────────────────

const EIN_PATTERN = /\b(\d{2})[ -]?(\d{7})\b/;

function extractEIN(text: string): { value: string; confidence: number } {
  const match = text.match(EIN_PATTERN);
  if (!match) return { value: '', confidence: 0 };
  return { value: `${match[1]}-${match[2]}`, confidence: 0.8 };
}

// ─── OCR Error Correction ───────────────────────────────────────────

/** Common OCR substitutions in financial documents */
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

/** Parse a dollar string to number */
function parseDollar(str: string): number {
  const cleaned = correctOCRErrors(str);
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// ─── TaxLineItem Builder ────────────────────────────────────────────

function makeTaxLineItem(
  docId: string,
  def: W2FieldDef,
  value: number,
  confidence: number,
): TaxLineItem {
  return {
    value,
    label: def.label,
    source: { documentId: docId, formType: 'W2', boxNumber: def.boxNumber },
    trace: { irsPublication: 'IRS Form W-2', calculationNote: `Box ${def.boxNumber}` },
    flagged: confidence < 0.5,
    flagReason: confidence < 0.5 ? `Low OCR confidence: ${Math.round(confidence * 100)}%` : undefined,
  };
}

// ─── Main Mapper Function ───────────────────────────────────────────

/**
 * Map OCR text to structured W-2 ExtractedDocument.
 * Attempts regex-based extraction for each W-2 box field.
 *
 * @param ocrResult - Raw OCR output from client or server OCR
 * @returns ExtractedDocument with W-2 fields, confidence scores, masked SSN
 */
export function mapW2(ocrResult: OCRResult): ExtractedDocument {
  const docId = uuid();
  const text = ocrResult.fullText;
  const fields: Record<string, TaxLineItem> = {};
  const confidence: Record<string, number> = {};

  // Extract SSN
  const ssn = extractSSN(text);
  if (ssn.confidence > 0) {
    fields.employeeSSN = {
      value: 0,
      label: 'Employee SSN (masked)',
      source: { documentId: docId, formType: 'W2', boxNumber: 'ssn' },
      trace: { irsPublication: 'IRS Form W-2' },
      flagged: false,
    };
    confidence.employeeSSN = ssn.confidence;
  }

  // Extract EIN
  const ein = extractEIN(text);
  if (ein.confidence > 0) {
    fields.employerEIN = {
      value: 0,
      label: `Employer EIN: ${ein.value}`,
      source: { documentId: docId, formType: 'W2', boxNumber: 'ein' },
      trace: { irsPublication: 'IRS Form W-2' },
      flagged: false,
    };
    confidence.employerEIN = ein.confidence;
  }

  // Extract dollar fields
  for (const def of W2_FIELDS) {
    const match = text.match(def.pattern);
    if (match && match[def.groupIndex]) {
      const value = parseDollar(match[def.groupIndex]);
      // Confidence: base OCR confidence + boost for successful regex match
      const fieldConf = Math.min(1, ocrResult.overallConfidence + 0.15);
      fields[def.fieldPath] = makeTaxLineItem(docId, def, value, fieldConf);
      confidence[def.fieldPath] = fieldConf;
    }
  }

  return {
    id: docId,
    type: 'W2',
    fields,
    confidence,
    sourceFile: ocrResult.sourceFile,
    reviewed: false,
  };
}
