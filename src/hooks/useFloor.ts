import { useMemo } from "react";
import type { Machine, Zone } from "../types";
import { useAlertsFeed } from "./useAlertsFeed";
import { useMachines } from "./useMachines";
import { useZones } from "./useZones";
import {
  deriveZoneHealth,
  machineState,
  worstSeverity,
  type MachineState,
  type Severity,
} from "../lib/health";
import type { NormalizedAlert } from "../lib/normalize";

export interface MachineModel {
  machine: Machine;
  state: MachineState<NormalizedAlert>;
}

export interface ZoneModel {
  zone: Zone;
  machines: MachineModel[];
  health: Zone["health"];
  openAlerts: NormalizedAlert[];
  worst: Severity | null;
}

/** Zones, their machines, and alerts joined into one view model for the maps. */
export function useFloor() {
  const zonesQ = useZones();
  const machinesQ = useMachines();
  const { alerts, isLoading: alertsLoading } = useAlertsFeed();

  const zones = useMemo<ZoneModel[]>(() => {
    const machines = machinesQ.data ?? [];
    return (zonesQ.data ?? []).map((zone) => {
      const zoneMachines = machines.filter((m) => m.zoneId === zone.id);
      const zoneAlerts = alerts.filter((a) => a.zoneId === zone.id);
      const openAlerts = zoneAlerts.filter((a) => !a.acknowledged);
      return {
        zone,
        machines: zoneMachines.map((machine) => ({
          machine,
          state: machineState(machine, zoneAlerts),
        })),
        health: deriveZoneHealth(zoneMachines, zoneAlerts),
        openAlerts,
        worst: worstSeverity(openAlerts),
      };
    });
  }, [zonesQ.data, machinesQ.data, alerts]);

  return {
    zones,
    alerts,
    isLoading: zonesQ.isLoading || machinesQ.isLoading || alertsLoading,
    isError: zonesQ.isError || machinesQ.isError,
  };
}
