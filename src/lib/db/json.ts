import fs from 'fs/promises';
import path from 'path';
import type { DatabaseInterface } from './interface';
import type { TaxReturnRecord } from '@/lib/types';

const DB_DIR = path.join(process.cwd(), 'data', 'db');

async function ensureDir(): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
}

function filePath(id: string): string {
  return path.join(DB_DIR, `${id}.json`);
}

export class JsonDatabase implements DatabaseInterface {
  async getReturn(id: string): Promise<TaxReturnRecord | null> {
    try {
      const data = await fs.readFile(filePath(id), 'utf-8');
      return JSON.parse(data) as TaxReturnRecord;
    } catch {
      return null;
    }
  }

  async saveReturn(record: TaxReturnRecord): Promise<TaxReturnRecord> {
    await ensureDir();
    const updated = { ...record, updatedAt: new Date().toISOString() };
    await fs.writeFile(filePath(record.id), JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  async listReturns(): Promise<TaxReturnRecord[]> {
    await ensureDir();
    try {
      const files = await fs.readdir(DB_DIR);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const records: TaxReturnRecord[] = [];
      for (const file of jsonFiles) {
        const data = await fs.readFile(path.join(DB_DIR, file), 'utf-8');
        records.push(JSON.parse(data) as TaxReturnRecord);
      }
      return records.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async deleteReturn(id: string): Promise<boolean> {
    try {
      await fs.unlink(filePath(id));
      return true;
    } catch {
      return false;
    }
  }
}
