import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import pino from 'pino';
import { getDb } from './client';
import { checkpoints } from './schema';

const logger = pino();
const MIGRATIONS_FOLDER = path.join(__dirname, '../../drizzle');

export async function runMigrations(): Promise<void> {
  logger.info({ folder: MIGRATIONS_FOLDER }, 'Running Drizzle migrations');
  const db = getDb();
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  // Ensure the checkpoint row exists (idempotent)
  await db.insert(checkpoints)
    .values({ id: 1, cursor: null, eventsIngested: 0 })
    .onConflictDoNothing();

  logger.info('Migrations complete');
}
