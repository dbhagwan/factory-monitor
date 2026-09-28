import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  Heading,
  HStack,
  Link,
  Text,
} from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MachineModel } from "../hooks/useFloor";
import { CHANNELS, CHANNEL_META, type Channel } from "../lib/channels";
import { MACHINE_TYPE_LABEL, STATUS_LABEL, toneHex, worstSeverity } from "../lib/health";
import { useTelemetryHistory } from "../lib/telemetryStore";
import { useMachineHistory } from "../hooks/useMachineHistory";
import { AlertList } from "./AlertList";
import { Sparkline } from "./Sparkline";

interface Props {
  model: MachineModel | null;
  channel: Channel;
  onChannelChange: (c: Channel) => void;
  onClose: () => void;
}

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function MachineDetail({ model, channel, onChannelChange, onClose }: Props) {
  const samples = useTelemetryHistory(model?.machine.id);
  const history = useMachineHistory(model?.machine.id);
  const meta = CHANNEL_META[channel];
  const machine = model?.machine;
  const alerts = model ? [...model.state.open, ...model.state.acked] : [];
  const channelAlerts = alerts.filter((a) => a.channel === channel);
  const stroke = worstSeverity(channelAlerts.filter((a) => !a.acknowledged));
  const lineColor = stroke ? toneHex(stroke) : "#5B9CFF";
  const latest = samples[samples.length - 1];
  const value = latest ? latest[meta.field] : machine?.telemetry[meta.field];

  return (
    <Drawer isOpen={!!model} placement="right" size="md" onClose={onClose}>
      <DrawerOverlay bg="blackAlpha.600" />
      <DrawerContent borderLeft="1px solid" borderColor="carbon.700">
        <DrawerCloseButton top={4} />
        {machine && model && (
          <>
            <DrawerHeader pb={2}>
              <HStack spacing={2} mb={1}>
                <Box w="10px" h="10px" borderRadius="sm" bg={toneHex(model.state.tone)} />
                <Heading size="md">{machine.name}</Heading>
              </HStack>
              <Text fontSize="sm" color="text.muted" fontWeight={400}>
                {MACHINE_TYPE_LABEL[machine.type]} · {STATUS_LABEL[machine.status]} ·{" "}
                {model.state.open.length} open
              </Text>
            </DrawerHeader>
            <DrawerBody pb={8}>
              <Box bg="carbon.800" borderRadius="lg" p={4} mb={4}>
                <HStack justify="space-between" align="baseline" mb={2}>
                  <Text fontSize="sm" color="text.muted">
                    {meta.label} · live
                  </Text>
                  <HStack align="baseline" spacing={1}>
                    <Text fontSize="2xl" fontWeight={500} color={lineColor}>
                      {value !== undefined ? value.toFixed(1) : "—"}
                    </Text>
                    <Text fontSize="sm" color="text.muted">
                      {meta.unit}
                    </Text>
                  </HStack>
                </HStack>
                <Box h="180px">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={samples} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <XAxis
                        dataKey="t"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={fmtTime}
                        stroke="#3A424B"
                        tick={{ fill: "#82888F", fontSize: 11 }}
                        minTickGap={48}
                      />
                      <YAxis
                        stroke="#3A424B"
                        tick={{ fill: "#82888F", fontSize: 11 }}
                        domain={["auto", "auto"]}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{ background: "#2C333A", border: "none", borderRadius: 6, fontSize: 12 }}
                        labelFormatter={(t) => fmtTime(Number(t))}
                        formatter={(v) => [`${Number(v).toFixed(2)} ${meta.unit}`, meta.label]}
                      />
                      {meta.warnAbove !== undefined && (
                        <ReferenceLine
                          y={meta.warnAbove}
                          stroke={toneHex("warning")}
                          strokeDasharray="4 4"
                          label={{ value: "warn", fill: "#82888F", fontSize: 10, position: "insideTopRight" }}
                        />
                      )}
                      {channelAlerts
                        .filter((a) => a.timestampValid)
                        .map((a) => (
                          <ReferenceLine
                            key={a.id}
                            x={Date.parse(a.timestamp)}
                            stroke={toneHex(a.severity)}
                            strokeWidth={1.5}
                            strokeDasharray={a.acknowledged ? "3 3" : undefined}
                            label={{
                              value: a.acknowledged ? "in progress" : "alert",
                              fill: toneHex(a.severity),
                              fontSize: 10,
                              position: "insideTopLeft",
                            }}
                          />
                        ))}
                      <Line
                        type="monotone"
                        dataKey={meta.field}
                        stroke={lineColor}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Text fontSize="xs" color="text.muted" mt={2}>
                  {history.isLoading
                    ? "Loading the last hour…"
                    : history.isError
                    ? "History unavailable; showing live readings only."
                    : `Last 60 min · ${samples.length} readings · live every 3 s. Vertical lines mark when an alert was raised.`}
                </Text>
              </Box>

              <Grid templateColumns="repeat(4, 1fr)" gap={2} mb={5}>
                {CHANNELS.map((c) => {
                  const m = CHANNEL_META[c];
                  const v = latest ? latest[m.field] : machine.telemetry[m.field];
                  const openHere = alerts.filter((a) => a.channel === c && !a.acknowledged);
                  const ackedHere = alerts.filter((a) => a.channel === c && a.acknowledged);
                  const sev = worstSeverity(openHere) ?? worstSeverity(ackedHere);
                  const faultHex = sev ? toneHex(sev) : null;
                  const active = c === channel;
                  return (
                    <Box
                      key={c}
                      as="button"
                      textAlign="left"
                      bg={active ? "carbon.700" : "carbon.800"}
                      borderRadius="md"
                      p={2.5}
                      minW={0}
                      border="1px solid"
                      borderColor={active ? "brand.400" : "transparent"}
                      onClick={() => onChannelChange(c)}
                      _hover={{ bg: "carbon.700" }}
                      aria-pressed={active}
                      title={sev ? `${openHere.length} open, ${ackedHere.length} in progress` : "No problems"}
                    >
                      <HStack spacing={1.5} mb={0.5}>
                        <Box w="6px" h="6px" borderRadius="full" bg={faultHex ?? "carbon.600"} flexShrink={0} />
                        <Text fontSize="xs" color="text.muted" noOfLines={1}>
                          {m.label}
                        </Text>
                      </HStack>
                      <Text fontWeight={500} color={faultHex ?? "ink"} whiteSpace="nowrap">
                        {v.toFixed(1)}{" "}
                        <Text as="span" fontSize="xs" color="text.muted">
                          {m.unit}
                        </Text>
                      </Text>
                      <Sparkline samples={samples} field={m.field} color={faultHex ?? "#82888F"} width={84} height={22} />
                    </Box>
                  );
                })}
              </Grid>

              <Heading size="sm" mb={2}>
                {meta.label} problems
              </Heading>
              <AlertList
                alerts={channelAlerts}
                compact
                emptyTitle={`No problems on ${meta.label.toLowerCase()}`}
                emptyBody="Readings on this subsystem are within limits."
              />

              <Box mt={5} bg="brand.900" borderRadius="lg" p={4}>
                <Text fontSize="xs" color="brand.200" mb={1}>
                  Runbook
                </Text>
                <Link
                  href={meta.runbook.url}
                  isExternal
                  fontWeight={500}
                  color="ink"
                  display="inline-flex"
                  alignItems="center"
                  gap={2}
                  _hover={{ color: "brand.300" }}
                >
                  {meta.runbook.title}
                  <ExternalLink size={14} />
                </Link>
              </Box>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
