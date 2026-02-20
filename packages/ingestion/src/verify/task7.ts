import 'dotenv/config';
import { runMigrations } from '../db/migrate';
import { getDb, closeDb } from '../db/client';
import { events } from '../db/schema';
import { runOrchestrator } from '../ingestion/orchestrator';
import { sql } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

const WINDOW_SEC = 30;

async function verifyTask7() {
  await runMigrations();

  const db = getDb();
  const before = await db.select({ count: sql<number>`count(*)` }).from(events);
  const countBefore = Number(before[0].count);
  logger.info({ countBefore }, 'Events before test');

  let timedOut = false;
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => { timedOut = true; reject(new Error('STOP')); }, WINDOW_SEC * 1000)
  );

  try {
    await Promise.race([
      runOrchestrator(process.env.API_KEY!, process.env.API_BASE_URL!),
      timeout,
    ]);
  } catch (err) {
    if (!timedOut) throw err;
    logger.info(`${WINDOW_SEC}s window complete`);
  }

  const after = await db.select({ count: sql<number>`count(*)` }).from(events);
  const countAfter = Number(after[0].count);
  const ingested = countAfter - countBefore;
  const eventsPerSec = Math.round(ingested / WINDOW_SEC);

  logger.info({ ingested, eventsPerSec }, 'Throughput result');

  if (ingested === 0) throw new Error('No events ingested');

  await closeDb();
  logger.info({ eventsPerSec }, 'Task 7 verification PASSED — tune PAGE_SIZE and CONCURRENCY to maximize this number');
}

verifyTask7().catch(err => {
  logger.error(err, 'Task 7 verification FAILED');
  process.exit(1);
});
