import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Alert } from "../types";
import { assign, isLiveAlertId, setLiveAlertAcknowledged, unassign } from "../lib/telemetryStore";

export interface AcknowledgeInput {
  alertId: string;
  operator: string;
}

export interface AcknowledgeResult {
  success: boolean;
  /** True when the server did not know the alert (it arrived over the socket). */
  localOnly?: boolean;
}

/**
 * Acknowledge with an optimistic update so the floor map and lists respond
 * immediately. Alerts that arrived over the WebSocket are not in the mock
 * server's store and return 404; we keep the acknowledgement locally and tell
 * the operator, rather than pretending the round-trip succeeded.
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation<AcknowledgeResult, Error, AcknowledgeInput, { previous: [unknown, unknown][] }>({
    mutationFn: async ({ alertId, operator }) => {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator }),
      });
      if (response.status === 404 && isLiveAlertId(alertId)) {
        return { success: true, localOnly: true };
      }
      if (!response.ok) throw new Error("Failed to acknowledge alert");
      return response.json();
    },
    onMutate: async ({ alertId, operator }) => {
      assign(alertId, operator);
      await queryClient.cancelQueries({ queryKey: ["alerts"] });
      const previous = queryClient.getQueriesData<Alert[]>({ queryKey: ["alerts"] });
      queryClient.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (old) =>
        old?.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      setLiveAlertAcknowledged(alertId, true);
      return { previous };
    },
    onError: (_err, { alertId }, context) => {
      context?.previous.forEach(([key, data]) =>
        queryClient.setQueryData(key as readonly unknown[], data)
      );
      setLiveAlertAcknowledged(alertId, false);
      unassign(alertId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
