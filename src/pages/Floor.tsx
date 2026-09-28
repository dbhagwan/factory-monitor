import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Select,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BarChart3, RefreshCw, UserRound, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertList } from "../components/AlertList";
import { FloorMap } from "../components/FloorMap";
import { Insights } from "../components/Insights";
import { IsoScene } from "../components/IsoScene";
import { MachineDetail } from "../components/MachineDetail";
import { selectAlerts, useAlertsFeed, type AlertFilters } from "../hooks/useAlertsFeed";
import { useConnectivity } from "../hooks/useConnectivity";
import { useFloor } from "../hooks/useFloor";
import { CHANNELS, type Channel } from "../lib/channels";
import { HEALTH_LABEL, HEALTH_TONE, SEVERITY_LABEL, STATUS_LABEL, toneHex, type Severity } from "../lib/health";
import type { Range } from "../lib/kpis";
import type { NormalizedAlert } from "../lib/normalize";
import { setOperator, useOperator } from "../lib/telemetryStore";

const SEVERITIES: Severity[] = ["critical", "warning", "info"];

/**
 * The whole product is one screen: the floor (or one zone of it) on the
 * left, the alerts rail on the right, machine detail in a drawer. Zooming
 * into a zone is a camera move on the same map, then the isometric scene
 * takes over in place.
 */
