import { useSyncExternalStore } from "react";
import type { MachineTelemetry } from "../types";

/**
 * Small external store for live data that changes faster than server state:
 *  - a ring buffer of telemetry samples per machine (for charts)
 *  - alerts that arrived over the WebSocket and are unknown to the REST API
 *  - connection status
 * Kept outside React Query because these are client-side, append-only streams.
 */

export interface Sample extends MachineTelemetry {
  t: number;
}

const MAX_SAMPLES = 60;
const buffers = new Map<string, Sample[]>();
const EMPTY: Sample[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function pushSample(machineId: string, sample: Sample) {
  const prev = buffers.get(machineId) ?? [];
  const next = [...prev, sample].slice(-MAX_SAMPLES);
  buffers.set(machineId, next);
  notify();
}

/** Seed a buffer with the last-known REST value so charts are never empty. */
export function seedSample(machineId: string, telemetry: MachineTelemetry, at: string) {
  if (buffers.has(machineId)) return;
  const t = Date.parse(at);
  buffers.set(machineId, [{ ...telemetry, t: Number.isNaN(t) ? Date.now() : t }]);
  notify();
}

export function useTelemetryHistory(machineId: string | undefined): Sample[] {
  return useSyncExternalStore(subscribe, () =>
    machineId ? buffers.get(machineId) ?? EMPTY : EMPTY
  );
}

// ---- live status ---------------------------------------------------------

export interface LiveStatus {
  connected: boolean;
  lastMessageAt: number | null;
  messageCount: number;
}

let liveStatus: LiveStatus = { connected: false, lastMessageAt: null, messageCount: 0 };

export function setConnected(connected: boolean) {
  liveStatus = { ...liveStatus, connected };
  notify();
}

export function markMessage() {
  liveStatus = {
    ...liveStatus,
    lastMessageAt: Date.now(),
    messageCount: liveStatus.messageCount + 1,
  };
  notify();
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(subscribe, () => liveStatus);
}

// ---- alerts that only exist on the socket --------------------------------

import type { NormalizedAlert } from "./normalize";

let liveAlerts: NormalizedAlert[] = [];

export function addLiveAlert(alert: NormalizedAlert) {
  if (liveAlerts.some((a) => a.id === alert.id)) return;
  liveAlerts = [alert, ...liveAlerts];
  notify();
}

export function setLiveAlertAcknowledged(id: string, acknowledged: boolean) {
  if (!liveAlerts.some((a) => a.id === id)) return;
  liveAlerts = liveAlerts.map((a) => (a.id === id ? { ...a, acknowledged } : a));
  notify();
}

export function isLiveAlertId(id: string) {
  return liveAlerts.some((a) => a.id === id);
}

export function useLiveAlerts(): NormalizedAlert[] {
  return useSyncExternalStore(subscribe, () => liveAlerts);
}
