import pino from 'pino';
import { createApiClient, CursorExpiredError } from '../api/client';
import type { ApiEvent } from '../api/types';

const logger = pino();

interface PaginatorOptions {
  apiKey: string;
  baseUrl: string;
  startCursor?: string | null;
  pageSize?: number;
}

export async function* paginate(
  options: PaginatorOptions
): AsyncGenerator<{ events: ApiEvent[]; cursor: string | null }> {
  const client = createApiClient({ baseUrl: options.baseUrl, apiKey: options.apiKey });
  let cursor: string | null | undefined = options.startCursor;
  let pageCount = 0;

  while (true) {
    let response;
    try {
      response = await client.getEvents({
        cursor: cursor ?? undefined,
        limit: options.pageSize ?? 1000,
      });
    } catch (err) {
      if (err instanceof CursorExpiredError) {
        logger.warn('Cursor expired — resetting to start of dataset');
        cursor = null;
        continue;
      }
      throw err;
    }

    pageCount++;
    logger.debug({ pageCount, count: response.data.length, nextCursor: response.nextCursor }, 'Page fetched');

    if (response.data.length > 0) {
      yield { events: response.data, cursor: response.nextCursor };
    }

    if (!response.nextCursor) {
      logger.info({ totalPages: pageCount }, 'Pagination complete');
      break;
    }

    cursor = response.nextCursor;
  }
}
