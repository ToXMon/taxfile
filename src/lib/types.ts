/** Centralized type definitions for TaxFile. All modules import from here. */

// ─── Document Types ───────────────────────────────────────────────

export type DocumentType =
  | 'W2' | '1099-INT' | '1099-DIV' | '1099-B' | '1099-NEC'
  | '1099-MISC' | '1098' | '1098-T' | '1098-E'
  | '1095-A' | '1095-B' | '1095-C';

export interface TaxLineItemSource {
  documentId: string;
  formType: string;
  boxNumber: string;
}

export interface TaxLineItemTrace {
  irsPublication?: string;
  njTaxCode?: string;
  calculationNote?: string;
}

export interface TaxLineItem {
  value: number;
  label: string;
  source: TaxLineItemSource;
  trace: TaxLineItemTrace;
  flagged: boolean;
  flagReason?: string;
}

export type FormLineMap = Record<string, TaxLineItem>;

export interface ExtractedDocument {
  id: string;
  type: DocumentType;
  fields: Record<string, TaxLineItem>;
  confidence: Record<string, number>;
  sourceFile: string;
  reviewed: boolean;
}

// ─── Taxpayer ──────────────────────────────────────────────────────

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Dependent {
  firstName: string;
  lastName: string;
  relationship: string;
  birthYear: number;
  ssnMasked: string;
  qualifyingChild: boolean;
  qualifyingRelative: boolean;
}

export interface TaxpayerInfo {
  firstName: string;
  lastName: string;
  ssnMasked: string;
  address: Address;
  filingStatus: FilingStatus;
  spouse?: {
    firstName: string;
    lastName: string;
    ssnMasked: string;
  };
  dependents: Dependent[];
  taxYear: number;
}

// ─── Additional Answers (not from documents) ──────────────────────

export interface AdditionalAnswers {
  otherIncome: number;
  otherAdjustments: number;
  njResident: boolean;
  njPropertyTaxPaid: number;
  studentLoanInterestPaid: number;
  educatorExpenses: number;
  iraContributions: number;
  hsaContributions: number;
  alimonyPaid: number;
  alimonyReceived: number;
}

// ─── Tax Calculation Flags ────────────────────────────────────────

export interface TaxCalculationFlag {
  fieldPath: string;
  value: number;
  reason: string;
  sourceSection: string;
  needsHumanReview: boolean;
}

// ─── Federal Forms ─────────────────────────────────────────────────

export interface FederalForms {
  form1040: FormLineMap;
  schedule1: FormLineMap;
  schedule2: FormLineMap;
  schedule3: FormLineMap;
  scheduleA: FormLineMap;
  scheduleB: FormLineMap;
  scheduleD: FormLineMap;
  schedule8812: FormLineMap;
}

// ─── NJ State Forms ────────────────────────────────────────────────

export interface NJForms {
  nj1040: FormLineMap;
  scheduleA: FormLineMap;
  scheduleB: FormLineMap;
  scheduleC: FormLineMap;
}

// ─── Tax Summary ───────────────────────────────────────────────────

export interface TaxSummary {
  totalIncome: number;
  adjustments: number;
  deductions: number;
  taxableIncome: { federal: number; state: number };
  federalTax: number;
  stateTax: number;
  totalTax: number;
  totalPayments: number;
  refundOrOwed: number;
  effectiveRate: number;
}

// ─── Audit Trail ───────────────────────────────────────────────────

export interface AuditTrailEntry {
  timestamp: string;
  action: string;
  fieldPath: string;
  previousValue: number | null;
  newValue: number | null;
  source: string;
}

// ─── Complete Tax Return ───────────────────────────────────────────

export interface CompleteTaxReturn {
  taxpayer: TaxpayerInfo;
  taxYear: number;
  federal: FederalForms;
  newJersey: NJForms;
  summary: TaxSummary;
  auditTrail: AuditTrailEntry[];
  flags: TaxCalculationFlag[];
}

// ─── Database Record ───────────────────────────────────────────────

export type ReturnStatus = 'draft' | 'in-progress' | 'review' | 'complete';

export interface TaxReturnRecord {
  id: string;
  taxYear: number;
  taxpayer: TaxpayerInfo;
  documents: ExtractedDocument[];
  additionalAnswers: AdditionalAnswers;
  calculatedReturn: CompleteTaxReturn | null;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Wizard Flow ───────────────────────────────────────────────────

export enum WizardStep {
  UPLOAD = 'upload',
  REVIEW = 'review',
  QUESTIONS = 'questions',
  CALCULATE = 'calculate',
  SUMMARY = 'summary',
  FORMS = 'forms',
}

// ─── API Contracts ─────────────────────────────────────────────────

export interface ExtractRequest {
  file: File;
  documentTypeHint?: DocumentType;
  returnId: string;
}

export interface CalculateRequest {
  taxpayer: TaxpayerInfo;
  documents: ExtractedDocument[];
  answers: AdditionalAnswers;
}

export interface FormsRequest {
  taxReturn: CompleteTaxReturn;
}

export interface FormPdfOutput {
  formName: string;
  pdfBuffer: Uint8Array;
}
