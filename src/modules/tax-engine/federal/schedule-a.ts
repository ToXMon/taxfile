/**
 * Schedule A — Itemized Deductions (Detailed)
 * Medical, SALT (capped), mortgage interest, charity (with AGI limits), casualty.
 * Maps to: IRS Schedule A (Form 1040)
 */

import type { FormLineMap, TaxLineItem, TaxCalculationFlag, ExtractedDocument } from '@/lib/types';
const uuid = () => crypto.randomUUID();

const SALT_CAP = 10_000;

function makeLine(label: string, value: number, line: string, note: string, pub?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: uuid(), formType: 'Schedule A', boxNumber: line },
    trace: { irsPublication: pub ?? 'IRS Schedule A (Form 1040)', calculationNote: note },
    flagged: false,
  };
}

export interface ScheduleAInput {
  agi: number;
  documents: ExtractedDocument[];
  medicalExpenses: number;
  charitableCash: number; // cash/check contributions
  charitableNonCash: number; // property/goods contributions
  casualtyLosses: number;
}

export interface ScheduleAResult {
  formLines: FormLineMap;
  totalItemized: number;
  flags: TaxCalculationFlag[];
}

/**
 * Calculate Schedule A with full charity AGI limits.
 *
 * Charity limits (IRC \u00a7170):
 * - Cash to 50% organizations: max 60% of AGI
 * - Non-cash to 50% organizations: max 30% of AGI
 * - Excess carries forward 5 years (not implemented — flagged)
 *
 * @param input - Schedule A inputs
 * @returns ScheduleAResult with form lines and total
 */
export function calculateScheduleA(input: ScheduleAInput): ScheduleAResult {
  const formLines: FormLineMap = {};
  const flags: TaxCalculationFlag[] = [];

  // Line 1: Medical expenses exceeding 7.5% AGI
  const medicalFloor = input.agi * 0.075;
  const medicalDeduction = Math.max(0, input.medicalExpenses - medicalFloor);
  formLines['L1'] = makeLine('Medical and dental expenses', medicalDeduction, '1',
    `Expenses($${input.medicalExpenses}) - 7.5% AGI($${Math.round(medicalFloor)})`, 'IRC \u00a7213(a)');
  if (input.medicalExpenses > 0 && medicalDeduction === 0) {
    formLines['L1'].flagged = true;
    formLines['L1'].flagReason = 'Below 7.5% AGI floor';
  }

  // Lines 5a-5e: SALT
  const stateTax = input.documents
    .filter((d) => d.type === 'W2' && d.fields.stateTax)
    .reduce((s, d) => s + (d.fields.stateTax?.value ?? 0), 0);
  const propertyTax = input.documents
    .filter((d) => d.type === '1098' && d.fields.propertyTaxes)
    .reduce((s, d) => s + (d.fields.propertyTaxes?.value ?? 0), 0);
  const totalSalt = stateTax + propertyTax;
  const saltAfterCap = Math.min(totalSalt, SALT_CAP);

  formLines['L5a'] = makeLine('State/local income/sales tax', stateTax, '5a', 'From W-2 box 17');
  formLines['L5b'] = makeLine('State/local real estate tax', propertyTax, '5b', 'From 1098 box 10');
  formLines['L5c'] = makeLine('State/local personal property tax', 0, '5c', 'Not in 2025 scope');
  formLines['L5d'] = makeLine('Other SALT', 0, '5d', 'Not in 2025 scope');
  formLines['L5e'] = makeLine('Total SALT', totalSalt, '5e', `Income($${stateTax}) + Property($${propertyTax})`);
  formLines['L8a'] = makeLine('Total SALT before cap', totalSalt, '8a', 'Sum of line 5');
  formLines['L8b'] = makeLine('Total SALT after cap', saltAfterCap, '8b', `Min($${totalSalt}, $${SALT_CAP})`, 'IRC \u00a7164(b)(6)');
  if (totalSalt > SALT_CAP) {
    flags.push({
      fieldPath: 'salt', value: totalSalt,
      reason: `SALT $${totalSalt} exceeds $${SALT_CAP} cap — $${Math.round(totalSalt - SALT_CAP)} disallowed`,
      sourceSection: 'IRC \u00a7164(b)(6)', needsHumanReview: false,
    });
  }

  // Lines 8c-8d: Mortgage interest
  const mortgageInterest = input.documents
    .filter((d) => d.type === '1098' && d.fields.mortgageInterest)
    .reduce((s, d) => s + (d.fields.mortgageInterest?.value ?? 0), 0);
  const mip = input.documents
    .filter((d) => d.type === '1098' && d.fields.mortgageInsurancePremium)
    .reduce((s, d) => s + (d.fields.mortgageInsurancePremium?.value ?? 0), 0);
  formLines['L8c'] = makeLine('Home mortgage interest', mortgageInterest, '8c', 'From 1098 box 1', 'IRC \u00a7163(h)');
  formLines['L8d'] = makeLine('Mortgage insurance premiums', mip, '8d', 'From 1098 box 5 (may be limited by AGI)', 'IRC \u00a7163(h)(4)');

  // Lines 11-14: Charity with AGI limits
  const cashLimit = input.agi * 0.60;
  const nonCashLimit = input.agi * 0.30;
  const cashAllowed = Math.min(input.charitableCash, cashLimit);
  const nonCashAllowed = Math.min(input.charitableNonCash, nonCashLimit);

  formLines['L11'] = makeLine('Cash/check contributions', cashAllowed, '11',
    `Min($${input.charitableCash}, 60% AGI=$${Math.round(cashLimit)})`, 'IRC \u00a7170(b)(1)(A)');
  formLines['L12'] = makeLine('Non-cash contributions', nonCashAllowed, '12',
    `Min($${input.charitableNonCash}, 30% AGI=$${Math.round(nonCashLimit)})`, 'IRC \u00a7170(b)(1)(B)');

  if (input.charitableCash > cashLimit) {
    flags.push({
      fieldPath: 'charitableCash', value: input.charitableCash,
      reason: `Cash contributions $${input.charitableCash} exceed 60% AGI limit $${Math.round(cashLimit)} — $${Math.round(input.charitableCash - cashLimit)} carries forward`,
      sourceSection: 'IRC \u00a7170(d)', needsHumanReview: true,
    });
  }
  if (input.charitableNonCash > nonCashLimit) {
    flags.push({
      fieldPath: 'charitableNonCash', value: input.charitableNonCash,
      reason: `Non-cash contributions $${input.charitableNonCash} exceed 30% AGI limit $${Math.round(nonCashLimit)} — $${Math.round(input.charitableNonCash - nonCashLimit)} carries forward`,
      sourceSection: 'IRC \u00a7170(d)', needsHumanReview: true,
    });
  }

  const totalCharity = cashAllowed + nonCashAllowed;
  formLines['L13'] = makeLine('Carryover from prior years', 0, '13', 'Not implemented — user must calculate manually');
  formLines['L14'] = makeLine('Total charitable contributions', totalCharity, '14', 'Sum of lines 11-13');

  // Line 16-17: Total itemized
  const totalItemized = Math.round(medicalDeduction + saltAfterCap + mortgageInterest + mip + totalCharity + input.casualtyLosses);
  formLines['L16'] = makeLine('Total itemized before limitations', totalItemized, '16', 'Sum of lines 1 through 15');
  formLines['L17'] = makeLine('Total itemized deductions', totalItemized, '17', 'No additional limitations in 2025 scope');

  return { formLines, totalItemized, flags };
}
