export function normalizeTimestamp(raw: unknown): Date {
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Unix milliseconds (> year 2001 threshold) vs Unix seconds
    return raw > 1_000_000_000_000 ? new Date(raw) : new Date(raw * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (isNaN(d.getTime())) throw new Error(`Unparseable timestamp: "${raw}"`);
    return d;
  }
  throw new Error(`Unknown timestamp type: ${typeof raw} — ${JSON.stringify(raw)}`);
}
