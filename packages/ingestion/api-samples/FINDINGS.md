# API Discovery Findings

## Pagination
- Cursor field name in response body: `pagination.nextCursor`
- `pagination.hasMore`: boolean indicating more pages exist
- `pagination.cursorExpiresIn`: seconds until cursor expires (~116 seconds)
- Max limit per request: **5000** (limit=10000 still returns 5000)
- Default limit: 100
- Pagination style: cursor-based (opaque base64 JWT cursor)
- Query param for cursor: `cursor`
- Query param for limit: `limit`

## Rate Limits
- Header names: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Requests per window: 10
- Window duration: ~60 seconds (X-RateLimit-Reset shows seconds remaining)
- Retry-After behavior: not observed (no 429 encountered during discovery)
- Note: X-RateLimit-Reset appears to be seconds remaining (not unix timestamp)

## Timestamp Formats
- Observed formats:
  1. Unix milliseconds integer: e.g. `1769541612369`
  2. ISO 8601 string: e.g. `"2026-01-27T19:19:13.629Z"`
- Both formats appear in the same response, mixed per-event

## Event Schema
Fields observed in data array items:
- `id`: string (UUID)
- `sessionId`: string (UUID)
- `userId`: string (UUID)
- `type`: string (e.g. "click", "page_view", "form_submit", "api_call", "scroll", "error", "video_play", "purchase")
- `name`: string (e.g. "event_e8o287")
- `properties`: object (e.g. `{"page": "/home"}`)
- `timestamp`: number (unix ms) OR string (ISO 8601)
- `session`: object with `id`, `deviceType`, `browser`

## Meta
- `meta.total`: 3000000 (total events across all pages)
- `meta.returned`: count in this response
- `meta.requestId`: string

## Undocumented Endpoints
- `/events/export` → 404 (not found)
- `/events/bulk` → 404 (not found)
- `/export` → no response captured
- `/events/stream` → no response captured
- No bulk/streaming endpoints exist

## Fastest Ingestion Path Found
- Use `/events?limit=5000` with cursor pagination
- Max page size is 5000
- Rate limit is 10 requests per ~60s window → max ~833 events/sec theoretical
- Actual throughput depends on DB write speed and request latency
- No batch/export endpoint exists — must paginate sequentially or with multiple independent streams
