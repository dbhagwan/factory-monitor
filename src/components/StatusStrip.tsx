import { Box, Flex, HStack, Skeleton, Text } from "@chakra-ui/react";
import { useFactoryStatus } from "../hooks/useFactoryStatus";
import type { ZoneModel } from "../hooks/useFloor";
import { toneHex } from "../lib/health";
import type { NormalizedAlert } from "../lib/normalize";

interface Props {
  zones: ZoneModel[];
  alerts: NormalizedAlert[];
  isLoading: boolean;
}

function Stat({ value, label, accent }: { value: React.ReactNode; label: string; accent?: string }) {
  return (
    <Box minW="120px">
      <Text as="div" fontSize="2xl" fontWeight={500} lineHeight={1.1} color={accent}>
        {value}
      </Text>
      <Text fontSize="sm" color="text.muted" mt={1}>
        {label}
      </Text>
    </Box>
  );
}

export function StatusStrip({ zones, alerts, isLoading }: Props) {
  const status = useFactoryStatus();
  const machines = zones.flatMap((z) => z.machines);
  const running = machines.filter((m) => m.machine.status === "running").length;
  const open = alerts.filter((a) => !a.acknowledged);
  const critical = open.filter((a) => a.severity === "critical").length;
  const warning = open.filter((a) => a.severity === "warning").length;
  const attention = zones.filter((z) => z.health !== "healthy");

  if (isLoading) return <Skeleton h="72px" borderRadius="lg" />;

  return (
    <Flex
      bg="carbon.900"
      borderRadius="lg"
      px={5}
      py={4}
      gap={{ base: 6, md: 10 }}
      wrap="wrap"
      align="flex-start"
    >
      <Stat
        value={
          <HStack spacing={2}>
            <Box
              w="10px"
              h="10px"
              borderRadius="full"
              bg={status.data?.connected ? "healthy.500" : "critical.500"}
            />
            <Text as="span">{status.data?.connected ? "Connected" : "Offline"}</Text>
          </HStack>
        }
        label={status.data ? `${Math.round(status.data.uptimeHours)} h uptime` : "Factory link"}
      />
      <Stat value={`${running} / ${machines.length}`} label="Machines running" />
      <Stat
        value={
          <HStack spacing={3}>
            <Text as="span">{open.length}</Text>
            {critical > 0 && (
              <Text as="span" fontSize="md" color={toneHex("critical")}>
                {critical} critical
              </Text>
            )}
            {warning > 0 && (
              <Text as="span" fontSize="md" color={toneHex("warning")}>
                {warning} warning
              </Text>
            )}
          </HStack>
        }
        label="Open problems"
      />
      <Stat
        value={
          <Text as="span" fontSize="xl">
            {attention.length === 0 ? "None" : attention.map((z) => z.zone.name).join(", ")}
          </Text>
        }
        label={attention.length === 1 ? "Zone needs attention" : "Zones need attention"}
        accent={attention.length ? toneHex(attention.some((z) => z.health === "faulted") ? "critical" : "warning") : undefined}
      />
    </Flex>
  );
}
