import type { NormalizedAlert } from "./normalize";
import type { Severity } from "./health";
import { CHANNELS, CHANNEL_META, type Channel } from "./channels";

/** Pure KPI reducers over the normalised alert feed. */

export interface HourBucket {
  t: number;
  critical: number;
  warning: number;
  info: number;
}

export function countByChannel(alerts: NormalizedAlert[]): Array<{ channel: Channel; label: string; value: number }> {
  return CHANNELS.map((c) => ({ channel: c, label: CHANNEL_META[c].label, value: alerts.filter((a) => a.channel === c).length }));
}

export function countByZone(alerts: NormalizedAlert[], zoneNames: Array<{ id: string; name: string }>) {
  return zoneNames.map((z) => {
    const mine = alerts.filter((a) => a.zoneId === z.id);
    return { zone: z.name, open: mine.filter((a) => !a.acknowledged).length, inProgress: mine.filter((a) => a.acknowledged).length };
  });
}

export function topMachines(alerts: NormalizedAlert[], n = 5): Array<{ machine: string; value: number; worst: Severity }> {
  const map = new Map<string, { value: number; worst: Severity }>();
  const rank: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
  for (const a of alerts) {
    const cur = map.get(a.machineName) ?? { value: 0, worst: "info" as Severity };
    cur.value += 1;
    if (rank[a.severity] > rank[cur.worst]) cur.worst = a.severity;
    map.set(a.machineName, cur);
  }
  return [...map.entries()]
    .map(([machine, v]) => ({ machine, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Mean time to acknowledge, in minutes, over alerts owned this session. */
export function meanTimeToAcknowledge(alerts: NormalizedAlert[]): number | null {
  const deltas = alerts
    .filter((a) => a.acknowledgedAt && a.timestampValid)
    .map((a) => (a.acknowledgedAt! - Date.parse(a.timestamp)) / 60_000)
    .filter((m) => m >= 0);
  if (!deltas.length) return null;
  return deltas.reduce((s, m) => s + m, 0) / deltas.length;
}

// ---- time ranges ---------------------------------------------------------

export type Range = "day" | "week" | "month" | "quarter" | "year" | "all";

export const RANGES: Array<{ id: Range; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

type Unit = "hour" | "day" | "week" | "month";

interface RangeSpec {
  unit: Unit;
  count: number;
  windowLabel: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const SPEC: Record<Exclude<Range, "all">, RangeSpec> = {
  day: { unit: "hour", count: 24, windowLabel: "last 24 h" },
  week: { unit: "day", count: 7, windowLabel: "last 7 days" },
  month: { unit: "day", count: 30, windowLabel: "last 30 days" },
  quarter: { unit: "week", count: 13, windowLabel: "last 13 weeks" },
  year: { unit: "month", count: 12, windowLabel: "last 12 months" },
};

function startOf(unit: Unit, t: number): number {
  const d = new Date(t);
  if (unit === "hour") return Math.floor(t / HOUR) * HOUR;
  d.setHours(0, 0, 0, 0);
  if (unit === "week") d.setDate(d.getDate() - d.getDay());
  if (unit === "month") d.setDate(1);
  return d.getTime();
}
function addUnit(unit: Unit, t: number, n: number): number {
  const d = new Date(t);
  if (unit === "hour") return t + n * HOUR;
  if (unit === "day") d.setDate(d.getDate() + n);
  if (unit === "week") d.setDate(d.getDate() + 7 * n);
  if (unit === "month") d.setMonth(d.getMonth() + n);
  return d.getTime();
}

export function rangeSpec(range: Range, alerts: NormalizedAlert[], now = Date.now()): RangeSpec & { from: number | null } {
  if (range !== "all") {
    const s = SPEC[range];
    return { ...s, from: addUnit(s.unit, startOf(s.unit, now), -(s.count - 1)) };
  }
  // All time: monthly buckets from the earliest alert we know of, at least three.
  const valid = alerts.filter((a) => a.timestampValid).map((a) => Date.parse(a.timestamp));
  const earliest = valid.length ? Math.min(...valid) : now;
  const thisMonth = startOf("month", now);
  let count = 1;
  let cursor = thisMonth;
  while (cursor > earliest && count < 120) {
    cursor = addUnit("month", cursor, -1);
    count++;
  }
  count = Math.max(count, 3);
  return { unit: "month", count, windowLabel: "all time", from: null };
}

export function inRange(alerts: NormalizedAlert[], range: Range, now = Date.now()): NormalizedAlert[] {
  if (range === "all") return alerts;
  const { from } = rangeSpec(range, alerts, now);
  return alerts.filter((a) => a.timestampValid && Date.parse(a.timestamp) >= (from ?? 0));
}

export function alertsOverTime(alerts: NormalizedAlert[], range: Range, now = Date.now()): HourBucket[] {
  const spec = rangeSpec(range, alerts, now);
  const first = addUnit(spec.unit, startOf(spec.unit, now), -(spec.count - 1));
  const starts = Array.from({ length: spec.count }, (_, i) => addUnit(spec.unit, first, i));
  const buckets: HourBucket[] = starts.map((t) => ({ t, critical: 0, warning: 0, info: 0 }));
  for (const a of alerts) {
    if (!a.timestampValid) continue;
    const t = Date.parse(a.timestamp);
    if (t < first) continue;
    let i = starts.length - 1;
    while (i > 0 && starts[i] > t) i--;
    buckets[i][a.severity] += 1;
  }
  return buckets;
}

const UNIT_MS: Record<Unit, number> = { hour: HOUR, day: DAY, week: 7 * DAY, month: 30.44 * DAY };
export const UNIT_SHORT: Record<Unit, string> = { hour: "h", day: "day", week: "week", month: "month" };

/** Failures (critical + warning) per bucket unit of the range: per hour for a day, per week for a quarter, and so on. */
export function failureRateFor(alerts: NormalizedAlert[], range: Range, now = Date.now()): { value: number; per: Unit } {
  const spec = rangeSpec(range, alerts, now);
  const windowed = inRange(alerts, range, now).filter((a) => a.severity !== "info");
  let spanMs: number;
  if (spec.from !== null) spanMs = now - spec.from;
  else {
    const valid = windowed.filter((a) => a.timestampValid).map((a) => Date.parse(a.timestamp));
    spanMs = valid.length ? Math.max(UNIT_MS[spec.unit], now - Math.min(...valid)) : UNIT_MS[spec.unit];
  }
  const denom = spanMs / UNIT_MS[spec.unit];
  return { value: denom > 0 ? windowed.length / denom : 0, per: spec.unit };
}

export function bucketLabel(unit: Unit): string {
  return { hour: "per hour", day: "per day", week: "per week", month: "per month" }[unit];
}

export function formatBucket(unit: Unit, t: number): string {
  const d = new Date(t);
  if (unit === "hour") return d.toLocaleTimeString([], { hour: "2-digit" });
  if (unit === "month") return d.toLocaleDateString([], { month: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
