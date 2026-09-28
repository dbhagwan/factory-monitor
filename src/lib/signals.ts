import type { MachineModel } from "../hooks/useFloor";
import { CHANNELS, CHANNEL_META, type Channel } from "./channels";
import { SEVERITY_RANK, worstSeverity, type Severity } from "./health";

export interface Signal {
  channel: Channel;
  label: string;
  value: string;
  /** Severity of the alerts on this subsystem, null when it is a default readout. */
  severity: Severity | null;
  /** True when the alerts on it are all in progress. */
  hollow: boolean;
}

const DEFAULT_ORDER: Channel[] = ["output", "thermal", "electrical", "mechanical"];

export function formatReading(channel: Channel, value: number): string {
  const meta = CHANNEL_META[channel];
  const v = channel === "output" ? Math.round(value) : channel === "electrical" || channel === "mechanical" ? value.toFixed(1) : value.toFixed(0);
  return channel === "thermal" ? `${v}°C` : `${v} ${meta.unit}`;
}

/**
 * Which readings a machine exposes on the plan: the subsystems with alerts,
 * most severe first (open before in progress), then default readouts to fill
 * the remaining room. The operator sees the number that is misbehaving.
 */
export function exposedSignals(m: MachineModel, max: number, fill = 1): Signal[] {
  const t = m.machine.telemetry;
  const alerted = CHANNELS.map((channel) => {
    const open = m.state.open.filter((a) => a.channel === channel);
    const acked = m.state.acked.filter((a) => a.channel === channel);
    const sev = worstSeverity(open) ?? worstSeverity(acked);
    return sev ? { channel, severity: sev, hollow: open.length === 0 } : null;
  })
    .filter((x): x is { channel: Channel; severity: Severity; hollow: boolean } => x !== null)
    .sort((a, b) => {
      if (a.hollow !== b.hollow) return a.hollow ? 1 : -1;
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    });

  const out: Signal[] = alerted.slice(0, max).map((x) => ({
    channel: x.channel,
    label: CHANNEL_META[x.channel].label,
    value: formatReading(x.channel, t[CHANNEL_META[x.channel].field]),
    severity: x.severity,
    hollow: x.hollow,
  }));
  const want = Math.min(max, Math.max(out.length, fill));
  for (const channel of DEFAULT_ORDER) {
    if (out.length >= want) break;
    if (out.some((s) => s.channel === channel)) continue;
    out.push({ channel, label: CHANNEL_META[channel].label, value: formatReading(channel, t[CHANNEL_META[channel].field]), severity: null, hollow: false });
  }
  return out;
}
