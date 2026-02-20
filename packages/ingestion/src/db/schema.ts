import { pgTable, text, timestamp, jsonb, bigint, integer } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  eventType: text('event_type'),
  sessionId: text('session_id'),
  userId: text('user_id'),
  name: text('name'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  raw: jsonb('raw').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow(),
});

export const checkpoints = pgTable('checkpoints', {
  id: integer('id').primaryKey().default(1),
  cursor: text('cursor'),
  eventsIngested: bigint('events_ingested', { mode: 'number' }).default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