export function Floor() {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { zones, isLoading, isError } = useFloor();
  const { alerts, isFetching, refetch } = useAlertsFeed();
  const { offline, factoryLinkDown } = useConnectivity();
  const operator = useOperator();

  const [hoveredAlert, setHoveredAlert] = useState<NormalizedAlert | null>(null);
  const [pendingZone, setPendingZone] = useState<{ zoneId: string; machine?: string; channel?: Channel } | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({ severity: "all", zone: "all", includeAcknowledged: true });
  const [showInsights, setShowInsights] = useState<boolean>(() => {
    try {
      return localStorage.getItem("fm.insights") === "1";
    } catch {
      return false;
    }
  });
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [insightsRange, setInsightsRange] = useState<Range>("day");
  useEffect(() => {
    if (!insightsExpanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInsightsExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [insightsExpanded]);
  const toggleInsights = () => {
    setShowInsights((v) => {
      try {
        localStorage.setItem("fm.insights", v ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  };
  const returnFrom = (location.state as { from?: string } | null)?.from ?? null;

  const zone = zones.find((z) => z.zone.id === zoneId);
  const machineId = params.get("machine") ?? undefined;
  const channelParam = params.get("channel") as Channel | null;
  const selected = zone?.machines.find((m) => m.machine.id === machineId) ?? null;
  const channel: Channel =
    channelParam && CHANNELS.includes(channelParam) ? channelParam : selected?.state.open[0]?.channel ?? "thermal";

  // Rail scope follows the zone you are looking at, but can be widened.
  const railFilters: AlertFilters = { ...filters, zone: filters.zone === "all" && zoneId ? zoneId : filters.zone };
  const railZone = zoneId && filters.zone === "all" ? zoneId : filters.zone;
  const visible = useMemo(() => selectAlerts(alerts, railFilters), [alerts, railFilters.severity, railFilters.zone, railFilters.includeAcknowledged]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = alerts.filter((a) => !a.acknowledged);
  const machines = zones.flatMap((z) => z.machines);
  const running = machines.filter((m) => m.machine.status === "running").length;
  const notRunning = machines.filter((m) => m.machine.status !== "running");
  const attention = zones.filter((z) => z.health !== "healthy");

  const goToZone = (id: string, machine?: string, c?: Channel) => {
    if (zoneId === id) {
      const next = new URLSearchParams();
      if (machine) next.set("machine", machine);
      if (c) next.set("channel", c);
      setParams(next);
      return;
    }
    setPendingZone({ zoneId: id, machine, channel: c });
  };
  const finishZoom = () => {
    if (!pendingZone) return;
    const q = new URLSearchParams();
    if (pendingZone.machine) q.set("machine", pendingZone.machine);
    if (pendingZone.channel) q.set("channel", pendingZone.channel);
    navigate(`/zones/${pendingZone.zoneId}${q.toString() ? `?${q}` : ""}`);
    setPendingZone(null);
  };
  const backToFloor = () => navigate("/", { state: { from: zoneId } });
  /** The wordmark always lands on the plant overview: insights closed, nothing selected. */
  const goHome = () => {
    setInsightsExpanded(false);
    setShowInsights(false);
    try {
      localStorage.setItem("fm.insights", "0");
    } catch {
      /* storage unavailable */
    }
    navigate("/", { state: { from: zoneId ?? null } });
  };
  const locate = (a: NormalizedAlert) => goToZone(a.zoneId, a.machineId, a.channel);
  const selectMachine = (id: string, c?: Channel) => {
    const next = new URLSearchParams();
    next.set("machine", id);
    if (c) next.set("channel", c);
    setParams(next);
  };

  return (
    <Flex direction="column" h={{ base: "auto", lg: "100vh" }} minH="100vh" bg="carbon.950" overflow={{ lg: "hidden" }}>
      {/* header: one line of facts, no chrome */}
      <Flex as="header" px={{ base: 4, md: 6 }} h="56px" align="center" gap={{ base: 4, md: 8 }} borderBottom="1px solid" borderColor="carbon.700" flexShrink={0} overflowX="auto" whiteSpace="nowrap">
        <HStack as="button" onClick={goHome} spacing={2.5} flexShrink={0} _hover={{ opacity: 0.85 }} title="Back to the plant overview" aria-label="Factory OS, back to the plant overview">
          <Image src="/brand-mark.svg" alt="" w="22px" h="22px" />
          <Text fontWeight={600} letterSpacing="-0.01em">Factory OS</Text>
        </HStack>
        {!isLoading && (
          <HStack spacing={{ base: 4, md: 7 }} fontSize="sm" color="text.muted">
            <Tooltip
              hasArrow
              placement="bottom-start"
              openDelay={150}
              label={
                <Box fontSize="xs" py={1}>
                  <Text fontWeight={500} mb={1}>Machines reporting a Running status</Text>
                  <Text color="#C9CED3">Out of every machine on the floor. Idle and in-maintenance machines count as not running even with no alerts.</Text>
                  {notRunning.length > 0 && (
                    <Box mt={2} pt={2} borderTop="1px solid" borderColor="carbon.600">
                      <Text color="#C9CED3" mb={0.5}>Not running:</Text>
                      {notRunning.map((m) => (
                        <HStack key={m.machine.id} spacing={1.5}>
                          <Box w="6px" h="6px" borderRadius="sm" bg={toneHex(m.state.tone)} flexShrink={0} />
                          <Text>{m.machine.name}</Text>
                          <Text color="#C9CED3">· {STATUS_LABEL[m.machine.status].toLowerCase()}</Text>
                        </HStack>
                      ))}
                    </Box>
                  )}
                </Box>
              }
            >
              <Text cursor="default" tabIndex={0} borderBottom="1px dotted" borderColor="carbon.600">
                <Text as="span" color="ink" fontWeight={500}>{running}</Text> of {machines.length} running
              </Text>
            </Tooltip>
            <HStack spacing={0}>
              <Text
                as="button"
                onClick={() => setFilters((f) => ({ ...f, severity: "all", zone: "all" }))}
                _hover={{ color: "ink" }}
                title="Show every alert in the rail"
              >
                <Text as="span" color="ink" fontWeight={500}>{open.length}</Text> active alerts
              </Text>
              {SEVERITIES.map((s) => {
                const n = open.filter((a) => a.severity === s).length;
                return n ? (
                  <Text
                    key={s}
                    as="button"
                    color={toneHex(s)}
                    onClick={() => setFilters((f) => ({ ...f, severity: s, zone: "all" }))}
                    _hover={{ textDecoration: "underline" }}
                    title={`Show only ${SEVERITY_LABEL[s].toLowerCase()} alerts`}
                  >
                    &nbsp;· {n} {SEVERITY_LABEL[s].toLowerCase()}
                  </Text>
                ) : null;
              })}
            </HStack>
            <Text>
              {attention.length === 0 ? (
                <Text as="span" color={toneHex("healthy")}>All zones healthy</Text>
              ) : (
                <>
                  Attention:{" "}
                  {attention.map((z, i) => (
                    <Text key={z.zone.id} as="span">
                      {i > 0 && ", "}
                      <Text
                        as="button"
                        color={toneHex(HEALTH_TONE[z.health])}
                        onClick={() => goToZone(z.zone.id)}
                        _hover={{ textDecoration: "underline" }}
                        title={`Open ${z.zone.name}`}
                      >
                        {z.zone.name}
                      </Text>
                    </Text>
                  ))}
                </>
              )}
            </Text>
          </HStack>
        )}
        {offline && (
          <HStack spacing={2} ml="auto" color={toneHex("critical")} fontSize="sm" flexShrink={0}>
            <WifiOff size={16} />
            <Text>{factoryLinkDown ? "No connection to the factory network" : "Telemetry feed has gone quiet"}. Machine states may be stale.</Text>
          </HStack>
        )}
        {isError && !offline && (
          <Text color={toneHex("critical")} fontSize="sm">Could not reach the factory API.</Text>
        )}
        <HStack spacing={2} ml={offline || isError ? 4 : "auto"} flexShrink={0} color="text.muted" fontSize="sm">
          <UserRound size={14} />
          <Input
            size="sm"
            variant="unstyled"
            w="140px"
            placeholder="Your name"
            defaultValue={operator}
            onBlur={(e) => setOperator(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            color="ink"
            _placeholder={{ color: "text.muted" }}
            title="Alerts you acknowledge are assigned to this name"
          />
        </HStack>
      </Flex>

      <Grid flex={1} minH={0} p={{ base: 4, md: 5 }} gap={5} templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 400px" }} templateRows={{ base: "auto auto", lg: "minmax(0, 1fr)" }}>
        {insightsExpanded ? (
          <Box gridColumn="1 / -1" minH={{ base: "600px", lg: 0 }} display="flex" flexDirection="column">
            <Insights
              alerts={zoneId ? alerts.filter((a) => a.zoneId === zoneId) : alerts}
              zones={zoneId ? zones.filter((z) => z.zone.id === zoneId) : zones}
              scopeLabel={zone ? zone.zone.name : "all zones"}
              compareZones={!zoneId}
              expanded
              onToggleExpand={() => setInsightsExpanded(false)}
              range={insightsRange}
              onRangeChange={setInsightsRange}
            />
          </Box>
        ) : (
        <>
        {/* stage */}
        <Flex direction="column" minH={0} minW={0}>
          <Flex align="baseline" justify="space-between" mb={3} h="28px" flexShrink={0} minW={0} overflow="hidden" whiteSpace="nowrap">
            {zone ? (
              <HStack spacing={3}>
                <Button size="sm" variant="ghost" colorScheme="gray" leftIcon={<ArrowLeft size={14} />} onClick={backToFloor} px={2}>
                  Floor
                </Button>
                <Heading size="md">{zone.zone.name}</Heading>
                <HStack spacing={1.5} px={2} py={0.5} borderRadius="md" bg={`${toneHex(HEALTH_TONE[zone.health])}22`}>
                  <Box w="6px" h="6px" borderRadius="full" bg={toneHex(HEALTH_TONE[zone.health])} />
                  <Text fontSize="sm" color={toneHex(HEALTH_TONE[zone.health])}>{HEALTH_LABEL[zone.health]}</Text>
                </HStack>
                <Text fontSize="sm" color="text.muted">{zone.machines.length} machines · {zone.openAlerts.length} open</Text>
              </HStack>
            ) : (
              <HStack spacing={3}>
                <Heading size="md">Plant overview</Heading>
                <Text fontSize="sm" color="text.muted" display={{ base: "none", md: "block" }}>Select a zone to inspect its machines</Text>
              </HStack>
            )}
            <Button size="sm" variant={showInsights ? "solid" : "ghost"} colorScheme="gray" bg={showInsights ? "carbon.700" : undefined} leftIcon={<BarChart3 size={14} />} onClick={toggleInsights} flexShrink={0}>
              Insights
            </Button>
          </Flex>
          <Box position="relative" flex={1} minH={{ base: "420px", lg: 0 }} overflow="hidden">
            <AnimatePresence mode="wait" initial={false}>
              {zoneId && zone ? (
                <motion.div key="iso" style={{ position: "absolute", inset: 0 }} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}>
                  <IsoScene zone={zone} selectedMachine={machineId} offline={offline} onSelect={selectMachine} highlightMachine={hoveredAlert?.machineId} />
                </motion.div>
              ) : (
                <motion.div key="map" style={{ position: "absolute", inset: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <FloorMap
                    zones={zones}
                    isLoading={isLoading}
                    offline={offline}
                    zoomTo={pendingZone?.zoneId ?? null}
                    returnFrom={returnFrom}
                    highlightMachine={hoveredAlert?.machineId}
                    onZoomed={finishZoom}
                    onZoneClick={(id) => goToZone(id)}
                    onMachineClick={(z, m) => goToZone(z, m)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
          <AnimatePresence initial={false}>
            {showInsights && (
              <motion.div
                key="insights"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 248, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden", flexShrink: 0, marginTop: 12 }}
              >
                <Box h="248px">
                  <Insights
                    alerts={zoneId ? alerts.filter((a) => a.zoneId === zoneId) : alerts}
                    zones={zoneId ? zones.filter((z) => z.zone.id === zoneId) : zones}
                    scopeLabel={zone ? zone.zone.name : "all zones"}
                    compareZones={!zoneId}
                    onToggleExpand={() => setInsightsExpanded(true)}
                    range={insightsRange}
                    onRangeChange={setInsightsRange}
                  />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Flex>

        {/* alerts rail */}
        <Flex direction="column" minH={0} bg="carbon.900" borderRadius="lg" p={4}>
          <Flex justify="space-between" align="baseline" mb={3} flexShrink={0}>
            <Heading size="md">Alerts</Heading>
            <HStack spacing={2}>
              <Text fontSize="sm" color="text.muted">{visible.filter((a) => !a.acknowledged).length} open</Text>
              <IconButton aria-label="Refresh alerts" icon={<RefreshCw size={14} />} size="xs" variant="ghost" colorScheme="gray" isLoading={isFetching} onClick={() => refetch()} />
            </HStack>
          </Flex>
          <Flex gap={2} mb={3} wrap="wrap" align="center" flexShrink={0}>
            <ButtonGroup size="xs" isAttached variant="outline" colorScheme="gray">
              {(["all", ...SEVERITIES] as const).map((s) => (
                <Button key={s} onClick={() => setFilters((f) => ({ ...f, severity: s }))} bg={filters.severity === s ? "carbon.700" : undefined} color={filters.severity === s ? "ink" : "text.muted"}>
                  {s === "all" ? "All" : SEVERITY_LABEL[s]}
                </Button>
              ))}
            </ButtonGroup>
            <Select size="xs" w="auto" value={railZone} onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))} bg="carbon.800" borderColor="carbon.700" borderRadius="md">
              <option value="all">All zones</option>
              {zones.map((z) => (
                <option key={z.zone.id} value={z.zone.id}>{z.zone.name}</option>
              ))}
            </Select>
          </Flex>
          <Box flex={1} minH={0} overflowY="auto" pr={1} sx={{ scrollbarWidth: "thin" }}>
            <AlertList
              alerts={visible}
              isLoading={isLoading}
              compact
              onLocate={locate}
              onHover={setHoveredAlert}
              emptyTitle={
                filters.severity !== "all"
                  ? "No alerts match"
                  : railZone !== "all"
                  ? `No alerts in ${zones.find((z) => z.zone.id === railZone)?.zone.name ?? "this zone"}`
                  : undefined
              }
              emptyBody={
                filters.severity !== "all"
                  ? "Widen the filters to see more."
                  : railZone !== "all"
                  ? "Every machine here is reporting within limits."
                  : undefined
              }
            />
          </Box>
        </Flex>
        </>
        )}
      </Grid>

      <MachineDetail model={selected} channel={channel} onChannelChange={(c) => machineId && selectMachine(machineId, c)} onClose={() => setParams(new URLSearchParams())} />
    </Flex>
  );
}
