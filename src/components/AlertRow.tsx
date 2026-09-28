import { Box, Button, HStack, Input, Text, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useAcknowledgeAlert } from "../hooks/useAcknowledgeAlert";
import { CHANNEL_META } from "../lib/channels";
import { toneHex } from "../lib/health";
import { relativeTime, type NormalizedAlert } from "../lib/normalize";
import { SeverityBadge } from "./SeverityBadge";
import { setOperator, useOperator } from "../lib/telemetryStore";

interface Props {
  alert: NormalizedAlert;
  compact?: boolean;
  onLocate?: (alert: NormalizedAlert) => void;
  /** Fired with the alert on mouse enter and null on leave, to highlight its machine. */
  onHover?: (alert: NormalizedAlert | null) => void;
}

const CONFIRM_WINDOW_MS = 4000;

export function AlertRow({ alert, compact, onLocate, onHover }: Props) {
  const ack = useAcknowledgeAlert();
  const toast = useToast();
  const hex = toneHex(alert.severity);
  // Acknowledging is a two-step action so a stray click cannot do it.
  const [confirming, setConfirming] = useState(false);
  const operator = useOperator();
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(id);
  }, [confirming]);

  const acknowledge = () => {
    const by = operator || nameDraft.trim();
    if (!by) return;
    if (!operator) setOperator(by);
    setConfirming(false);
    ack.mutate({ alertId: alert.id, operator: by }, {
      onSuccess: (r) => {
        if (r.localOnly) {
          toast({
            title: "Acknowledged locally",
            description: "This alert arrived live and the server has not stored it yet.",
            status: "info",
            duration: 4000,
          });
        }
      },
      onError: () =>
        toast({ title: "Could not acknowledge", status: "error", duration: 4000 }),
    });
  };

  return (
    <HStack
      align="stretch"
      spacing={0}
      bg="carbon.900"
      borderRadius="md"
      overflow="hidden"
      opacity={alert.acknowledged ? 0.6 : 1}
      transition="opacity 200ms, background 150ms"
      role="group"
      data-alert-row={alert.id}
      onMouseEnter={() => onHover?.(alert)}
      onMouseLeave={() => onHover?.(null)}
      _hover={{ bg: "carbon.800" }}
    >
      <Box
        w="4px"
        flexShrink={0}
        bg={alert.acknowledged ? "transparent" : hex}
        borderLeft={alert.acknowledged ? `4px solid ${hex}55` : undefined}
      />
      <HStack flex={1} spacing={3} px={3} py={compact ? 2 : 3} minW={0}>
        <Box flex={1} minW={0}>
          <HStack spacing={2} mb={0.5}>
            <SeverityBadge severity={alert.severity} hollow={alert.acknowledged} />
            <Text fontWeight={500} fontSize="sm" noOfLines={1}>
              {alert.machineName}
            </Text>
            {!compact && (
              <Text fontSize="xs" color="text.muted">
                {CHANNEL_META[alert.channel].label}
              </Text>
            )}
          </HStack>
          <Text fontSize="sm" color={compact ? "text.muted" : "ink"} noOfLines={compact ? 1 : 2}>
            {alert.message}
          </Text>
          <HStack spacing={2} mt={1} fontSize="xs" color="text.muted" whiteSpace="nowrap" overflow="hidden">
            <Text
              as="button"
              onClick={() => onLocate?.(alert)}
              color={onLocate ? "brand.300" : undefined}
              _hover={{ color: "brand.400", textDecoration: "underline" }}
            >
              {alert.zoneName}
            </Text>
            <Text>·</Text>
            <Text title={alert.timestampValid ? new Date(alert.timestamp).toLocaleString() : undefined}>
              {relativeTime(alert.timestamp, alert.timestampValid)}
            </Text>
          </HStack>
        </Box>
        {alert.acknowledged ? (
          <Box textAlign="right" flexShrink={0}>
            <Text fontSize="xs" color="brand.300">In progress</Text>
            {alert.acknowledgedBy && (
              <Text fontSize="xs" color="text.muted">{alert.acknowledgedBy}</Text>
            )}
          </Box>
        ) : confirming ? (
          <HStack spacing={1} flexShrink={0}>
            {!operator && (
              <Input
                size="xs"
                w="110px"
                autoFocus
                placeholder="Your name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && acknowledge()}
                bg="carbon.800"
                borderColor="carbon.600"
                borderRadius="md"
              />
            )}
            <Button size="xs" colorScheme="brand" onClick={acknowledge} isLoading={ack.isPending} isDisabled={!operator && !nameDraft.trim()}>
              {operator ? `Confirm as ${operator}` : "Take it"}
            </Button>
            <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </HStack>
        ) : (
          <Button
            size="xs"
            variant="outline"
            colorScheme="gray"
            flexShrink={0}
            isLoading={ack.isPending}
            onClick={() => setConfirming(true)}
            title="Take ownership. The problem stays visible until it clears on its own."
          >
            Acknowledge
          </Button>
        )}
      </HStack>
    </HStack>
  );
}
