export { aggregateNJIncome, toNJFilingStatus } from './income-aggregation';
export type { NJExemptIncome, NJIncomeAggregationInput, NJIncomeSummary } from './income-aggregation';

export { calculateNJScheduleB } from './schedule-b';
export type { NJScheduleBResult } from './schedule-b';

export { calculateNJScheduleA } from './schedule-a';
export type { NJScheduleAInput, NJScheduleAResult } from './schedule-a';

export { calculateNJScheduleC } from './schedule-c';
export type { NJScheduleCInput, NJScheduleCResult } from './schedule-c';

export { calculateNJ1040 } from './nj-1040-core';
export type { NJ1040CoreInput, NJ1040CoreResult } from './nj-1040-core';

export { calculatePropertyTaxElection } from './property-tax-election';
export type { PropertyTaxElection, PropertyTaxElectionInput, PropertyTaxElectionResult } from './property-tax-election';

export { calculateNJEITC } from './eitc';
export type { NJEITCResult } from './eitc';
