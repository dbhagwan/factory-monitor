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

export function alertsPerHour(alerts: NormalizedAlert[], hours: number, now = Date.now()): HourBucket[] {
  const hourMs = 3_600_000;
  const start = Math.floor(now / hourMs) * hourMs - (hours - 1) * hourMs;
  const buckets: HourBucket[] = Array.from({ length: hours }, (_, i) => ({ t: start + i * hourMs, critical: 0, warning: 0, info: 0 }));
  for (const a of alerts) {
    if (!a.timestampValid) continue;
    const i = Math.floor((Date.parse(a.timestamp) - start) / hourMs);
    if (i >= 0 && i < hours) buckets[i][a.severity] += 1;
  }
  return buckets;
}

/** Failures per hour: critical and warning alerts raised in the window. */
export function failureRate(alerts: NormalizedAlert[], hours: number, now = Date.now()): number {
  const from = now - hours * 3_600_000;
  const n = alerts.filter((a) => a.timestampValid && a.severity !== "info" && Date.parse(a.timestamp) >= from).length;
  return n / hours;
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
