import 'dotenv/config';
import { runMigrations } from '../db/migrate';
import { getDb, closeDb } from '../db/client';
import { checkpoints } from '../db/schema';
import { sql } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function verifyTask3() {
  logger.info('Running migrations...');
  await runMigrations();

  const db = getDb();

  // Verify tables exist
  const tablesResult = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('events', 'checkpoints')
    ORDER BY table_name
  `);

  const tables = tablesResult.rows.map((r: Record<string, unknown>) => r.table_name);
  logger.info({ tables }, 'Tables found');

  if (!tables.includes('events')) throw new Error('events table missing');
  if (!tables.includes('checkpoints')) throw new Error('checkpoints table missing');

  // Verify checkpoint row exists
  const cp = await db.select().from(checkpoints);
  if (cp.length !== 1) throw new Error('Expected exactly 1 checkpoint row');
  logger.info({ checkpoint: cp[0] }, 'Checkpoint row OK');

  // Verify indexes
  const idxResult = await db.execute(sql`
    SELECT indexname FROM pg_indexes WHERE tablename = 'events'
  `);
  logger.info({ indexes: idxResult.rows.map((r: Record<string, unknown>) => r.indexname) }, 'Indexes');

  await closeDb();
  logger.info('Task 3 verification PASSED');
}

verifyTask3().catch(err => {
  logger.error(err, 'Task 3 verification FAILED');
  process.exit(1);
});
