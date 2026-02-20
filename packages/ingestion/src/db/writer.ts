import pino from 'pino';
import { getDb } from './client';
import { events } from './schema';
import { normalizeTimestamp } from '../ingestion/normalizer';
import type { ApiEvent } from '../api/types';

const logger = pino();

const CHUNK_SIZE = 500;

type NewEvent = typeof events.$inferInsert;

export async function writeBatch(batch: ApiEvent[]): Promise<number> {
  if (batch.length === 0) return 0;

  const db = getDb();
  let totalInserted = 0;

  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    const chunk = batch.slice(i, i + CHUNK_SIZE);

    const rows: NewEvent[] = chunk.map(event => {
      const e = event as unknown as Record<string, unknown>;
      return {
        id: event.id,
        eventType: (e.type ?? null) as string | null,
        sessionId: (e.sessionId ?? e.session_id ?? null) as string | null,
        userId: (e.userId ?? e.user_id ?? null) as string | null,
        name: (e.name ?? null) as string | null,
        timestamp: normalizeTimestamp(e.timestamp ?? event.timestamp),
        raw: event,
      };
    });

    // .returning() gives us the count of actually inserted rows (excluding conflicts)
    const result = await db.insert(events)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: events.id });

    totalInserted += result.length;
  }

  return totalInserted;
}
