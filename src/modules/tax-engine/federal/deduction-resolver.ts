/**
 * Deduction Resolver — Compares standard vs itemized deductions.
 * Calculates standard deduction (with age/blind additions) and itemized deductions
 * (medical >7.5% AGI, SALT capped, mortgage interest, charity, casualty).
 * Returns DeductionResult with chosen method and Schedule A lines.
 */

import type { FilingStatus, TaxLineItem, FormLineMap, TaxCalculationFlag, ExtractedDocument } from '@/lib/types';
import type { DeductionResult } from '../types';
import type { FederalTaxConfig } from '@/config/tax-year/2025';

// ─── Types ──────────────────────────────────────────────────────────

/** Inputs for itemized deduction calculation */
export interface ItemizedInputs {
  /** Medical expenses (before AGI threshold) */
  medicalExpenses: number;
  /** State + local income tax (from W-2 state tax withheld) */
  stateIncomeTax: number;
  /** Property taxes (from 1098 box 10 + user-reported) */
  propertyTaxes: number;
  /** Mortgage interest (from 1098 box 1) */
  mortgageInterest: number;
  /** Charitable contributions */
  charitableContributions: number;
  /** Casualty/theft losses (federally declared disaster only post-TCJA) */
  casualtyLosses: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Map central FilingStatus to config FilingStatus ('qw' -> 'hoh') */
function toConfigFS(fs: FilingStatus): 'single' | 'mfj' | 'mfs' | 'hoh' {
  if (fs === 'qw') return 'hoh';
  return fs as 'single' | 'mfj' | 'mfs' | 'hoh';
}

function makeLine(value: number, label: string, line: string, irsRef: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value),
    label,
    source: { documentId: 'CALCULATED', formType: '1040-SA', boxNumber: line },
    trace: { irsPublication: irsRef, calculationNote: note },
    flagged: false,
  };
}

