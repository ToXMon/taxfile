import type { TaxReturnRecord } from '@/lib/types';

export interface DatabaseInterface {
  getReturn(id: string): Promise<TaxReturnRecord | null>;
  saveReturn(record: TaxReturnRecord): Promise<TaxReturnRecord>;
  listReturns(): Promise<TaxReturnRecord[]>;
  deleteReturn(id: string): Promise<boolean>;
}
