/**
 * Tax Engine Orchestrator — Full Federal + NJ Pipeline
 * Chains: income agg → Sch B → Sch D → Sch 1 → deduction → Sch A → 1040 core
 * → Sch 2 → Sch 3 → CTC/8812 → EITC → education → federal total
 * → NJ income → NJ Sch B → NJ Sch A → NJ Sch C → NJ-1040 → NJ EITC → NJ total
 * Assembles CompleteTaxReturn with audit trail.
 */

import type {
  TaxpayerInfo, AdditionalAnswers, ExtractedDocument, CompleteTaxReturn,
  AuditTrailEntry, TaxSummary, FederalForms, NJForms, TaxCalculationFlag,
} from '@/lib/types';
import { FEDERAL_TAX_2025, NJ_TAX_2025, CREDITS_2025 } from '@/config/tax-year/2025';
import { aggregateIncome, buildScheduleB, calculateScheduleD, calculateSchedule1, resolveDeduction, calculateScheduleA, calculate1040Core, calculateSchedule2, calculateSchedule3 } from './federal';
import type { IncomeSummary } from './types';
import { calculateCTC } from './credits/child-tax-credit';
import { calculateEITC, calculateEducationCredits } from './credits/eitc-education';
import { aggregateNJIncome, toNJFilingStatus, calculateNJScheduleB, calculateNJScheduleA, calculateNJScheduleC, calculateNJ1040, calculatePropertyTaxElection, calculateNJEITC } from './nj';

// ─── Types ──────────────────────────────────────────────────────────

export interface OrchestratorInput {
  taxpayer: TaxpayerInfo;
  documents: ExtractedDocument[];
  additionalAnswers: AdditionalAnswers;
}

// ─── Helpers ────────────────────────────────────────────────────────

function audit(action: string, field: string, prev: number | null, next: number | null, src: string): AuditTrailEntry {
  return { timestamp: new Date().toISOString(), action, fieldPath: field, previousValue: prev, newValue: next, source: src };
}

// ─── Main Function ──────────────────────────────────────────────────

/**
 * Execute the full federal + NJ tax calculation pipeline.
 * Pure orchestration — all calculations delegated to sub-modules.
 */
