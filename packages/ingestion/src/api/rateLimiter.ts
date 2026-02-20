import pino from 'pino';
const logger = pino();

export class RateLimiter {
  private remaining: number;
  private resetAt: Date;
  private readonly limit: number;
  private readonly safetyBuffer: number;

  constructor(limit = 10, safetyBuffer = 0) {
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
    // Only pre-emptively wait if remaining is 0 AND the reset window is meaningfully in the future.
    // If the API keeps refreshing resetAt on every response (sentinel behavior near end of dataset),
    // cap the wait to avoid an infinite loop — the 429 handler will catch real rate limit errors.
    if (this.remaining <= this.safetyBuffer) {
      const msUntilReset = this.resetAt.getTime() - Date.now();
      const waitMs = Math.min(Math.max(0, msUntilReset) + 200, 5000); // cap at 5s
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
