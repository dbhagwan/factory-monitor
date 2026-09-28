/**
 * The fixtures are a static snapshot taken at FIXTURE_NOW. The mock server
 * shifts every plausible timestamp forward so the snapshot reads as "now":
 * alerts raised minutes ago, machines updated just now, history that ends at
 * the present. Implausible timestamps (a deliberate 1969 record) are left
 * alone so the UI still has to cope with them.
 */
export const FIXTURE_NOW = Date.parse("2025-09-14T10:30:00Z");
export const SESSION_START = Date.now();
const SHIFT = SESSION_START - FIXTURE_NOW;
const EARLIEST_PLAUSIBLE = Date.parse("2000-01-01T00:00:00Z");

export function rebase(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t) || t < EARLIEST_PLAUSIBLE) return ts;
  return new Date(t + SHIFT).toISOString();
}

export function rebaseAll<T extends { timestamp: string }>(items: T[]): T[] {
  return items.map((i) => ({ ...i, timestamp: rebase(i.timestamp) }));
}
