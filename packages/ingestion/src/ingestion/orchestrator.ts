import pino from 'pino';
import { runWorker } from './worker';
import { ProgressTracker } from './progress';
import { loadCheckpoint } from '../db/checkpoint';

const logger = pino();

// Max page size discovered: 5000
// Rate limit: 10 req/60s window
// With 5000 events/page and ~3s per request (network + DB write), throughput is bounded by rate limit
const PAGE_SIZE = 5000;
const CONCURRENCY = 1;

export async function runOrchestrator(apiKey: string, baseUrl: string): Promise<void> {
  const checkpoint = await loadCheckpoint();
  const tracker = new ProgressTracker(checkpoint.eventsIngested);

  logger.info({ checkpoint, pageSize: PAGE_SIZE, concurrency: CONCURRENCY }, 'Starting orchestrator');
  tracker.start(5000);

  try {
    if (CONCURRENCY === 1) {
      await runWorker({
        apiKey,
        baseUrl,
        startCursor: checkpoint.cursor,
        pageSize: PAGE_SIZE,
        tracker,
        workerId: 0,
      });
    } else {
      // Multiple parallel workers — only valid if the API issues independent cursor streams.
      const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
        runWorker({
          apiKey,
          baseUrl,
          startCursor: null,
          pageSize: PAGE_SIZE,
          tracker,
          workerId: i,
        })
      );
      await Promise.all(workers);
    }
  } finally {
    tracker.stop();
  }

  logger.info({ total: tracker.total }, 'Orchestration complete');
}
