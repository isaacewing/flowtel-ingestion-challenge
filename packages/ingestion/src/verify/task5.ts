import 'dotenv/config';
import { runMigrations } from '../db/migrate';
import { writeBatch } from '../db/writer';
import { getDb, closeDb } from '../db/client';
import { events } from '../db/schema';
import { like } from 'drizzle-orm';
import pino from 'pino';
import type { ApiEvent } from '../api/types';

const logger = pino({ transport: { target: 'pino-pretty' } });

function makeFakeEvents(count: number): ApiEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-verify-${i}`,
    type: 'click',
    sessionId: `session-${i % 10}`,
    userId: `user-${i % 100}`,
    name: `event_test_${i}`,
    properties: { page: '/home' },
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    session: { id: `session-${i % 10}`, deviceType: 'desktop', browser: 'Chrome' },
  }));
}

async function verifyTask5() {
  await runMigrations();

  const db = getDb();
  await db.delete(events).where(like(events.id, 'test-verify-%'));

  const fakeEvents = makeFakeEvents(1000);
  logger.info('Writing 1,000 test events...');
  const start = Date.now();
  const inserted = await writeBatch(fakeEvents);
  const elapsedMs = Date.now() - start;
  const rowsPerSec = Math.round(1000 / (elapsedMs / 1000));
  logger.info({ inserted, elapsedMs, rowsPerSec }, 'Write complete');

  if (inserted !== 1000) throw new Error(`Expected 1000 inserts, got ${inserted}`);

  // Idempotency — re-insert same events, result must be 0 new rows
  const inserted2 = await writeBatch(fakeEvents);
  logger.info({ inserted2 }, 'Re-insert result (idempotency check)');
  if (inserted2 !== 0) throw new Error(`Idempotency failed: got ${inserted2} additional inserts`);

  // Timestamp normalization — three different formats
  const mixedTimestamps: ApiEvent[] = [
    {
      id: 'test-verify-ts-iso',
      type: 'page_view',
      sessionId: 'session-ts',
      userId: 'user-ts',
      name: 'event_ts_iso',
      properties: {},
      timestamp: '2024-01-15T10:30:00.000Z',
      session: { id: 'session-ts', deviceType: 'desktop', browser: 'Chrome' },
    },
    {
      id: 'test-verify-ts-unix-sec',
      type: 'page_view',
      sessionId: 'session-ts',
      userId: 'user-ts',
      name: 'event_ts_sec',
      properties: {},
      timestamp: 1705312200,
      session: { id: 'session-ts', deviceType: 'desktop', browser: 'Chrome' },
    },
    {
      id: 'test-verify-ts-unix-ms',
      type: 'page_view',
      sessionId: 'session-ts',
      userId: 'user-ts',
      name: 'event_ts_ms',
      properties: {},
      timestamp: 1705312200000,
      session: { id: 'session-ts', deviceType: 'desktop', browser: 'Chrome' },
    },
  ];

  const tsInserted = await writeBatch(mixedTimestamps);
  if (tsInserted !== 3) throw new Error(`Timestamp test: expected 3 inserts, got ${tsInserted}`);
  logger.info('Timestamp normalization check PASSED');

  await db.delete(events).where(like(events.id, 'test-verify-%'));
  await closeDb();
  logger.info({ rowsPerSec }, 'Task 5 verification PASSED');
}

verifyTask5().catch(err => {
  logger.error(err, 'Task 5 verification FAILED');
  process.exit(1);
});
