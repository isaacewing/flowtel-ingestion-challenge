import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { checkpoints } from './schema';

export interface Checkpoint {
  cursor: string | null;
  eventsIngested: number;
}

export async function loadCheckpoint(): Promise<Checkpoint> {
  const db = getDb();
  const rows = await db.select().from(checkpoints).where(eq(checkpoints.id, 1));
  return {
    cursor: rows[0]?.cursor ?? null,
    eventsIngested: Number(rows[0]?.eventsIngested ?? 0),
  };
}

export async function saveCheckpoint(cursor: string | null, eventsIngested: number): Promise<void> {
  const db = getDb();
  await db.update(checkpoints)
    .set({ cursor, eventsIngested, updatedAt: new Date() })
    .where(eq(checkpoints.id, 1));
}