export function calculateFullReturn(input: OrchestratorInput): CompleteTaxReturn {
  const { taxpayer, documents, additionalAnswers } = input;
  const trail: AuditTrailEntry[] = [];
  const allFlags: TaxCalculationFlag[] = [];
  const fs = taxpayer.filingStatus;
  const qualChildren = taxpayer.dependents.filter(d => d.qualifyingChild).length;

  // ═══ FEDERAL PIPELINE ════════════════════════════════════════════

  // 1. Income aggregation
  const income = aggregateIncome(documents);
  allFlags.push(...income.flags);
  trail.push(audit('aggregate', 'federal.grossIncome', null, income.grossIncome.value, 'income-aggregation'));

  // 2. Schedule B (interest/dividend detail)
 const schB = buildScheduleB(documents, income);
  allFlags.push(...schB.flags);

  // 3. Schedule D (capital gains)
  const schD = calculateScheduleD(documents);
  allFlags.push(...schD.flags);
  trail.push(audit('scheduleD', 'federal.capGains', null, schD.totalNet, 'schedule-d'));

  // 4. Schedule 1 (additional income + adjustments)
  const sch1 = calculateSchedule1(income, additionalAnswers, fs, CREDITS_2025.adjustments.studentLoanInterest, CREDITS_2025.adjustments.educatorExpense, schD.totalNet);
  allFlags.push(...sch1.flags);
  trail.push(audit('schedule1', 'federal.additionalIncome', null, sch1.totalAdditionalIncome.value, 'schedule-1'));
  trail.push(audit('schedule1', 'federal.adjustments', null, sch1.totalAdjustments.value, 'schedule-1'));

  // 5. Deduction resolver
  const deduction = resolveDeduction(fs, 0, 0, income.grossIncome.value, documents, 0, 0, 0, FEDERAL_TAX_2025);
  // flags from deduction resolver are internal — not part of DeductionResult type
  trail.push(audit('deduction', 'federal.deduction', null, deduction.chosen.value, 'deduction-resolver'));

  // 6. Schedule A (if itemized)
  const schA = deduction.isItemized
    ? calculateScheduleA({ agi: income.grossIncome.value, documents, medicalExpenses: 0, charitableCash: 0, charitableNonCash: 0, casualtyLosses: 0 })
    : { formLines: {} as never, totalItemized: 0, flags: [] as TaxCalculationFlag[] };
  allFlags.push(...schA.flags);

  // 7. Form 1040 core
  const core = calculate1040Core({
    income, schedule1AdditionalIncome: sch1.totalAdditionalIncome.value, schedule1Adjustments: sch1.totalAdjustments.value,
    deductionAmount: deduction.chosen.value, isItemized: deduction.isItemized,
    qualifiedDividends: income.qualifiedDividends.value, longTermGains: income.longTermCapitalGains.value, filingStatus: fs,
  });
  allFlags.push(...core.flags);
  trail.push(audit('1040core', 'federal.taxableIncome', null, core.taxableIncome, 'form-1040-core'));
  trail.push(audit('1040core', 'federal.tax', null, core.tax, 'form-1040-core'));

  // 8. Schedule 2 (additional taxes)
  const sch2 = calculateSchedule2(income.nonemployeeComp.value, income.rentalIncome.value, income.wages.value);
  allFlags.push(...sch2.flags);

  // 9. Schedule 3 (non-refundable credits)
  const sch3 = calculateSchedule3(
    { aotcStudents: 0, llcStudents: 0, aotcExpenses: 0, llcExpenses: 0, childCareQualifyingPersons: 0, childCareExpenses: 0 },
    core.agi, fs, CREDITS_2025.educationCredits, CREDITS_2025.childCareCredit,
  );
  allFlags.push(...sch3.flags);

  // 10. CTC / Schedule 8812
  const ctc = calculateCTC(
    { qualifyingChildCount: qualChildren, magi: core.agi, earnedIncome: income.wages.value + income.nonemployeeComp.value, filingStatus: fs, taxLiability: core.tax, otherNonRefundableCredits: sch3.totalNonRefundableCredits },
    CREDITS_2025.childTaxCredit,
  );
  allFlags.push(...ctc.flags);
  trail.push(audit('CTC', 'federal.ctc', null, ctc.totalCTC, 'child-tax-credit'));

  // 11. EITC
  const eitc = calculateEITC(
    { earnedIncome: income.wages.value + income.nonemployeeComp.value, investmentIncome: income.interest.value + income.ordinaryDividends.value + schD.totalNet, qualifyingChildCount: qualChildren, filingStatus: fs },
    CREDITS_2025.eitc,
  );
  allFlags.push(...eitc.flags);
  trail.push(audit('EITC', 'federal.eitc', null, eitc.credit, 'eitc-education'));

  // 12. Education credits
  const edu = calculateEducationCredits({ aotcStudents: 0, aotcExpenses: 0, llcStudents: 0, llcExpenses: 0 }, CREDITS_2025.educationCredits);
  allFlags.push(...edu.flags);

  // 13. Federal total
  const fedTax = core.tax + sch2.totalAdditionalTax;
  const fedCredits = sch3.totalNonRefundableCredits + ctc.nonRefundableCTC;
  const fedTaxAfterCredits = Math.max(0, fedTax - fedCredits);
  const fedRefundable = ctc.refundableCTC + eitc.credit + edu.aotcRefundable;
  const njWithholding = documents.filter(d => d.type === 'W2').reduce((s, d) => s + (d.fields['stateTax']?.value ?? 0), 0);
  const fedWithholding = documents.filter(d => d.type === 'W2').reduce((s, d) => s + (d.fields['federalTax']?.value ?? 0), 0);
  const fedPayments = fedWithholding;
  const fedRefundOrOwed = fedPayments - fedTaxAfterCredits + fedRefundable;

  // ═══ NJ STATE PIPELINE ═══════════════════════════════════════════

  const njFS = toNJFilingStatus(fs);

  // 14. NJ income aggregation
  const njIncome = aggregateNJIncome({
    federalAGI: core.agi, wages: income.wages.value, interest: income.interest.value,
    ordinaryDividends: income.ordinaryDividends.value, qualifiedDividends: income.qualifiedDividends.value,
    shortTermCapitalGains: income.shortTermCapitalGains.value, longTermCapitalGains: income.longTermCapitalGains.value,
    businessIncome: income.nonemployeeComp.value, filingStatus: fs,
    exemptIncome: { socialSecurity: 0, militaryPension: 0, njGovPension: 0, otherExempt: 0 },
  });
  allFlags.push(...njIncome.flags);
  trail.push(audit('NJ', 'nj.grossIncome', null, njIncome.njGrossIncome, 'nj-income-aggregation'));

  // 15. NJ Schedule B
  const njSchB = calculateNJScheduleB(documents);

  // 16. NJ Schedule C
  const njSchC = calculateNJScheduleC({ documents, additionalExpenses: { advertising: 0, insurance: 0, officeSupplies: 0, travel: 0, meals: 0, professionalServices: 0, otherExpenses: 0 } });
  allFlags.push(...njSchC.flags);

  // 17. NJ Schedule A (deductions)
  const propertyTaxesPaid = documents.filter(d => d.type === '1098').reduce((s, d) => s + (d.fields['propertyTaxes']?.value ?? 0), 0);
  const njSchA = calculateNJScheduleA({
    njGrossIncome: njIncome.njGrossIncome, federalStandardDeduction: deduction.standardDeduction.value,
    federalItemizedDeduction: deduction.itemizedDeduction.value, isFederalItemized: deduction.isItemized,
    medicalExpenses: 0, propertyTaxesPaid, mortgageInterest: 0, charitableContributions: 0,
    miscellaneousExpenses: 0, casualtyLosses: 0,
  }, NJ_TAX_2025);
  allFlags.push(...njSchA.flags);

  // 18. NJ property tax election
  const ptElection = calculatePropertyTaxElection({ propertyTaxesPaid, njTaxableIncome: Math.max(0, njIncome.njGrossIncome - njSchA.chosenDeduction), filingStatus: njFS }, NJ_TAX_2025);
  allFlags.push(...ptElection.flags);

  // 19. NJ EITC
  const njEitc = calculateNJEITC(eitc.credit, CREDITS_2025.nj);

  // 20. NJ-1040 core
  const njCore = calculateNJ1040({
    njGrossIncome: njIncome.njGrossIncome, deductionAmount: njSchA.chosenDeduction, isItemized: njSchA.isItemized,
    filingStatus: fs, federalEITC: eitc.credit,
    propertyTaxCreditElected: ptElection.recommended === 'credit', propertyTaxCreditAmount: ptElection.creditAmount,
    njWithholding, estimatedPayments: 0,
  }, NJ_TAX_2025, CREDITS_2025.nj);
  allFlags.push(...njCore.flags);
  trail.push(audit('NJ1040', 'nj.tax', null, njCore.njTax, 'nj-1040-core'));

  // ═══ ASSEMBLE COMPLETE RETURN ═════════════════════════════════════

  const federalForms: FederalForms = {
    form1040: core.formLines, schedule1: sch1.formLines, schedule2: sch2.formLines,
    schedule3: sch3.formLines, scheduleA: schA.formLines, scheduleB: schB.formLines,
    scheduleD: schD.formLines, schedule8812: ctc.schedule8812,
  };

  const njForms: NJForms = {
    nj1040: njCore.formLines, scheduleA: njSchA.formLines, scheduleB: njSchB.formLines, scheduleC: njSchC.formLines,
  };

  const totalFederalTax = fedTaxAfterCredits - fedRefundable;
  const totalStateTax = njCore.njTax - njCore.totalCredits;
  const totalPayments = fedPayments + njWithholding;
  const totalRefundOrOwed = totalPayments - totalFederalTax - totalStateTax + fedRefundable;

  const summary: TaxSummary = {
    totalIncome: core.totalIncome, adjustments: sch1.totalAdjustments.value, deductions: deduction.chosen.value,
    taxableIncome: { federal: core.taxableIncome, state: njCore.taxableIncome },
    federalTax: totalFederalTax, stateTax: totalStateTax,
    totalTax: totalFederalTax + totalStateTax, totalPayments, refundOrOwed: totalRefundOrOwed,
    effectiveRate: core.totalIncome > 0 ? Math.round((totalFederalTax / core.totalIncome) * 10000) / 100 : 0,
  };

  return { taxpayer, taxYear: taxpayer.taxYear, federal: federalForms, newJersey: njForms, summary, auditTrail: trail, flags: allFlags };
}
