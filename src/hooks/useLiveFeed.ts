import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Machine, MachineTelemetry, Zone } from "../types";
import { useFactoryWebSocket } from "./useFactoryWebSocket";
import { useMachines } from "./useMachines";
import { useZones } from "./useZones";
import { normalizeAlert } from "../lib/normalize";
import {
  addLiveAlert,
  markMessage,
  pushSample,
  seedSample,
  setConnected,
} from "../lib/telemetryStore";

interface TelemetryPayload {
  machineId: string;
  telemetry: MachineTelemetry;
  timestamp: string;
}

/**
 * Single subscriber to the WebSocket, mounted once in App.
 *  - telemetry → ring buffer for charts + patch the ["machines"] cache
 *  - alert     → normalised and added to the live alert store
 */
export function useLiveFeed() {
  const queryClient = useQueryClient();
  const { data: zones } = useZones();
  const { data: machines } = useMachines();

  const ctx = useMemo(
    () => ({
      zonesById: new Map<string, Zone>((zones ?? []).map((z) => [z.id, z])),
      machinesById: new Map<string, Machine>((machines ?? []).map((m) => [m.id, m])),
    }),
    [zones, machines]
  );

  // Seed chart history with the last-known REST value.
  useEffect(() => {
    machines?.forEach((m) => seedSample(m.id, m.telemetry, m.lastUpdated));
  }, [machines]);

  useFactoryWebSocket(
    (message) => {
      markMessage();
      if (message.type === "telemetry") {
        const p = message.payload as TelemetryPayload;
        const t = Date.parse(p.timestamp) || Date.now();
        pushSample(p.machineId, { ...p.telemetry, t });
        queryClient.setQueryData<Machine[]>(["machines"], (old) =>
          old?.map((m) =>
            m.id === p.machineId
              ? { ...m, telemetry: p.telemetry, lastUpdated: p.timestamp }
              : m
          )
        );
      } else if (message.type === "alert") {
        addLiveAlert(normalizeAlert(message.payload, ctx));
      }
    },
    setConnected
  );
}