/** Extract itemized inputs from documents and user answers */
function extractItemizedInputs(
  documents: ExtractedDocument[],
  userMedicalExpenses: number,
  userCharity: number,
  userCasualty: number,
): ItemizedInputs {
  const w2s = documents.filter((d) => d.type === 'W2');
  const docs1098 = documents.filter((d) => d.type === '1098');

  const stateIncomeTax = Math.round(w2s.reduce((s, d) => s + (d.fields['stateTax']?.value ?? 0), 0));
  const propertyTaxes = Math.round(
    docs1098.reduce((s, d) => s + (d.fields['propertyTaxes']?.value ?? 0), 0),
  );
  const mortgageInterest = Math.round(
    docs1098.reduce((s, d) => s + (d.fields['mortgageInterest']?.value ?? 0), 0),
  );

  return {
    medicalExpenses: userMedicalExpenses,
    stateIncomeTax,
    propertyTaxes,
    mortgageInterest,
    charitableContributions: userCharity,
    casualtyLosses: userCasualty,
  };
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Resolve standard vs itemized deduction.
 *
 * @param filingStatus - Taxpayer filing status (central type, 'qw' mapped to 'hoh')
 * @param over65Count - Number of taxpayers/spouse age 65+ (0, 1, or 2)
 * @param blindCount - Number of taxpayers/spouse who are blind (0, 1, or 2)
 * @param agi - Adjusted Gross Income (for medical expense threshold)
 * @param documents - Extracted documents (for W-2 state tax, 1098 mortgage/property)
 * @param userMedicalExpenses - User-reported medical expenses
 * @param userCharity - User-reported charitable contributions
 * @param userCasualty - User-reported casualty losses
 * @param config - Federal tax config with standard deductions and limits
 * @returns DeductionResult with chosen method and Schedule A form lines
 */
export function resolveDeduction(
  filingStatus: FilingStatus,
  over65Count: number,
  blindCount: number,
  agi: number,
  documents: ExtractedDocument[],
  userMedicalExpenses: number,
  userCharity: number,
  userCasualty: number,
  config: FederalTaxConfig,
): DeductionResult {
  const flags: TaxCalculationFlag[] = [];
  const scheduleA: FormLineMap = {};
  const limits = config.deductionLimits;

  // ── Standard Deduction ─────────────────────────────────────────────
  const cfg = config.statuses[toConfigFS(filingStatus)];
  const standardBase = cfg.standardDeduction;
  const ageAdd = cfg.additionalStandardDeductionAge * over65Count;
  const blindAdd = cfg.additionalStandardDeductionBlind * blindCount;
  const standardTotal = Math.round(standardBase + ageAdd + blindAdd);

  const standardDeduction: TaxLineItem = {
    value: standardTotal,
    label: `Standard deduction${over65Count > 0 ? ` (+${over65Count} age)` : ''}${blindCount > 0 ? ` (+${blindCount} blind)` : ''}`,
    source: { documentId: 'CONFIG', formType: '1040', boxNumber: 'L12' },
    trace: { irsPublication: config.source, calculationNote: `Base $${standardBase} + age $${ageAdd} + blind $${blindAdd}` },
    flagged: false,
  };

  // ── Itemized Deductions ────────────────────────────────────────────
  const inputs = extractItemizedInputs(documents, userMedicalExpenses, userCharity, userCasualty);

  // Line 1: Medical expenses (>7.5% AGI floor)
  const medicalFloor = Math.round(agi * limits.medicalExpenseAGIThreshold);
  const medicalExcess = Math.max(0, inputs.medicalExpenses - medicalFloor);
 scheduleA['L1'] = makeLine(inputs.medicalExpenses, 'Medical and dental expenses', 'L1', 'IRC §213(a)', `Total: $${inputs.medicalExpenses}`);
  scheduleA['L2'] = makeLine(medicalFloor, 'AGI threshold (7.5%)', 'L2', 'IRC §213(a)', `${(limits.medicalExpenseAGIThreshold * 100)}% of $${agi}`);
  scheduleA['L3'] = makeLine(medicalExcess, 'Medical deduction (excess over 7.5% AGI)', 'L3', 'IRC §213(a)', `$${inputs.medicalExpenses} - $${medicalFloor}`);

  // Line 5a: State income tax
  scheduleA['L5a'] = makeLine(inputs.stateIncomeTax, 'State and local income tax', 'L5a', 'IRC §164(a)', 'From W-2 box 17');
  // Line 5b: Property taxes
  scheduleA['L5b'] = makeLine(inputs.propertyTaxes, 'Property taxes', 'L5b', 'IRC §164(a)', 'From 1098 box 10 + user-reported');
  // Line 5d: Total SALT before cap
  const saltBeforeCap = Math.round(scheduleA['L5a'].value + scheduleA['L5b'].value);
 scheduleA['L5d'] = makeLine(saltBeforeCap, 'Total SALT (before cap)', 'L5d', 'IRC §164(b)', 'L5a + L5b');
  // Line 5e: SALT after $10k cap
  const saltAfterCap = Math.min(saltBeforeCap, limits.saltCap);
 scheduleA['L5e'] = makeLine(saltAfterCap, 'SALT (capped at $10,000)', 'L5e', limits.source, `Min of $${saltBeforeCap} and $${limits.saltCap}`);
  if (saltBeforeCap > limits.saltCap) {
    flags.push({
      fieldPath: 'scheduleA.L5e',
      value: saltAfterCap,
      reason: `SALT reduced from $${saltBeforeCap} to $${limits.saltCap} due to TCJA cap`,
      sourceSection: limits.source,
      needsHumanReview: false,
    });
  }

  // Line 8a: Mortgage interest (1098 box 1)
  scheduleA['L8a'] = makeLine(inputs.mortgageInterest, 'Home mortgage interest', 'L8a', 'IRC §163(h)', 'From 1098 box 1');

  // Line 11: Charitable contributions
  scheduleA['L11'] = makeLine(inputs.charitableContributions, 'Charitable contributions', 'L11', 'IRC §170', 'User-reported');

  // Line 15: Casualty losses (federally declared disaster only post-TCJA)
 scheduleA['L15'] = makeLine(inputs.casualtyLosses, 'Casualty and theft losses', 'L15', 'IRC §165(h)', 'User-reported (federally declared disaster only)');
  if (inputs.casualtyLosses > 0) {
    flags.push({
      fieldPath: 'scheduleA.L15',
      value: inputs.casualtyLosses,
      reason: 'Casualty losses only deductible for federally declared disasters post-TCJA — verify qualification',
      sourceSection: 'IRC §165(h) (as amended by TCJA §11044)',
      needsHumanReview: true,
    });
  }

  // Line 17: Total itemized deductions
  const itemizedTotal = Math.round(
    scheduleA['L3'].value + scheduleA['L5e'].value + scheduleA['L8a'].value
    + scheduleA['L11'].value + scheduleA['L15'].value,
  );
  scheduleA['L17'] = makeLine(itemizedTotal, 'Total itemized deductions', 'L17', 'IRS Schedule A Line 17', 'L3 + L5e + L8a + L11 + L15');

  const itemizedDeduction: TaxLineItem = {
    value: itemizedTotal,
    label: 'Itemized deductions',
    source: { documentId: 'CALCULATED', formType: '1040-SA', boxNumber: 'L17' },
    trace: { irsPublication: 'IRS Schedule A', calculationNote: `Total: $${itemizedTotal}` },
    flagged: false,
  };

  // ── Choose Method ──────────────────────────────────────────────────
  const isItemized = itemizedTotal > standardTotal;
  const chosen = isItemized ? itemizedDeduction : standardDeduction;
  const savings = Math.abs(itemizedTotal - standardTotal);

  return {
    standardDeduction,
    itemizedDeduction,
    chosen: { ...chosen, label: `${chosen.label} [${isItemized ? 'ITEMIZED' : 'STANDARD'}]` },
    isItemized,
    scheduleA,
  };
}
