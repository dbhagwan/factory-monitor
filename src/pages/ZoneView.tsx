import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import { IsoScene } from "../components/IsoScene";
import { MachineDetail } from "../components/MachineDetail";
import { EmptyState } from "../components/EmptyState";
import { useFloor } from "../hooks/useFloor";
import { CHANNELS, type Channel } from "../lib/channels";
import { HEALTH_LABEL, HEALTH_TONE, MACHINE_TYPE_LABEL, STATUS_LABEL, toneHex } from "../lib/health";

export function ZoneView() {
  const { zoneId } = useParams();
  const [params, setParams] = useSearchParams();
  const { zones, isLoading } = useFloor();
  const zone = zones.find((z) => z.zone.id === zoneId);

  const machineId = params.get("machine") ?? undefined;
  const channelParam = params.get("channel") as Channel | null;
  const selected = zone?.machines.find((m) => m.machine.id === machineId) ?? null;

  // Default the drawer to the subsystem with the worst open alert.
  const channel: Channel =
    channelParam && CHANNELS.includes(channelParam)
      ? channelParam
      : selected?.state.open[0]?.channel ?? "thermal";

  const select = (id: string, c?: Channel) => {
    const next = new URLSearchParams();
    next.set("machine", id);
    if (c) next.set("channel", c);
    setParams(next);
  };
  const close = () => setParams(new URLSearchParams());

  if (isLoading) {
    return (
      <Box px={{ base: 4, md: 6 }} py={5} maxW="1400px" mx="auto">
        <Skeleton h="24px" w="200px" mb={4} />
        <Skeleton h="480px" borderRadius="lg" />
      </Box>
    );
  }

  if (!zone) {
    return (
      <Box px={6} py={10} maxW="600px" mx="auto">
        <EmptyState
          title="Zone not found"
          body="This zone is not on the floor plan."
          action={
            <Button as={RouterLink} to="/" size="sm" variant="ghost">
              Back to the floor
            </Button>
          }
        />
      </Box>
    );
  }

  const healthHex = toneHex(HEALTH_TONE[zone.health]);

  return (
    <Box px={{ base: 4, md: 6 }} py={5} maxW="1400px" mx="auto">
      <Breadcrumb fontSize="sm" color="text.muted" mb={2}>
        <BreadcrumbItem>
          <BreadcrumbLink as={RouterLink} to="/">
            Floor
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink color="ink">{zone.zone.name}</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Flex justify="space-between" align="baseline" mb={4} wrap="wrap" gap={3}>
        <HStack spacing={3}>
          <Heading size="lg">{zone.zone.name}</Heading>
          <HStack spacing={1.5} px={2} py={0.5} borderRadius="md" bg={`${healthHex}22`}>
            <Box w="6px" h="6px" borderRadius="full" bg={healthHex} />
            <Text fontSize="sm" color={healthHex}>
              {HEALTH_LABEL[zone.health]}
            </Text>
          </HStack>
        </HStack>
        <Text fontSize="sm" color="text.muted">
          {zone.machines.length} machines · {zone.openAlerts.length} open problems
        </Text>
      </Flex>

      <IsoScene zone={zone} selectedMachine={machineId} onSelect={select} />

      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }} gap={2} mt={4}>
        {zone.machines.map((m) => {
          const hex = toneHex(m.state.tone);
          return (
            <Box
              key={m.machine.id}
              as="button"
              textAlign="left"
              bg="carbon.900"
              borderRadius="md"
              px={3}
              py={2.5}
              borderLeft="3px solid"
              borderColor={hex}
              onClick={() => select(m.machine.id)}
              _hover={{ bg: "carbon.800" }}
            >
              <Text fontWeight={500} fontSize="sm">
                {m.machine.name}
              </Text>
              <Text fontSize="xs" color="text.muted">
                {MACHINE_TYPE_LABEL[m.machine.type]} · {STATUS_LABEL[m.machine.status]}
                {m.state.open.length > 0 && (
                  <Text as="span" color={hex}>
                    {" "}
                    · {m.state.open.length} open
                  </Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Grid>

      <MachineDetail
        model={selected}
        channel={channel}
        onChannelChange={(c) => machineId && select(machineId, c)}
        onClose={close}
      />
    </Box>
  );
}
