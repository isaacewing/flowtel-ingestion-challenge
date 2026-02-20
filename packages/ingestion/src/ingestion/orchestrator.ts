import pino from 'pino';
import { runWorker } from './worker';
import { ProgressTracker } from './progress';
import { loadCheckpoint } from '../db/checkpoint';

const logger = pino();

const PAGE_SIZE = 5000;
const TARGET = 3_000_000;

export async function runOrchestrator(apiKey: string, baseUrl: string): Promise<void> {
  const checkpoint = await loadCheckpoint();
  const tracker = new ProgressTracker(checkpoint.eventsIngested);

  logger.info({ checkpoint, pageSize: PAGE_SIZE }, 'Starting orchestrator');
  tracker.start(5000);

  try {
    // Loop until we reach 3M — handles premature paginator termination on cursor expiry
    while (tracker.total < TARGET) {
      const fresh = await loadCheckpoint();
      logger.info({ eventsIngested: fresh.eventsIngested, cursor: fresh.cursor ? 'set' : 'null' }, 'Starting worker pass');

      await runWorker({
        apiKey,
        baseUrl,
        startCursor: fresh.cursor,
        pageSize: PAGE_SIZE,
        tracker,
        workerId: 0,
      });

      if (tracker.total < TARGET) {
        logger.warn({ total: tracker.total, remaining: TARGET - tracker.total }, 'Paginator ended early — restarting from checkpoint');
      }
    }
  } finally {
    tracker.stop();
  }

  logger.info({ total: tracker.total }, 'Orchestration complete');
}
