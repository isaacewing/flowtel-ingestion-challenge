import 'dotenv/config';
import { runMigrations } from '../db/migrate';
import { loadCheckpoint, saveCheckpoint } from '../db/checkpoint';
import { paginate } from '../ingestion/paginator';
import { closeDb } from '../db/client';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

const MAX_PAGES = 3;

async function verifyTask4() {
  await runMigrations();

  const checkpoint = await loadCheckpoint();
  logger.info({ checkpoint }, 'Loaded checkpoint');

  let totalEvents = 0;
  let pageCount = 0;

  for await (const { events, cursor } of paginate({
    apiKey: process.env.API_KEY!,
    baseUrl: process.env.API_BASE_URL!,
    startCursor: checkpoint.cursor,
    pageSize: 100,
  })) {
    pageCount++;
    totalEvents += events.length;
    logger.info({ pageCount, batchSize: events.length, cursor }, 'Batch received');
    await saveCheckpoint(cursor, checkpoint.eventsIngested + totalEvents);

    if (pageCount >= MAX_PAGES) {
      logger.info('Stopping after 3 pages for verification');
      break;
    }
  }

  if (totalEvents === 0) throw new Error('No events received');
  if (pageCount < 2) throw new Error('Expected at least 2 pages');

  const updated = await loadCheckpoint();
  if (updated.eventsIngested === 0) throw new Error('Checkpoint was not saved');
  logger.info({ checkpoint: updated }, 'Checkpoint after test');

  await closeDb();
  logger.info({ totalEvents, pageCount }, 'Task 4 verification PASSED');
}

verifyTask4().catch(err => {
  logger.error(err, 'Task 4 verification FAILED');
  process.exit(1);
});
