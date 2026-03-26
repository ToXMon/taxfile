/**
 * 2025 Federal and NJ Tax Credits & Adjustments Configuration
 * Sources: IRC §24 (CTC), IRC §32 (EITC), IRC §21 (CDCC), IRC §25A (AOTC), IRC §25A (LLC)
 * IRC §221 (Student Loan Interest Deduction), IRC §162(l) (Educator Expenses)
 * NJ EITC: N.J.S.A. 54A:4-7.1
 */

export interface ChildTaxCreditConfig {
  maxPerChild: number;
  maxRefundablePerChild: number;
  phaseOutStartMfj: number;
  phaseOutStartOther: number;
  phaseOutRatePer1000: number;
  source: string;
}

export interface EITCBBracket {
  minIncome: number;
  maxIncome: number;
  maxCredit: number;
  phaseOutEnd: number;
}

export interface EITCConfig {
  brackets: Record<EITCFilingStatus, Record<number, EITCBBracket>>;
  investmentIncomeLimit: number;
  minEarnedIncome: number;
  source: string;
}

export type EITCFilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

export interface EducationCreditConfig {
  aotc: { maxAmount: number; refundablePercent: number; maxYears: number; source: string };
  llc: { maxAmount: number; refundablePercent: number; source: string };
}

export interface ChildCareCreditConfig {
  maxExpenseOneChild: number;
  maxExpenseTwoPlus: number;
  minRate: number;
  maxRate: number;
  phaseOutStartMfj: number;
  phaseOutEndMfj: number;
  phaseOutStartSingle: number;
  phaseOutEndSingle: number;
  source: string;
}

export interface StudentLoanInterestConfig {
  maxDeduction: number;
  phaseOutStartMfj: number;
  phaseOutEndMfj: number;
  phaseOutStartOther: number;
  phaseOutEndOther: number;
  source: string;
}

export interface EducatorExpenseConfig {
  maxDeduction: number;
  source: string;
}

export interface AdjustmentsConfig2025 {
  studentLoanInterest: StudentLoanInterestConfig;
  educatorExpense: EducatorExpenseConfig;
}

export interface NJCreditsConfig {
  eitcPercentOfFederal: number;
  source: string;
}

export interface CreditsConfig2025 {
  year: number;
  childTaxCredit: ChildTaxCreditConfig;
  eitc: EITCConfig;
  educationCredits: EducationCreditConfig;
  childCareCredit: ChildCareCreditConfig;
  adjustments: AdjustmentsConfig2025;
  nj: NJCreditsConfig;
}

export const CREDITS_2025: CreditsConfig2025 = {
  year: 2025,
  adjustments: {
    studentLoanInterest: {
      maxDeduction: 2500,
      phaseOutStartMfj: 155000,
      phaseOutEndMfj: 185000,
      phaseOutStartOther: 75000,
      phaseOutEndOther: 90000,
      source: 'IRC §221(d) — Student Loan Interest Deduction, 2025 inflation-adjusted',
    },
    educatorExpense: {
      maxDeduction: 300,
      source: 'IRC §162(l) — Educator Expense Deduction',
    },
  },
  childTaxCredit: {
    maxPerChild: 2000,
    maxRefundablePerChild: 1700,
    phaseOutStartMfj: 400000,
    phaseOutStartOther: 200000,
    phaseOutRatePer1000: 50,
    source: 'IRC §24(f)(1) — TCJA as amended by American Rescue Plan Act',
  },
  eitc: {
    investmentIncomeLimit: 11500,
    minEarnedIncome: 1,
    source: 'IRC §32 — 2025 inflation-adjusted amounts',
    brackets: {
      single: {
        0: { minIncome: 1, maxIncome: 7150, maxCredit: 632, phaseOutEnd: 18750 },
        1: { minIncome: 1, maxIncome: 10750, maxCredit: 4213, phaseOutEnd: 46880 },
        2: { minIncome: 1, maxIncome: 15100, maxCredit: 6935, phaseOutEnd: 53120 },
        3: { minIncome: 1, maxIncome: 15100, maxCredit: 7843, phaseOutEnd: 59448 },
      },
      mfj: {
        0: { minIncome: 1, maxIncome: 7150, maxCredit: 632, phaseOutEnd: 25750 },
        1: { minIncome: 1, maxIncome: 10750, maxCredit: 4213, phaseOutEnd: 53880 },
        2: { minIncome: 1, maxIncome: 15100, maxCredit: 6935, phaseOutEnd: 60340 },
        3: { minIncome: 1, maxIncome: 15100, maxCredit: 7843, phaseOutEnd: 66668 },
      },
      mfs: {
        0: { minIncome: 1, maxIncome: 7150, maxCredit: 632, phaseOutEnd: 12875 },
        1: { minIncome: 1, maxIncome: 10750, maxCredit: 4213, phaseOutEnd: 26940 },
        2: { minIncome: 1, maxIncome: 15100, maxCredit: 6935, phaseOutEnd: 30170 },
        3: { minIncome: 1, maxIncome: 15100, maxCredit: 7843, phaseOutEnd: 33334 },
      },
      hoh: {
        0: { minIncome: 1, maxIncome: 7150, maxCredit: 632, phaseOutEnd: 21850 },
        1: { minIncome: 1, maxIncome: 10750, maxCredit: 4213, phaseOutEnd: 50160 },
        2: { minIncome: 1, maxIncome: 15100, maxCredit: 6935, phaseOutEnd: 56600 },
        3: { minIncome: 1, maxIncome: 15100, maxCredit: 7843, phaseOutEnd: 62928 },
      },
    },
  },
  educationCredits: {
    aotc: {
      maxAmount: 2500,
      refundablePercent: 0.40,
      maxYears: 4,
      source: 'IRC §25A(c) — American Opportunity Tax Credit',
    },
    llc: {
      maxAmount: 2000,
      refundablePercent: 0,
      source: 'IRC §25A(d) — Lifetime Learning Credit',
    },
  },
  childCareCredit: {
    maxExpenseOneChild: 3000,
    maxExpenseTwoPlus: 6000,
    minRate: 0.20,
    maxRate: 0.35,
    phaseOutStartMfj: 450000,
    phaseOutEndMfj: 500000,
    phaseOutStartSingle: 15000,
    phaseOutEndSingle: 43000,
    source: 'IRC §21 — Child and Dependent Care Credit',
  },
  nj: {
    eitcPercentOfFederal: 0.40,
    source: 'N.J.S.A. 54A:4-7.1 — NJ Earned Income Tax Credit (40% of federal)',
  },
};

