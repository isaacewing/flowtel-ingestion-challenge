import pino from 'pino';
import { paginate } from './paginator';
import { writeBatch } from '../db/writer';
import { saveCheckpoint } from '../db/checkpoint';
import { ProgressTracker } from './progress';

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

  for await (const { events, cursor } of paginate({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    startCursor: options.startCursor,
    pageSize: options.pageSize,
  })) {
    const written = await writeBatch(events);
    totalIngested += written;
    options.tracker.add(written);

    // Save cursor after successful write — crash-safe
    await saveCheckpoint(cursor, options.tracker.total);
  }

  logger.info({ workerId, totalIngested }, 'Worker finished');
}
