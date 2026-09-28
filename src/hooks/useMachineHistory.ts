import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { seedHistory, type Sample } from "../lib/telemetryStore";

/** Loads the last hour of telemetry for a machine into the chart buffer. */
export function useMachineHistory(machineId: string | undefined, minutes = 60) {
  const query = useQuery<{ machineId: string; samples: Sample[] }>({
    queryKey: ["telemetry-history", machineId, minutes],
    enabled: !!machineId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machineId}/telemetry?minutes=${minutes}`);
      if (!res.ok) throw new Error("Failed to fetch telemetry history");
      return res.json();
    },
  });
  useEffect(() => {
    if (query.data) seedHistory(query.data.machineId, query.data.samples);
  }, [query.data]);
  return query;
}
