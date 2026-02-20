# Flowtel Data Ingestion Challenge

## How to run

```bash
sh run-ingestion.sh
```

This is the only command needed. It will:
1. Validate the `.env` file exists
2. Build the Docker image
3. Start PostgreSQL and the ingestion service
4. Run migrations, load the checkpoint, and begin ingesting events

## Architecture

All source lives in `packages/ingestion/src/`:

| Module | Description |
|--------|-------------|
| `index.ts` | Main entrypoint — wires migrations, orchestrator, and final count |
| `api/types.ts` | TypeScript interfaces for API events and responses |
| `api/rateLimiter.ts` | Tracks `X-RateLimit-*` headers and waits before hitting the limit |
| `api/client.ts` | Axios-based API client with retry logic, 429 and 5xx handling |
| `db/schema.ts` | Drizzle ORM schema for `events` and `checkpoints` tables |
| `db/client.ts` | PostgreSQL connection pool singleton via `pg` |
| `db/migrate.ts` | Runs Drizzle migrations at startup; seeds the checkpoint row |
| `db/checkpoint.ts` | `loadCheckpoint` / `saveCheckpoint` — cursor-based resume state |
| `db/writer.ts` | Bulk inserts via Drizzle with `onConflictDoNothing` (idempotent) |
| `ingestion/normalizer.ts` | Normalizes Unix-ms ints and ISO strings to `Date` |
| `ingestion/paginator.ts` | Async generator that pages through the API with cursor; handles expired cursors |
| `ingestion/progress.ts` | Interval-based progress reporter: ev/s, avg ev/s, ETA |
| `ingestion/worker.ts` | Fetch-write loop: calls paginator, writes batch, saves checkpoint |
| `ingestion/orchestrator.ts` | Top-level coordinator; loads checkpoint, starts worker(s), reports progress |
| `submission/submit.ts` | Streams all event IDs from DB using keyset pagination, posts to grading API |

## API discoveries

- **Endpoint**: `GET /api/v1/events`
- **Pagination**: cursor-based — response field `pagination.nextCursor`; query param `cursor`
- **Max page size**: **5,000** (requesting 10,000 still returns 5,000)
- **Rate limit headers**: `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (seconds remaining in window)
- **Rate limit**: 10 requests per ~60-second window
- **Timestamp formats**: two mixed formats per response:
  1. Unix milliseconds integer (e.g. `1769541612369`)
  2. ISO 8601 string (e.g. `"2026-01-27T19:19:13.629Z"`)
- **Total events**: 3,000,000 (from `meta.total`)
- **Event fields**: `id`, `sessionId`, `userId`, `type`, `name`, `properties`, `timestamp`, `session`
- **Cursor expiry**: ~116 seconds — expired cursors return 400; paginator resets to start on expiry
- **No bulk/export endpoints found**: `/events/export`, `/events/bulk`, `/events/stream` all return 404

## Throughput approach

- **PAGE_SIZE = 5000** (maximum the API accepts)
- **CONCURRENCY = 1** (single sequential stream; multiple streams don't help due to shared rate limit)
- **Rate limit math**: 10 req/60s × 5000 events = ~833 events/sec theoretical maximum
- **Observed throughput**: ~1,000–1,333 events/sec (burst when remaining > 0, then wait)
- **DB writes**: Drizzle bulk insert in 500-row chunks, `onConflictDoNothing` for idempotency
- **DB pool**: 10 connections max via `pg.Pool`
- **Local write speed**: ~11,000 rows/sec (not the bottleneck — API rate limit is)

## Resumability

The `checkpoints` table has exactly one row (id=1) with:
- `cursor`: the last successfully committed pagination cursor
- `events_ingested`: running total of events written
- `updated_at`: timestamp of last update

On each batch:
1. Fetch a page from the API
2. Bulk-insert to the `events` table (idempotent — conflicts are ignored)
3. **Then** update the checkpoint with the new cursor and count

On crash/restart:
- The checkpoint is loaded at startup
- Pagination resumes from `cursor` — no events are skipped or double-inserted
- If the cursor has expired (>116s old), the paginator resets to page 1 and re-ingests (idempotency ensures no duplicates)

## AI tools used

Claude (claude.ai) was used for architecture planning, task breakdown, and code generation. All code was reviewed and verified manually. API discovery was done by running actual curl commands and analyzing responses.

## What I would improve

- **Unit tests**: normalizer, rate limiter, checkpoint logic
- **Integration tests**: mock API server + test DB
- **Drizzle Studio**: `yarn db:studio` for visual inspection of the DB during ingestion
- **Monitoring**: Prometheus metrics (events/sec, cursor age, DB pool utilization)
- **Multiple API keys**: could parallelize with separate keys and independent cursor streams
- **Exponential backoff with jitter**: for rate limit waits
- **Graceful shutdown**: SIGTERM handler to flush in-flight writes and save final checkpoint
