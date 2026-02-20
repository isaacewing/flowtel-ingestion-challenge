import 'dotenv/config';
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { runMigrations } from './db/migrate';
import { getDb, closeDb } from './db/client';
import { runOrchestrator } from './ingestion/orchestrator';
import { events } from './db/schema';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function getEventCount(): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: sql<number>`count(*)` }).from(events);
  return Number(result[0].count);
}

async function main() {
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.API_BASE_URL ??
    'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1';

  if (!apiKey) {
    logger.error('API_KEY environment variable is required');
    process.exit(1);
  }

  logger.info('Flowtel ingestion service starting');

  try {
    await runMigrations();
    await runOrchestrator(apiKey, baseUrl);
    const count = await getEventCount();
    logger.info({ count }, 'Ingestion complete');

    if (count >= 3_000_000) {
      logger.info('All 3,000,000 events ingested successfully');
    } else {
      logger.warn({ count, remaining: 3_000_000 - count }, 'Ingestion may be incomplete');
    }
  } catch (err) {
    logger.error(err, 'Fatal error');
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
