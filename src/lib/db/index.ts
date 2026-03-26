import type { DatabaseInterface } from './interface';
import { JsonDatabase } from './json';

let dbInstance: DatabaseInterface | null = null;

export function getDatabase(): DatabaseInterface {
  if (dbInstance) return dbInstance;

  const dbType = process.env.DATABASE ?? 'json';

  switch (dbType) {
    case 'json':
      dbInstance = new JsonDatabase();
      break;
    case 'prisma':
      throw new Error(
        'Prisma database not yet implemented. Set DATABASE=json for development.'
      );
    default:
      throw new Error(`Unknown DATABASE type: ${dbType}`);
  }

  return dbInstance;
}
