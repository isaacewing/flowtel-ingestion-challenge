import http from 'http';
import axios, { AxiosInstance, AxiosError } from 'axios';
import pino from 'pino';
import { RateLimiter } from './rateLimiter';
import type { ApiEvent, PaginatedResponse, ApiClientConfig } from './types';

const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 4 });

const logger = pino();

export class CursorExpiredError extends Error {
  constructor() {
    super('Cursor has expired — must restart from the beginning');
    this.name = 'CursorExpiredError';
  }
}

export class ApiClient {
  private readonly http: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number;

  constructor(config: ApiClientConfig) {
    this.maxRetries = config.maxRetries ?? 999;
    this.rateLimiter = new RateLimiter();
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 30000,
      headers: { 'X-API-Key': config.apiKey },
      httpAgent: keepAliveAgent,
    });
  }

  async getEvents(params: { cursor?: string; limit?: number }): Promise<PaginatedResponse<ApiEvent>> {
    await this.rateLimiter.waitIfNeeded();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.http.get('/events', { params });
        this.rateLimiter.updateFromHeaders(response.headers as Record<string, string>);

        // API response shape:
        // { data: [...], pagination: { nextCursor, hasMore, limit }, meta: { total, returned } }
        const body = response.data as {
          data: ApiEvent[];
          pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
          meta: { total: number; returned: number };
        };

        const data = body.data ?? [];
        const hasMore = body.pagination?.hasMore ?? true;
        const nextCursor = body.pagination?.nextCursor ?? null;

        // Termination signal: empty data + hasMore=false means stream is complete
        if (data.length === 0 && !hasMore) {
          logger.info({ total: body.meta?.total }, 'API signalled stream complete (empty + hasMore=false)');
        }

        return {
          data,
          nextCursor: (data.length === 0 && !hasMore) ? null : nextCursor,
          total: body.meta?.total,
        };
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] as string | undefined;
          // Strictly honour Retry-After + 500ms safety margin.
          // Do NOT immediately retry — each retry resets the server's lockout timer.
          const waitMs = retryAfter ? (Number(retryAfter) * 1000 + 500) : 10000;
          logger.warn({ waitMs, attempt }, 'Rate limit hit (429) — honouring Retry-After strictly');
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        if (error.response?.status === 400) {
          // Likely an expired cursor
          logger.warn({ params }, 'Got 400 — cursor may be expired, throwing CursorExpiredError');
          throw new CursorExpiredError();
        }
        if (error.response && error.response.status >= 500 && attempt < this.maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          logger.warn({ status: error.response.status, attempt, backoffMs }, '5xx error — retrying');
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        throw err;
      }
    }
    // Should never reach here with maxRetries=999, but treat as cursor expiry to restart cleanly
    throw new CursorExpiredError();
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
