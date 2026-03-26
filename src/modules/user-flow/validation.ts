/**
 * Error Highlighting + Missing Document Detection
 * Pre-calculation validation: missing docs, inconsistencies, audit triggers,
 * missing dependent info. Returns ValidationIssue[] with severity.
 */

import type {
  ExtractedDocument,
  TaxpayerInfo,
  AdditionalAnswers,
  DocumentType,
} from '@/lib/types';

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  fieldPath: string;
  suggestion?: string;
}

/**
 * Required documents based on taxpayer situation.
 * Rules derived from IRS filing requirements.
 */
function getRequiredDocTypes(taxpayer: TaxpayerInfo, answers: AdditionalAnswers): DocumentType[] {
  const required: DocumentType[] = ['W2'];

  if (answers.otherIncome > 0 || answers.alimonyReceived > 0) {
    // May need 1099-NEC or 1099-MISC but not strictly required to upload
  }

  return required;
}

/**
 * Suggested documents based on data patterns.
 */
function getSuggestedDocTypes(taxpayer: TaxpayerInfo, answers: AdditionalAnswers): DocumentType[] {
  const suggested: DocumentType[] = [];

  if (answers.studentLoanInterestPaid > 0) suggested.push('1098-E');
  if (answers.njPropertyTaxPaid > 0) suggested.push('1098');

  return suggested;
}

/**
 * Detect inconsistencies between documents and answers.
 */
function detectInconsistencies(
  documents: ExtractedDocument[],
  taxpayer: TaxpayerInfo,
  answers: AdditionalAnswers,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check: if itemizing but no 1098 uploaded
  if (answers.njPropertyTaxPaid > 0) {
    const has1098 = documents.some((d) => d.type === '1098');
    if (!has1098) {
      issues.push({
        code: 'MISSING_1098',
        severity: 'warning',
        message: 'Property tax deduction claimed but no 1098 uploaded',
        fieldPath: 'additionalAnswers.njPropertyTaxPaid',
        suggestion: 'Upload Form 1098 to verify mortgage interest deduction',
      });
    }
  }

  // Check: if student loan interest claimed but no 1098-E
  if (answers.studentLoanInterestPaid > 0) {
    const has1098e = documents.some((d) => d.type === '1098-E');
    if (!has1098e) {
      issues.push({
        code: 'MISSING_1098E',
        severity: 'warning',
        message: 'Student loan interest deduction claimed but no 1098-E uploaded',
        fieldPath: 'additionalAnswers.studentLoanInterestPaid',
        suggestion: 'Upload Form 1098-E to verify student loan interest',
      });
    }
  }

  // Check: W-2 wages vs interest/dividend documents
  const w2Docs = documents.filter((d) => d.type === 'W2');
 const intDocs = documents.filter((d) => d.type === '1099-INT');
 const divDocs = documents.filter((d) => d.type === '1099-DIV');

  for (const w2 of w2Docs) {
    const wages = w2.fields['wages']?.value ?? 0;
    if (wages > 200000 && !intDocs.length && !divDocs.length) {
      issues.push({
        code: 'HIGH_INCOME_NO_INVESTMENT',
        severity: 'warning',
        message: `W-2 wages of $${wages.toLocaleString()} but no investment income documents`,
        fieldPath: `documents.${w2.id}.fields.wages`,
        suggestion: 'Consider if you have 1099-INT or 1099-DIV forms to upload',
      });
    }
  }

  // Check: duplicate documents of same type
  const typeCounts: Record<string, number> = {};
  for (const doc of documents) {
    typeCounts[doc.type] = (typeCounts[doc.type] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > 3) {
      issues.push({
        code: 'DUPLICATE_DOCS',
        severity: 'warning',
        message: `${count} ${type} documents uploaded - verify these are not duplicates`,
        fieldPath: 'documents',
        suggestion: 'Remove any duplicate documents to avoid double-counting income',
      });
    }
  }

  return issues;
}

/**
 * Detect audit trigger conditions.
 */
