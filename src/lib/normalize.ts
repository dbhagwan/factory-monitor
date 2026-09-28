import type { Alert, Machine, Zone } from "../types";
import { classifyChannel, type Channel } from "./channels";

export interface NormalizedAlert extends Alert {
  channel: Channel;
  /** False when the source timestamp is missing or implausible. */
  timestampValid: boolean;
}

export interface LookupContext {
  zonesById: Map<string, Zone>;
  machinesById: Map<string, Machine>;
}

const EARLIEST_PLAUSIBLE = Date.parse("2000-01-01T00:00:00Z");

export function isPlausibleTimestamp(ts: unknown): ts is string {
  if (typeof ts !== "string") return false;
  const t = Date.parse(ts);
  return !Number.isNaN(t) && t >= EARLIEST_PLAUSIBLE && t <= Date.now() + 60_000;
}

/**
 * Normalise an alert from any source (REST or WebSocket) into a shape the UI
 * can trust. The source data has known inconsistencies, each handled here:
 *  - some records use `machine_name` instead of `machineName`
 *  - `zoneName` is sometimes wrong, or is the zone id (WebSocket payloads)
 *  - timestamps can be garbage (e.g. 1969)
 */
export function normalizeAlert(raw: unknown, ctx: LookupContext): NormalizedAlert {
  const r = (raw ?? {}) as Record<string, unknown>;
  const machineId = String(r.machineId ?? "");
  const zoneId = String(r.zoneId ?? ctx.machinesById.get(machineId)?.zoneId ?? "");
  const machine = ctx.machinesById.get(machineId);
  const zone = ctx.zonesById.get(zoneId);
  const message = String(r.message ?? "");
  const severity = (["critical", "warning", "info"] as const).includes(
    r.severity as Alert["severity"]
  )
    ? (r.severity as Alert["severity"])
    : "info";

  return {
    id: String(r.id ?? `unknown-${machineId}-${message}`),
    machineId,
    machineName: String(r.machineName ?? r.machine_name ?? machine?.name ?? machineId),
    zoneId,
    zoneName: zone?.name ?? String(r.zoneName ?? zoneId),
    severity,
    message,
    timestamp: String(r.timestamp ?? ""),
    timestampValid: isPlausibleTimestamp(r.timestamp),
    acknowledged: Boolean(r.acknowledged),
    channel: classifyChannel(message),
  };
}

export function relativeTime(ts: string, valid: boolean, now = Date.now()): string {
  if (!valid) return "time unknown";
  const diff = Math.max(0, now - Date.parse(ts));
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ts).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
