import pino from 'pino';
const logger = pino();

export class RateLimiter {
  private remaining: number;
  private resetAt: Date;
  private readonly limit: number;
  private readonly safetyBuffer: number;

  constructor(limit = 10, safetyBuffer = 2) {
    this.limit = limit;
    this.remaining = limit;
    this.resetAt = new Date();
    this.safetyBuffer = safetyBuffer;
  }

  updateFromHeaders(headers: Record<string, string | string[] | undefined>): void {
    // API uses X-RateLimit-* (capital L) headers
    // X-RateLimit-Reset is seconds remaining (not unix timestamp)
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (remaining !== undefined) this.remaining = Number(remaining);
    if (reset !== undefined) {
      // reset = seconds until window resets
      this.resetAt = new Date(Date.now() + Number(reset) * 1000);
    }
  }

  async waitIfNeeded(): Promise<void> {
    if (this.remaining <= this.safetyBuffer) {
      const waitMs = Math.max(0, this.resetAt.getTime() - Date.now()) + 200;
      logger.warn({ waitMs, remaining: this.remaining }, 'Rate limit approaching — waiting');
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  async handleRateLimitError(retryAfterHeader?: string): Promise<void> {
    const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 10000;
    logger.warn({ waitMs }, 'Rate limit hit (429) — waiting before retry');
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}
