/**
 * 2025 Federal Income Tax Brackets, Standard Deductions, and QDI/LTCG Thresholds
 * Source: IRS Revenue Procedure 2024-40
 * No hardcoded values in calculation code — import from here
 */

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface FilingStatusConfig {
  standardDeduction: number;
  additionalStandardDeductionAge: number;
  additionalStandardDeductionBlind: number;
  brackets: TaxBracket[];
}

export interface QDIThresholds {
  rate0End: number;
  rate15End: number;
  source: string;
}

export interface DeductionLimitsConfig {
  saltCap: number;
  medicalExpenseAGIThreshold: number;
  casualtyLossAGIThreshold: number;
  source: string;
}

export interface FederalTaxConfig {
  year: number;
  source: string;
  statuses: Record<FilingStatus, FilingStatusConfig>;
  qdiThresholds: Record<FilingStatus, QDIThresholds>;
  deductionLimits: DeductionLimitsConfig;
}

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

export const FEDERAL_TAX_2025: FederalTaxConfig = {
  year: 2025,
  source: 'IRS Revenue Procedure 2024-40',
  deductionLimits: {
    saltCap: 10000,
    medicalExpenseAGIThreshold: 0.075,
    casualtyLossAGIThreshold: 0.10,
    source: 'IRC §164(b) SALT cap (TCJA §11042); IRC §213(a) medical; IRC §165(h) casualty',
  },
  qdiThresholds: {
    single: { rate0End: 47025, rate15End: 291850, source: 'IRC §1(h)(1)(C) — Rev. Proc. 2024-40' },
    mfj: { rate0End: 94050, rate15End: 583750, source: 'IRC §1(h)(1)(C) — Rev. Proc. 2024-40' },
    mfs: { rate0End: 47025, rate15End: 291850, source: 'IRC §1(h)(1)(C) — Rev. Proc. 2024-40' },
    hoh: { rate0End: 63000, rate15End: 551350, source: 'IRC §1(h)(1)(C) — Rev. Proc. 2024-40' },
  },
  statuses: {
    single: {
      standardDeduction: 15000,
      additionalStandardDeductionAge: 2000,
      additionalStandardDeductionBlind: 2000,
      brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 },
      ],
    },
    mfj: {
      standardDeduction: 29200,
      additionalStandardDeductionAge: 1600,
      additionalStandardDeductionBlind: 1600,
      brackets: [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: Infinity, rate: 0.37 },
      ],
    },
    mfs: {
      standardDeduction: 14600,
      additionalStandardDeductionAge: 1600,
      additionalStandardDeductionBlind: 1600,
      brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 365600, rate: 0.35 },
        { min: 365600, max: Infinity, rate: 0.37 },
      ],
    },
    hoh: {
      standardDeduction: 22100,
      additionalStandardDeductionAge: 2000,
      additionalStandardDeductionBlind: 2000,
      brackets: [
        { min: 0, max: 16550, rate: 0.10 },
        { min: 16550, max: 63100, rate: 0.12 },
        { min: 63100, max: 100500, rate: 0.22 },
        { min: 100500, max: 191950, rate: 0.24 },
        { min: 191950, max: 243700, rate: 0.32 },
        { min: 243700, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 },
      ],
    },
  },
};

export default FEDERAL_TAX_2025;
