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

const MAX_SAMPLES = 400;
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

/** Replace the buffer's past with server history, keeping newer live samples. */
export function seedHistory(machineId: string, history: Sample[]) {
  const last = history[history.length - 1]?.t ?? -Infinity;
  const live = (buffers.get(machineId) ?? []).filter((s) => s.t > last);
  buffers.set(machineId, [...history, ...live].slice(-MAX_SAMPLES));
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

// ---- ownership: who acknowledged what -------------------------------------

export interface Assignment {
  by: string;
  at: number;
}

const OPERATOR_KEY = "fm.operator";
const ASSIGN_KEY = "fm.assignments";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

let operator: string = load<string>(OPERATOR_KEY, "");
let assignments: Record<string, Assignment> = load<Record<string, Assignment>>(ASSIGN_KEY, {});

export function setOperator(name: string) {
  operator = name.trim();
  save(OPERATOR_KEY, operator);
  notify();
}
export function useOperator(): string {
  return useSyncExternalStore(subscribe, () => operator);
}

/** The mock acknowledge endpoint takes no body, so ownership is kept here. */
export function assign(alertId: string, by: string) {
  assignments = { ...assignments, [alertId]: { by, at: Date.now() } };
  save(ASSIGN_KEY, assignments);
  notify();
}
export function unassign(alertId: string) {
  const { [alertId]: _dropped, ...rest } = assignments;
  assignments = rest;
  save(ASSIGN_KEY, assignments);
  notify();
}
export function useAssignments(): Record<string, Assignment> {
  return useSyncExternalStore(subscribe, () => assignments);
}
