import type { Alert, Machine, Zone } from "../types";
import { tone } from "../theme";

export type Severity = Alert["severity"];

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function worstSeverity(alerts: Alert[]): Severity | null {
  let worst: Severity | null = null;
  for (const a of alerts) {
    if (!worst || SEVERITY_RANK[a.severity] > SEVERITY_RANK[worst]) worst = a.severity;
  }
  return worst;
}

/** Sort: unacknowledged first, then severity, then newest. */
export function sortAlerts<T extends Alert>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

export type Tone = Severity | "healthy" | "idle" | "maintenance";

export interface MachineState<T extends Alert = Alert> {
  tone: Tone;
  /** True when the colour comes from an acknowledged alert only. */
  hollow: boolean;
  open: T[];
  acked: T[];
}

/**
 * A machine takes the colour of its most severe alert, whether or not someone
 * has taken it: a warning plus an info is amber, a critical in progress plus an
 * open info is still red. It renders hollow only when every alert on it is in
 * progress, meaning "someone is on all of it". With no alerts the colour
 * follows machine status.
 */
export function machineState<T extends Alert>(machine: Machine, alerts: T[]): MachineState<T> {
  const mine = alerts.filter((a) => a.machineId === machine.id);
  const open = mine.filter((a) => !a.acknowledged);
  const acked = mine.filter((a) => a.acknowledged);
  const worst = worstSeverity(mine);
  if (worst) return { tone: worst, hollow: open.length === 0, open, acked };
  if (machine.status === "error") return { tone: "critical", hollow: false, open, acked };
  if (machine.status === "idle") return { tone: "idle", hollow: false, open, acked };
  if (machine.status === "maintenance")
    return { tone: "maintenance", hollow: false, open, acked };
  return { tone: "healthy", hollow: false, open, acked };
}

/**
 * Zone health is derived on the client rather than read from /api/zones,
 * because the mock's zone health is static and never reflects streamed alerts.
 */
export function deriveZoneHealth(machines: Machine[], alerts: Alert[]): Zone["health"] {
  const open = alerts.filter((a) => !a.acknowledged);
  const hasError = machines.some((m) => m.status === "error");
  if (hasError || open.some((a) => a.severity === "critical")) return "faulted";
  if (open.some((a) => a.severity === "warning")) return "degraded";
  return "healthy";
}

export const HEALTH_LABEL: Record<Zone["health"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  faulted: "Faulted",
};

export const HEALTH_TONE: Record<Zone["health"], Tone> = {
  healthy: "healthy",
  degraded: "warning",
  faulted: "critical",
};

export function toneHex(t: Tone): string {
  return tone[t];
}

export const STATUS_LABEL: Record<Machine["status"], string> = {
  running: "Running",
  idle: "Idle",
  error: "Error",
  maintenance: "In maintenance",
};

export const MACHINE_TYPE_LABEL: Record<Machine["type"], string> = {
  cnc_mill: "CNC mill",
  robotic_arm: "Robotic arm",
  conveyor: "Conveyor",
  press: "Press",
  welder: "Welder",
  spray_booth: "Spray booth",
};
