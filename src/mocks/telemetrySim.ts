import type { Alert, Machine, MachineTelemetry } from "../types";

/**
 * Telemetry simulation shared by the history endpoint and the WebSocket
 * emulator, so what you scroll back to and what streams in agree.
 *
 * Each machine's series ends at the fixture's current telemetry. Machines
 * with alerts start from a healthy baseline for their type and step to the
 * faulted values around the alert time, so a chart shows the excursion where
 * the marker is. Everything else is a gentle random walk.
 */
const TYPICAL: Record<Machine["type"], MachineTelemetry> = {
  cnc_mill: { temperature: 60, vibration: 2, throughput: 44, powerDraw: 12 },
  robotic_arm: { temperature: 45, vibration: 0.6, throughput: 110, powerDraw: 8.5 },
  conveyor: { temperature: 36, vibration: 1, throughput: 150, powerDraw: 4.8 },
  press: { temperature: 55, vibration: 2.5, throughput: 40, powerDraw: 15 },
  welder: { temperature: 80, vibration: 3, throughput: 30, powerDraw: 21 },
  spray_booth: { temperature: 24, vibration: 0.3, throughput: 15, powerDraw: 6.5 },
};

const FIELDS: (keyof MachineTelemetry)[] = ["temperature", "vibration", "throughput", "powerDraw"];
const NOISE: MachineTelemetry = { temperature: 1.8, vibration: 0.3, throughput: 6, powerDraw: 0.7 };

/** Which telemetry field an alert message is about (mirrors the UI heuristic). */
function fieldFor(message: string): keyof MachineTelemetry | null {
  if (/temperature|overheat|coolant|thermal|°c/i.test(message)) return "temperature";
  if (/vibration|belt|electrode|hydraulic|spindle|wear|tension|pressure/i.test(message)) return "vibration";
  if (/power|voltage|emergency stop|supply|electrical/i.test(message)) return "powerDraw";
  if (/throughput|calibration|filter|hours|milestone|maintenance/i.test(message)) return "throughput";
  return null;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface Sample extends MachineTelemetry {
  t: number;
}

/** Value of every field at time t (ms), before noise. */
function baseline(machine: Machine, alerts: Alert[], t: number): MachineTelemetry {
  const current = machine.telemetry;
  const healthy = TYPICAL[machine.type];
  const out = { ...current };
  const mine = alerts.filter((a) => a.machineId === machine.id);
  const faulted = machine.status === "error";
  for (const f of FIELDS) {
    const related = mine
      .map((a) => ({ a, f: fieldFor(a.message) }))
      .filter((x) => x.f === f && !Number.isNaN(Date.parse(x.a.timestamp)))
      .sort((x, y) => Date.parse(x.a.timestamp) - Date.parse(y.a.timestamp));
    const stepAt = related[0] ? Date.parse(related[0].a.timestamp) : faulted && f === "throughput" ? Date.parse(machine.lastUpdated) : null;
    if (stepAt === null) continue;
    // move from a healthy value to the current (faulted) value over ~6 minutes centred on the alert
    const from = f === "throughput" ? Math.max(current[f], healthy[f]) : Math.min(current[f], healthy[f]);
    const k = sigmoid((t - stepAt) / (90 * 1000));
    out[f] = from + (current[f] - from) * k;
  }
  return out;
}

export function historyFor(machine: Machine, alerts: Alert[], from: number, to: number, stepMs: number): Sample[] {
  const rand = prng(hash(machine.id));
  const walk: MachineTelemetry = { temperature: 0, vibration: 0, throughput: 0, powerDraw: 0 };
  const out: Sample[] = [];
  for (let t = from; t <= to; t += stepMs) {
    const b = baseline(machine, alerts, t);
    const s: Sample = { t, ...b };
    for (const f of FIELDS) {
      walk[f] = walk[f] * 0.85 + (rand() - 0.5) * NOISE[f];
      s[f] = round(f, Math.max(0, b[f] + walk[f]));
    }
    out.push(s);
  }
  return out;
}

const liveWalk = new Map<string, MachineTelemetry>();

/** Next live reading for a machine: continues the random walk from the last one. */
export function nextLive(machine: Machine, alerts: Alert[], now: number): MachineTelemetry {
  const b = baseline(machine, alerts, now);
  const w = liveWalk.get(machine.id) ?? { temperature: 0, vibration: 0, throughput: 0, powerDraw: 0 };
  const out = { ...b };
  for (const f of FIELDS) {
    w[f] = w[f] * 0.85 + (Math.random() - 0.5) * NOISE[f];
    out[f] = round(f, Math.max(0, b[f] + w[f]));
  }
  liveWalk.set(machine.id, w);
  return out;
}

function round(f: keyof MachineTelemetry, v: number) {
  return f === "throughput" ? Math.round(v) : Math.round(v * 100) / 100;
}
