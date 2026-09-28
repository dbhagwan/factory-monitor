import { Box, Button, HStack, Text, useToast } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAcknowledgeAlert } from "../hooks/useAcknowledgeAlert";
import { CHANNEL_META } from "../lib/channels";
import { toneHex } from "../lib/health";
import { relativeTime, type NormalizedAlert } from "../lib/normalize";
import { SeverityBadge } from "./SeverityBadge";

interface Props {
  alert: NormalizedAlert;
  compact?: boolean;
}

export function AlertRow({ alert, compact }: Props) {
  const ack = useAcknowledgeAlert();
  const toast = useToast();
  const hex = toneHex(alert.severity);

  const acknowledge = () =>
    ack.mutate(alert.id, {
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

  return (
    <HStack
      align="stretch"
      spacing={0}
      bg="carbon.900"
      borderRadius="md"
      overflow="hidden"
      opacity={alert.acknowledged ? 0.6 : 1}
      transition="opacity 200ms"
      role="group"
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
          <HStack spacing={2} mt={1} fontSize="xs" color="text.muted">
            <Text
              as={RouterLink}
              to={`/zones/${alert.zoneId}?machine=${alert.machineId}&channel=${alert.channel}`}
              _hover={{ color: "brand.400" }}
            >
              {alert.zoneName}
            </Text>
            <Text>·</Text>
            <Text>{relativeTime(alert.timestamp, alert.timestampValid)}</Text>
          </HStack>
        </Box>
        {alert.acknowledged ? (
          <Text fontSize="xs" color="text.muted" flexShrink={0}>
            Acknowledged
          </Text>
        ) : (
          <Button
            size="xs"
            variant="outline"
            colorScheme="gray"
            flexShrink={0}
            isLoading={ack.isPending}
            onClick={acknowledge}
          >
            Acknowledge
          </Button>
        )}
      </HStack>
    </HStack>
  );
}
