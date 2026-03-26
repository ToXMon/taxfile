/**
 * 2025 New Jersey State Income Tax Brackets
 * Source: NJ Division of Taxation, N.J.A.C. 18:35-1.5
 * NJ has NO standard deduction — uses federal standard or itemized
 */

import type { TaxBracket } from './federal-brackets';

export interface NJTaxConfig {
  year: number;
  source: string;
  propertyTaxDeductionCap: number;
  propertyTaxCreditRate: number;
  propertyTaxCreditThreshold: number;
  propertyTaxCreditMax: number;
  saltCapNote: string;
  brackets: Record<NJFilingStatus, TaxBracket[]>;
}

export type NJFilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

export const NJ_TAX_2025: NJTaxConfig = {
  year: 2025,
  source: 'N.J.A.C. 18:35-1.5 — NJ Division of Taxation',
  propertyTaxDeductionCap: 1000,
  propertyTaxCreditRate: 0.25,
  propertyTaxCreditThreshold: 100,
  propertyTaxCreditMax: 500,
  saltCapNote: 'Federal SALT cap of $10,000 applies to NJ state+local taxes on federal return. NJ does not cap on state return.',
  brackets: {
    single: [
      { min: 0, max: 20000, rate: 0.014 },
      { min: 20000, max: 35000, rate: 0.0175 },
      { min: 35000, max: 40000, rate: 0.0245 },
      { min: 40000, max: 75000, rate: 0.035 },
      { min: 75000, max: 500000, rate: 0.05525 },
      { min: 500000, max: 5000000, rate: 0.0637 },
      { min: 5000000, max: Infinity, rate: 0.0897 },
    ],
    mfj: [
      { min: 0, max: 20000, rate: 0.014 },
      { min: 20000, max: 50000, rate: 0.0175 },
      { min: 50000, max: 70000, rate: 0.0245 },
      { min: 70000, max: 80000, rate: 0.035 },
      { min: 80000, max: 150000, rate: 0.05525 },
      { min: 150000, max: 500000, rate: 0.0637 },
      { min: 500000, max: 5000000, rate: 0.0897 },
      { min: 5000000, max: Infinity, rate: 0.1075 },
    ],
    mfs: [
      { min: 0, max: 10000, rate: 0.014 },
      { min: 10000, max: 25000, rate: 0.0175 },
      { min: 25000, max: 35000, rate: 0.0245 },
      { min: 35000, max: 40000, rate: 0.035 },
      { min: 40000, max: 75000, rate: 0.05525 },
      { min: 75000, max: 250000, rate: 0.0637 },
      { min: 250000, max: 2500000, rate: 0.0897 },
      { min: 2500000, max: Infinity, rate: 0.1075 },
    ],
    hoh: [
      { min: 0, max: 20000, rate: 0.014 },
      { min: 20000, max: 50000, rate: 0.0175 },
      { min: 50000, max: 70000, rate: 0.0245 },
      { min: 70000, max: 80000, rate: 0.035 },
      { min: 80000, max: 150000, rate: 0.05525 },
      { min: 150000, max: 500000, rate: 0.0637 },
      { min: 500000, max: 5000000, rate: 0.0897 },
      { min: 5000000, max: Infinity, rate: 0.1075 },
    ],
  },
};

export default NJ_TAX_2025;
