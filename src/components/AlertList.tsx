import { Skeleton, Stack } from "@chakra-ui/react";
import type { NormalizedAlert } from "../lib/normalize";
import { AlertRow } from "./AlertRow";
import { EmptyState } from "./EmptyState";

interface Props {
  alerts: NormalizedAlert[];
  isLoading?: boolean;
  compact?: boolean;
  onLocate?: (alert: NormalizedAlert) => void;
  onHover?: (alert: NormalizedAlert | null) => void;
  emptyTitle?: string;
  emptyBody?: string;
}

export function AlertList({ alerts, isLoading, compact, onLocate, onHover, emptyTitle, emptyBody }: Props) {
  if (isLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h={compact ? "56px" : "72px"} borderRadius="md" />
        ))}
      </Stack>
    );
  }
  if (alerts.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? "No open alerts"}
        body={emptyBody ?? "Every machine is reporting within normal limits."}
      />
    );
  }
  return (
    <Stack spacing={2}>
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} compact={compact} onLocate={onLocate} onHover={onHover} />
      ))}
    </Stack>
  );
}
