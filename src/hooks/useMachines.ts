import { useQuery } from "@tanstack/react-query";
import type { Machine, Zone } from "../types";

/**
 * There is no "all machines" endpoint, so fan out one request per zone and
 * flatten. One cache entry keyed ["machines"] keeps live telemetry patches simple.
 */
export function useMachines() {
  return useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: async () => {
      const zonesRes = await fetch("/api/zones");
      if (!zonesRes.ok) throw new Error("Failed to fetch zones");
      const zones: Zone[] = await zonesRes.json();
      const perZone = await Promise.all(
        zones.map(async (z) => {
          const res = await fetch(`/api/zones/${z.id}/machines`);
          if (!res.ok) throw new Error(`Failed to fetch machines for ${z.id}`);
          return (await res.json()) as Machine[];
        })
      );
      return perZone.flat();
    },
    staleTime: Infinity, // live updates arrive over the socket
  });
}