function detectAuditTriggers(
  documents: ExtractedDocument[],
  taxpayer: TaxpayerInfo,
  answers: AdditionalAnswers,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // High itemized deductions relative to income
  const totalWages = documents
    .filter((d) => d.type === 'W2')
    .reduce((sum, d) => sum + (d.fields['wages']?.value ?? 0), 0);

  const itemizedTotal = answers.njPropertyTaxPaid + (answers.otherAdjustments > 0 ? 0 : 0);
  if (totalWages > 0 && itemizedTotal > totalWages * 0.4) {
    issues.push({
      code: 'HIGH_DEDUCTION_RATIO',
      severity: 'warning',
      message: 'Itemized deductions exceed 40% of gross income - potential audit flag',
      fieldPath: 'additionalAnswers',
      suggestion: 'Ensure all deductions are documented and accurate',
    });
  }

  // Schedule C with no documents
  const hasNec = documents.some((d) => d.type === '1099-NEC');
  const hasMisc = documents.some((d) => d.type === '1099-MISC');
  if (!hasNec && !hasMisc && answers.otherIncome > 10000) {
    issues.push({
      code: 'HIGH_OTHER_INCOME_NO_1099',
      severity: 'warning',
      message: 'Significant other income reported without 1099-NEC/1099-MISC',
      fieldPath: 'additionalAnswers.otherIncome',
      suggestion: 'Upload supporting 1099 forms for self-employment income',
    });
  }

  return issues;
}

/**
 * Check for missing dependent information.
 */
function checkDependents(taxpayer: TaxpayerInfo): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < taxpayer.dependents.length; i++) {
    const dep = taxpayer.dependents[i];
    if (dep.qualifyingChild && (!dep.birthYear || dep.birthYear < 1900)) {
      issues.push({
        code: 'MISSING_BIRTH_YEAR',
        severity: 'error',
        message: `Dependent ${dep.firstName} ${dep.lastName} missing valid birth year`,
        fieldPath: `taxpayer.dependents[${i}].birthYear`,
        suggestion: 'Enter birth year to determine Child Tax Credit eligibility',
      });
    }
    if (!dep.relationship) {
      issues.push({
        code: 'MISSING_RELATIONSHIP',
        severity: 'warning',
        message: `Dependent ${dep.firstName} ${dep.lastName} missing relationship`,
        fieldPath: `taxpayer.dependents[${i}].relationship`,
        suggestion: 'Specify relationship (son, daughter, etc.) for dependency tests',
      });
    }
  }

  return issues;
}

/**
 * Main validation function.
 * Runs all validation rules and returns aggregated issues.
 * Errors block calculation, warnings allow proceeding.
 */
export function validateReturn(inputs: {
  documents: ExtractedDocument[];
  taxpayer: TaxpayerInfo;
  additionalAnswers: AdditionalAnswers;
}): ValidationIssue[] {
  const { documents, taxpayer, additionalAnswers } = inputs;
  const issues: ValidationIssue[] = [];

  // 1. Missing required documents
  const required = getRequiredDocTypes(taxpayer, additionalAnswers);
  const uploadedTypes = new Set(documents.map((d) => d.type));
  for (const reqType of required) {
    if (!uploadedTypes.has(reqType)) {
      issues.push({
        code: 'MISSING_REQUIRED_DOC',
        severity: 'error',
        message: `Required document ${reqType} not uploaded`,
        fieldPath: 'documents',
        suggestion: `Upload Form ${reqType} to proceed`,
      });
    }
  }

  // 2. Missing suggested documents
  const suggested = getSuggestedDocTypes(taxpayer, additionalAnswers);
  for (const sugType of suggested) {
    if (!uploadedTypes.has(sugType)) {
      issues.push({
        code: 'MISSING_SUGGESTED_DOC',
        severity: 'warning',
        message: `Form ${sugType} may be relevant based on your answers`,
        fieldPath: 'documents',
        suggestion: `Consider uploading Form ${sugType} for accuracy`,
      });
    }
  }

  // 3. No documents at all
  if (documents.length === 0) {
    issues.push({
      code: 'NO_DOCUMENTS',
      severity: 'error',
      message: 'No documents uploaded',
      fieldPath: 'documents',
      suggestion: 'Upload at least a W-2 to begin tax preparation',
    });
  }

  // 4. Unreviewed documents
  const unreviewed = documents.filter((d) => !d.reviewed);
  if (unreviewed.length > 0) {
    issues.push({
      code: 'UNREVIEWED_DOCS',
      severity: 'error',
      message: `${unreviewed.length} document(s) not yet reviewed`,
      fieldPath: 'documents',
      suggestion: 'Review all extracted data before calculating',
    });
  }

  // 5. Inconsistencies
  issues.push(...detectInconsistencies(documents, taxpayer, additionalAnswers));

  // 6. Audit triggers
  issues.push(...detectAuditTriggers(documents, taxpayer, additionalAnswers));

  // 7. Dependent checks
  issues.push(...checkDependents(taxpayer));

  return issues;
}

/** Check if return has blocking errors */
export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
