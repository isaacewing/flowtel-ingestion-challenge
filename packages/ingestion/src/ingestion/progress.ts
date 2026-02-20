import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });

const TOTAL_EVENTS = 3_000_000;

export class ProgressTracker {
  private readonly startTime = Date.now();
  private lastLogTime = Date.now();
  private lastCount: number;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private eventsIngested: number = 0) {
    this.lastCount = eventsIngested;
  }

  add(count: number): void {
    this.eventsIngested += count;
  }

  get total(): number {
    return this.eventsIngested;
  }

  start(intervalMs = 5000): void {
    this.intervalId = setInterval(() => this.log(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.log();
  }

  private log(): void {
    const now = Date.now();
    const elapsedTotalSec = (now - this.startTime) / 1000;
    const elapsedSinceLast = (now - this.lastLogTime) / 1000;
    const countSinceLast = this.eventsIngested - this.lastCount;
    const currentRps = Math.round(countSinceLast / Math.max(elapsedSinceLast, 0.001));
    const avgRps = Math.round(this.eventsIngested / Math.max(elapsedTotalSec, 0.001));
    const remaining = TOTAL_EVENTS - this.eventsIngested;
    const etaSec = avgRps > 0 ? Math.round(remaining / avgRps) : null;
    const etaDisplay = etaSec !== null ? `~${(etaSec / 60).toFixed(1)} min` : 'unknown';
    const pct = ((this.eventsIngested / TOTAL_EVENTS) * 100).toFixed(1);

    logger.info(
      { ingested: this.eventsIngested, total: TOTAL_EVENTS, pct, currentRps, avgRps, etaDisplay },
      `Progress: ${this.eventsIngested.toLocaleString()} / ${TOTAL_EVENTS.toLocaleString()} (${pct}%) | ${currentRps.toLocaleString()} ev/s | avg ${avgRps.toLocaleString()} ev/s | ETA: ${etaDisplay}`
    );

    this.lastLogTime = now;
    this.lastCount = this.eventsIngested;
  }
}
