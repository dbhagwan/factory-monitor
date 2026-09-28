import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Container,
  Flex,
  Heading,
  HStack,
  Select,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { AlertList } from "../components/AlertList";
import { selectAlerts, useAlertsFeed, type AlertFilters } from "../hooks/useAlertsFeed";
import { useZones } from "../hooks/useZones";
import { SEVERITY_LABEL, toneHex, type Severity } from "../lib/health";

const SEVERITIES: Severity[] = ["critical", "warning", "info"];

export function Alerts() {
  const { alerts, isLoading, isError } = useAlertsFeed();
  const { data: zones } = useZones();
  const [filters, setFilters] = useState<AlertFilters>({
    severity: "all",
    zone: "all",
    includeAcknowledged: false,
  });

  const visible = useMemo(() => selectAlerts(alerts, filters), [alerts, filters]);
  const open = alerts.filter((a) => !a.acknowledged);
  const counts = SEVERITIES.map((s) => [s, open.filter((a) => a.severity === s).length] as const);
  const filtered = filters.severity !== "all" || filters.zone !== "all";

  return (
    <Container maxW="container.lg" py={6}>
      <Flex justify="space-between" align="baseline" mb={5} wrap="wrap" gap={3}>
        <Box>
          <Heading size="lg">Problems</Heading>
          <HStack spacing={4} mt={1} fontSize="sm" color="text.muted">
            <Text>{open.length} open</Text>
            {counts.map(([s, n]) => (
              <HStack key={s} spacing={1.5}>
                <Box w="6px" h="6px" borderRadius="full" bg={toneHex(s)} />
                <Text>
                  {n} {SEVERITY_LABEL[s].toLowerCase()}
                </Text>
              </HStack>
            ))}
          </HStack>
        </Box>
      </Flex>

      <Flex gap={3} mb={4} wrap="wrap" align="center">
        <ButtonGroup size="sm" isAttached variant="outline" colorScheme="gray">
          {(["all", ...SEVERITIES] as const).map((s) => (
            <Button
              key={s}
              onClick={() => setFilters((f) => ({ ...f, severity: s }))}
              bg={filters.severity === s ? "carbon.700" : undefined}
              color={filters.severity === s ? "ink" : "text.muted"}
            >
              {s === "all" ? "All" : SEVERITY_LABEL[s]}
            </Button>
          ))}
        </ButtonGroup>
        <Select
          size="sm"
          w="auto"
          minW="180px"
          value={filters.zone}
          onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))}
          bg="carbon.900"
          borderColor="carbon.700"
        >
          <option value="all">All zones</option>
          {zones?.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Select>
        <Checkbox
          size="sm"
          colorScheme="brand"
          isChecked={filters.includeAcknowledged}
          onChange={(e) =>
            setFilters((f) => ({ ...f, includeAcknowledged: e.target.checked }))
          }
        >
          Show acknowledged
        </Checkbox>
        <Text fontSize="sm" color="text.muted" ml="auto">
          {visible.length} shown
        </Text>
      </Flex>

      {isError ? (
        <Text color="critical.500">Could not load alerts. Retrying automatically.</Text>
      ) : (
        <AlertList
          alerts={visible}
          isLoading={isLoading}
          emptyTitle={filtered ? "No alerts match these filters" : undefined}
          emptyBody={filtered ? "Clear a filter to see more." : undefined}
        />
      )}
    </Container>
  );
}
