/**
 * NJ Earned Income Tax Credit
 * NJ EITC = percentage of federal EITC per N.J.S.A. 54A:4-7.1
 * Source: N.J.S.A. 54A:4-7.1 — NJ Earned Income Tax Credit
 */

import type { TaxLineItem, FormLineMap } from '@/lib/types';
import type { NJCreditsConfig } from '@/config/tax-year/2025';

function makeLine(value: number, label: string, line: string, njCode: string, note?: string): TaxLineItem {
  return {
    value: Math.round(value), label,
    source: { documentId: 'CALCULATED', formType: 'NJ-1040', boxNumber: line },
    trace: { njTaxCode: njCode, calculationNote: note },
    flagged: false,
  };
}

export interface NJEITCResult {
  formLines: FormLineMap;
  njEITC: number;
}

/**
 * Calculate NJ EITC as a percentage of federal EITC.
 * Config-driven: percentage from NJCreditsConfig.eitcPercentOfFederal.
 */
export function calculateNJEITC(federalEITC: number, config: NJCreditsConfig): NJEITCResult {
  const njEITC = Math.round(federalEITC * config.eitcPercentOfFederal);
  const lines: FormLineMap = {
    'L42': makeLine(njEITC, 'NJ Earned Income Tax Credit', 'L42', config.source,
      `${Math.round(config.eitcPercentOfFederal * 100)}% × Federal EITC($${federalEITC})`),
  };
  return { formLines: lines, njEITC };
}
