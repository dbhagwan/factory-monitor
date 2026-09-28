import type { MachineTelemetry } from "../types";

/**
 * Subsystems.
 *
 * The data model has no subsystem concept: alerts point at a machine and
 * telemetry has four channels. We treat each telemetry channel as the
 * subsystem it monitors and assign every alert to one channel by keyword.
 * This is a presentation-layer heuristic; a real system would carry the
 * subsystem id on the alert.
 */
export type Channel = "thermal" | "mechanical" | "output" | "electrical";

export const CHANNELS: Channel[] = ["thermal", "mechanical", "output", "electrical"];

export interface ChannelMeta {
  label: string;
  field: keyof MachineTelemetry;
  unit: string;
  /** Value above which an operator would expect a warning. */
  warnAbove?: number;
  runbook: { title: string; url: string };
}

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  thermal: {
    label: "Thermal",
    field: "temperature",
    unit: "°C",
    warnAbove: 85,
    runbook: {
      title: "Diagnosing overheating and coolant faults",
      url: "https://runbooks.factory.local/thermal-faults",
    },
  },
  mechanical: {
    label: "Mechanical",
    field: "vibration",
    unit: "mm/s",
    warnAbove: 4,
    runbook: {
      title: "Vibration, wear and drive-train inspection",
      url: "https://runbooks.factory.local/mechanical-inspection",
    },
  },
  output: {
    label: "Output",
    field: "throughput",
    unit: "units/h",
    runbook: {
      title: "Throughput drops, calibration and consumables",
      url: "https://runbooks.factory.local/output-and-calibration",
    },
  },
  electrical: {
    label: "Electrical",
    field: "powerDraw",
    unit: "kW",
    warnAbove: 24,
    runbook: {
      title: "Power supply and emergency-stop recovery",
      url: "https://runbooks.factory.local/electrical-recovery",
    },
  },
};

const KEYWORDS: Array<[Channel, RegExp]> = [
  [
    "thermal",
    /temperature|overheat|coolant|thermal|°c/i,
  ],
  [
    "mechanical",
    /vibration|belt|electrode|hydraulic|spindle|wear|tension|pressure/i,
  ],
  ["electrical", /power|voltage|emergency stop|supply|electrical/i],
  ["output", /throughput|calibration|filter|hours|milestone|maintenance/i],
];

export function classifyChannel(message: string): Channel {
  for (const [channel, pattern] of KEYWORDS) {
    if (pattern.test(message)) return channel;
  }
  return "output";
}
