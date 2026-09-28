import { Box, Grid, HStack, Text } from "@chakra-ui/react";
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
const tick = { fill: "#82888F", fontSize: 10 };
const fmtHour = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit" });

interface Props {
  alerts: NormalizedAlert[];
  zones: ZoneModel[];
  scopeLabel: string;
  /** Hide the per-zone comparison when already scoped to one zone. */
  compareZones?: boolean;
}

function Tile({ title, stat, children }: { title: string; stat?: string; children: React.ReactNode }) {
  return (
    <Box bg="carbon.900" borderRadius="lg" px={3} pt={2} pb={1} minW={0} display="flex" flexDirection="column">
      <HStack justify="space-between" align="baseline" mb={1} flexShrink={0}>
        <Text fontSize="xs" color="text.muted" noOfLines={1}>{title}</Text>
        {stat && <Text fontSize="sm" fontWeight={500} whiteSpace="nowrap">{stat}</Text>}
      </HStack>
      <Box flex={1} minH={0}>{children}</Box>
    </Box>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; value?: number; hollow?: boolean }> }) {
  return (
    <HStack spacing={3} fontSize="10px" color="text.muted" wrap="wrap" rowGap={0}>
      {items.map((i) => (
        <HStack key={i.label} spacing={1}>
          <Box w="7px" h="7px" borderRadius="2px" bg={i.hollow ? "transparent" : i.color} border="1.5px solid" borderColor={i.color} />
          <Text>{i.label}{i.value !== undefined ? ` ${i.value}` : ""}</Text>
        </HStack>
      ))}
    </HStack>
  );
}

export function Insights({ alerts, zones, scopeLabel, compareZones = true }: Props) {
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
      <HStack spacing={6} mb={2} fontSize="sm" flexShrink={0}>
        <Text fontWeight={500}>Insights · {scopeLabel}</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500}>{rate.toFixed(1)}</Text> failures / h, last {HOURS} h</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500}>{mtta === null ? "—" : `${mtta < 1 ? "<1" : Math.round(mtta)} min`}</Text> mean time to acknowledge</Text>
        <Text color="text.muted"><Text as="span" color="ink" fontWeight={500}>{availability}%</Text> machines running</Text>
      </HStack>
      <Grid templateColumns={compareZones ? "1.4fr 1fr 1fr 1fr" : "1.4fr 1fr 1fr"} gap={3} flex={1} minH={0}>
        <Tile title={`Alerts raised per hour · last ${HOURS} h`} stat={`${total} total`}>
          <Box h="calc(100% - 16px)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perHour} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap={3}>
                <XAxis dataKey="t" tickFormatter={fmtHour} tick={tick} stroke="#2C333A" minTickGap={24} />
                <YAxis allowDecimals={false} tick={tick} stroke="#2C333A" />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `${fmtHour(Number(t))}:00`} cursor={{ fill: "#ffffff0a" }} />
                {SEVERITIES.map((s) => (
                  <Bar key={s} dataKey={s} name={SEVERITY_LABEL[s]} stackId="a" fill={toneHex(s)} stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Legend items={SEVERITIES.map((s) => ({ label: SEVERITY_LABEL[s], color: toneHex(s) }))} />
        </Tile>

        <Tile title="By subsystem">
          <HStack h="full" spacing={2} align="center">
            <Box w="84px" h="84px" flexShrink={0}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byChannel} dataKey="value" nameKey="label" innerRadius={24} outerRadius={40} paddingAngle={2} stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
                    {byChannel.map((_, i) => (
                      <Cell key={i} fill={CATEGORICAL[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box flex={1} minW={0}>
              {byChannel.map((c, i) => (
                <HStack key={c.channel} spacing={2} fontSize="11px" justify="space-between">
                  <HStack spacing={1.5} minW={0}>
                    <Box w="7px" h="7px" borderRadius="2px" bg={CATEGORICAL[i]} flexShrink={0} />
                    <Text color="text.muted" whiteSpace="nowrap">{c.label}</Text>
                  </HStack>
                  <Text fontWeight={500}>{total ? Math.round((c.value / total) * 100) : 0}%</Text>
                </HStack>
              ))}
            </Box>
          </HStack>
        </Tile>

        {compareZones && (
        <Tile title="By zone">
          <Box h="calc(100% - 16px)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byZone} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={4}>
                <XAxis type="number" allowDecimals={false} tick={tick} stroke="#2C333A" hide />
                <YAxis type="category" dataKey="zone" width={78} tick={tick} stroke="#2C333A" tickFormatter={(v: string) => v.split(" ")[0]} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff0a" }} />
                <Bar dataKey="open" name="Open" stackId="z" fill={CATEGORICAL[0]} stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
                <Bar dataKey="inProgress" name="In progress" stackId="z" fill="#3A424B" stroke={SURFACE} strokeWidth={1} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Legend items={[{ label: "Open", color: CATEGORICAL[0] }, { label: "In progress", color: "#82888F" }]} />
        </Tile>
        )}

        <Tile title="Machines with most alerts">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap={4}>
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="machine" width={92} tick={tick} stroke="#2C333A" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff0a" }} />
              <Bar dataKey="value" name="Alerts" isAnimationActive={false} label={{ position: "right", fill: "#F4F6F7", fontSize: 10 }}>
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
