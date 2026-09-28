import { Box, Grid, HStack, IconButton, Text } from "@chakra-ui/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ZoneModel } from "../hooks/useFloor";
import { SEVERITY_LABEL, toneHex, type Severity } from "../lib/health";
import { alertsPerHour, countByChannel, countByZone, failureRate, meanTimeToAcknowledge, topMachines } from "../lib/kpis";
import type { NormalizedAlert } from "../lib/normalize";

/**
 * KPI band. Sits under the plan without replacing it. Status colours carry
 * severity; a validated categorical set (blue, violet, magenta, aqua) carries
 * subsystem identity (blue, orange, aqua, violet), and every chart has a legend or direct labels so nothing
 * is colour-alone.
 */
const SURFACE = "#171B1F";
const CATEGORICAL = ["#3987e5", "#d95926", "#199e70", "#9085e9"]; // validated adjacent-pair CVD safe on carbon.900
const HOURS = 12;
const SEVERITIES: Severity[] = ["critical", "warning", "info"];

const tooltipStyle = { background: "#2C333A", border: "none", borderRadius: 6, fontSize: 12, padding: "6px 8px" };
const fmtHour = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit" });

interface Props {
  alerts: NormalizedAlert[];
  zones: ZoneModel[];
  scopeLabel: string;
  /** Hide the per-zone comparison when already scoped to one zone. */
  compareZones?: boolean;
  /** Full-screen layout with larger charts. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

function Tile({ title, stat, big, children }: { title: string; stat?: string; big?: boolean; children: React.ReactNode }) {
  return (
    <Box bg="carbon.900" borderRadius="lg" px={big ? 5 : 3} pt={big ? 4 : 2} pb={big ? 3 : 1} minW={0} minH={0} display="flex" flexDirection="column">
      <HStack justify="space-between" align="baseline" mb={big ? 3 : 1} flexShrink={0}>
        <Text fontSize={big ? "md" : "xs"} color={big ? "ink" : "text.muted"} fontWeight={big ? 500 : 400} noOfLines={1}>{title}</Text>
        {stat && <Text fontSize={big ? "md" : "sm"} fontWeight={500} whiteSpace="nowrap" color="text.muted">{stat}</Text>}
      </HStack>
      <Box flex={1} minH={0}>{children}</Box>
    </Box>
  );
}

function Legend({ items, big }: { items: Array<{ label: string; color: string; value?: number; hollow?: boolean }>; big?: boolean }) {
  return (
    <HStack spacing={3} fontSize={big ? "xs" : "10px"} color="text.muted" wrap="wrap" rowGap={0}>
      {items.map((i) => (
        <HStack key={i.label} spacing={1}>
          <Box w="7px" h="7px" borderRadius="2px" bg={i.hollow ? "transparent" : i.color} border="1.5px solid" borderColor={i.color} />
          <Text>{i.label}{i.value !== undefined ? ` ${i.value}` : ""}</Text>
        </HStack>
      ))}
    </HStack>
  );
}

export function Insights({ alerts, zones, scopeLabel, compareZones = true, expanded = false, onToggleExpand }: Props) {
  const big = expanded;
  const tick = { fill: "#82888F", fontSize: big ? 12 : 10 };
  const perHour = useMemo(() => alertsPerHour(alerts, HOURS), [alerts]);
  const byChannel = useMemo(() => countByChannel(alerts), [alerts]);
  const byZone = useMemo(() => countByZone(alerts, zones.map((z) => ({ id: z.zone.id, name: z.zone.name }))), [alerts, zones]);
  const top = useMemo(() => topMachines(alerts, 5), [alerts]);
  const rate = failureRate(alerts, HOURS);
  const mtta = meanTimeToAcknowledge(alerts);
  const machines = zones.flatMap((z) => z.machines);
  const availability = machines.length ? Math.round((machines.filter((m) => m.machine.status === "running").length / machines.length) * 100) : 0;
  const total = alerts.length;

  return (
    <Box display="flex" flexDirection="column" h="full" minH={0}>
      <HStack spacing={big ? 10 : 6} mb={big ? 4 : 2} fontSize={big ? "md" : "sm"} flexShrink={0}>
        <Text fontWeight={500} fontSize={big ? "xl" : undefined}>Insights · {scopeLabel}</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500} fontSize={big ? "xl" : undefined}>{rate.toFixed(1)}</Text> failures / h, last {HOURS} h</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500} fontSize={big ? "xl" : undefined}>{mtta === null ? "—" : `${mtta < 1 ? "<1" : Math.round(mtta)} min`}</Text> mean time to acknowledge</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500} fontSize={big ? "xl" : undefined}>{availability}%</Text> machines running</Text>
        {onToggleExpand && (
          <IconButton
            aria-label={expanded ? "Collapse insights" : "Expand insights to full screen"}
            title={expanded ? "Collapse (Esc)" : "Full screen"}
            icon={expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            size="xs"
            variant="ghost"
            colorScheme="gray"
            ml="auto"
            onClick={onToggleExpand}
          />
        )}
      </HStack>
      <Grid
        templateColumns={big ? (compareZones ? "1fr 1fr" : "1fr 1fr 1fr") : compareZones ? "1.4fr 1fr 1fr 1fr" : "1.4fr 1fr 1fr"}
        templateRows={big && compareZones ? "1fr 1fr" : "1fr"}
        gap={big ? 4 : 3}
        flex={1}
        minH={0}
      >
        <Tile title={`Alerts raised per hour · last ${HOURS} h`} stat={`${total} total`} big={big}>
          <Box h={big ? "calc(100% - 22px)" : "calc(100% - 16px)"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perHour} margin={{ top: 4, right: 4, bottom: 0, left: big ? -16 : -24 }} barCategoryGap={big ? 6 : 3}>
                <XAxis dataKey="t" tickFormatter={fmtHour} tick={tick} stroke="#2C333A" minTickGap={24} />
                <YAxis allowDecimals={false} tick={tick} stroke="#2C333A" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `${fmtHour(Number(t))}:00`} cursor={{ fill: "#ffffff0a" }} />
                {SEVERITIES.map((s) => (
                  <Bar key={s} dataKey={s} name={SEVERITY_LABEL[s]} stackId="a" fill={toneHex(s)} stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Legend items={SEVERITIES.map((s) => ({ label: SEVERITY_LABEL[s], color: toneHex(s) }))} big={big} />
        </Tile>

        <Tile title="By subsystem" stat={big ? `${total} alerts` : undefined} big={big}>
          <HStack h="full" spacing={big ? 8 : 2} align="center" justify={big ? "center" : undefined}>
            <Box w={big ? "220px" : "84px"} h={big ? "220px" : "84px"} flexShrink={0}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byChannel} dataKey="value" nameKey="label" innerRadius={big ? 64 : 24} outerRadius={big ? 104 : 40} paddingAngle={2} stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
                    {byChannel.map((_, i) => (
                      <Cell key={i} fill={CATEGORICAL[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box flex={big ? "0 0 220px" : 1} minW={0}>
              {byChannel.map((c, i) => (
                <HStack key={c.channel} spacing={2} fontSize={big ? "sm" : "11px"} justify="space-between" py={big ? 1 : 0}>
                  <HStack spacing={1.5} minW={0}>
                    <Box w={big ? "10px" : "7px"} h={big ? "10px" : "7px"} borderRadius="2px" bg={CATEGORICAL[i]} flexShrink={0} />
                    <Text color="text.muted" whiteSpace="nowrap">{c.label}</Text>
                  </HStack>
                  <Text fontWeight={500}>{total ? Math.round((c.value / total) * 100) : 0}%{big ? ` · ${c.value}` : ""}</Text>
                </HStack>
              ))}
            </Box>
          </HStack>
        </Tile>

        {compareZones && (
        <Tile title="By zone" big={big}>
          <Box h={big ? "calc(100% - 22px)" : "calc(100% - 16px)"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byZone} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={big ? 10 : 4}>
                <XAxis type="number" allowDecimals={false} tick={tick} stroke="#2C333A" hide={!big} />
                <YAxis type="category" dataKey="zone" width={big ? 150 : 78} tick={tick} stroke="#2C333A" tickFormatter={(v: string) => (big ? v : v.split(" ")[0])} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff0a" }} />
                <Bar dataKey="open" name="Open" stackId="z" maxBarSize={big ? 28 : 18} fill={CATEGORICAL[0]} stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
                <Bar dataKey="inProgress" name="In progress" stackId="z" maxBarSize={big ? 28 : 18} fill="#3A424B" stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Legend items={[{ label: "Open", color: CATEGORICAL[0] }, { label: "In progress", color: "#82888F" }]} big={big} />
        </Tile>
        )}

        <Tile title="Machines with most alerts" big={big}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap={big ? 10 : 4}>
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="machine" width={big ? 150 : 92} tick={tick} stroke="#2C333A" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff0a" }} />
              <Bar dataKey="value" name="Alerts" maxBarSize={big ? 28 : 18} isAnimationActive={false} label={{ position: "right", fill: "#F4F6F7", fontSize: big ? 12 : 10 }}>
                {top.map((m, i) => (
                  <Cell key={i} fill={toneHex(m.worst)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Tile>
      </Grid>
    </Box>
  );
}
