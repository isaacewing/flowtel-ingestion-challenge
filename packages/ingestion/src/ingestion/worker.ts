import pino from 'pino';
import { paginate } from './paginator';
import { writeBatch } from '../db/writer';
import { saveCheckpoint } from '../db/checkpoint';
import { ProgressTracker } from './progress';
import type { ApiEvent } from '../api/types';

const logger = pino();

interface WorkerOptions {
  apiKey: string;
  baseUrl: string;
  startCursor: string | null;
  pageSize: number;
  tracker: ProgressTracker;
  workerId?: number;
}

export async function runWorker(options: WorkerOptions): Promise<void> {
  const { workerId = 0 } = options;
  let totalIngested = 0;

  // Pipelined: fetch next page while current batch is being written to DB
  // This decouples network latency from DB write latency
  const gen = paginate({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    startCursor: options.startCursor,
    pageSize: options.pageSize,
  });

  // Fetch the first page
  let next = await gen.next();

  while (!next.done) {
    const { events, cursor } = next.value;

    // Kick off the next fetch immediately (parallel with DB write below)
    const nextFetchPromise = gen.next();

    // Write current batch to DB while next fetch is in flight
    const written = await writeBatch(events);
    totalIngested += written;
    options.tracker.add(written);

    // Save cursor after successful write — crash-safe
    await saveCheckpoint(cursor, options.tracker.total);

    // Wait for the pre-fetched next page
    next = await nextFetchPromise;
  }

  logger.info({ workerId, totalIngested }, 'Worker finished');
}
