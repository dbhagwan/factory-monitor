import { useMemo } from "react";
import type { Machine, Zone } from "../types";
import { useAlerts } from "./useAlerts";
import { useMachines } from "./useMachines";
import { useZones } from "./useZones";
import { normalizeAlert, type NormalizedAlert } from "../lib/normalize";
import { sortAlerts } from "../lib/health";
import { useLiveAlerts } from "../lib/telemetryStore";

export interface AlertFilters {
  severity?: NormalizedAlert["severity"] | "all";
  zone?: string | "all";
  includeAcknowledged?: boolean;
}

/**
 * The one place alerts are assembled for the UI: REST alerts (fetched
 * unfiltered so there is a single cache entry) merged with alerts that arrived
 * over the socket, normalised, and sorted. Filtering is done client-side so
 * live alerts and server alerts are treated identically.
 */
export function useAlertsFeed() {
  const alertsQuery = useAlerts();
  const { data: zones } = useZones();
  const { data: machines } = useMachines();
  const live = useLiveAlerts();

  const all = useMemo(() => {
    const ctx = {
      zonesById: new Map<string, Zone>((zones ?? []).map((z) => [z.id, z])),
      machinesById: new Map<string, Machine>((machines ?? []).map((m) => [m.id, m])),
    };
    const fromServer = (alertsQuery.data ?? []).map((a) => normalizeAlert(a, ctx));
    const serverIds = new Set(fromServer.map((a) => a.id));
    const fromSocket = live
      .filter((a) => !serverIds.has(a.id))
      .map((a) => normalizeAlert(a, ctx));
    return sortAlerts([...fromSocket, ...fromServer]);
  }, [alertsQuery.data, zones, machines, live]);

  return { ...alertsQuery, alerts: all };
}

export function selectAlerts(alerts: NormalizedAlert[], f: AlertFilters): NormalizedAlert[] {
  return alerts.filter((a) => {
    if (f.severity && f.severity !== "all" && a.severity !== f.severity) return false;
    if (f.zone && f.zone !== "all" && a.zoneId !== f.zone) return false;
    if (!f.includeAcknowledged && a.acknowledged) return false;
    return true;
  });
}
