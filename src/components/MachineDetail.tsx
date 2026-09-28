import {
  Box,
  Button,
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
import { ExternalLink, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const HISTORY_SHORT = 60;
const HISTORY_LONG = 360;
const MIN_SPAN_MS = 60_000;
/** Following live shows a rolling window this long; swipe back to see more. */
const LIVE_SPAN_MS = 15 * 60_000;

export function MachineDetail({ model, channel, onChannelChange, onClose }: Props) {
  const samples = useTelemetryHistory(model?.machine.id);
  const [historyMinutes, setHistoryMinutes] = useState(HISTORY_SHORT);
  const history = useMachineHistory(model?.machine.id, historyMinutes);

  // Time window over the samples. null = follow live and show everything loaded.
  const [view, setView] = useState<{ start: number; end: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  // Callback ref: the chart lives inside a portal, so bind gestures when it mounts.
  const [chartEl, setChartEl] = useState<HTMLDivElement | null>(null);
  const overviewRef = useRef<SVGSVGElement>(null);
  const first = samples[0]?.t;
  const last = samples[samples.length - 1]?.t;
  const boundsRef = useRef({ first, last });
  boundsRef.current = { first, last };
  const historyMinutesRef = useRef(historyMinutes);
  historyMinutesRef.current = historyMinutes;

  useEffect(() => {
    setView(null);
    setHistoryMinutes(HISTORY_SHORT);
  }, [model?.machine.id]);

  // Gesture deltas are accumulated and applied once per animation frame, so a
  // trackpad firing at 120 Hz never re-renders the chart faster than the screen.
  const pending = useRef({ dx: 0, zoom: 0, anchor: 0.5 });
  const raf = useRef<number | null>(null);
  const flush = () => {
    raf.current = null;
    const { first: f, last: l } = boundsRef.current;
    const { dx, zoom, anchor } = pending.current;
    pending.current = { dx: 0, zoom: 0, anchor };
    if (f === undefined || l === undefined || l <= f) return;
    const width = chartEl?.clientWidth || 1;
    const cur = viewRef.current ?? { start: Math.max(f, l - LIVE_SPAN_MS), end: l };
    let span = cur.end - cur.start;
    let start = cur.start;
    if (zoom !== 0) {
      const factor = Math.exp(zoom * 0.01);
      const pivot = start + anchor * span;
      span = Math.min(l - f, Math.max(MIN_SPAN_MS, span * factor));
      start = pivot - anchor * span;
    }
    start += (dx / width) * span;
    if (start < f) start = f;
    if (start + span > l) start = l - span;
    if (start <= f && historyMinutesRef.current === HISTORY_SHORT) setHistoryMinutes(HISTORY_LONG);
    viewRef.current = { start, end: start + span };
    setView(viewRef.current);
  };
  const queue = (dx: number, zoom: number, anchor?: number) => {
    pending.current.dx += dx;
    pending.current.zoom += zoom;
    if (anchor !== undefined) pending.current.anchor = anchor;
    if (raf.current === null) raf.current = requestAnimationFrame(flush);
  };
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  // Two-finger swipe scrubs, pinch zooms. Attached natively so preventDefault
  // works (React's onWheel is passive) and macOS does not treat the swipe as
  // browser back navigation. Vertical scrolling still reaches the drawer.
  useEffect(() => {
    const el = chartEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const pinch = e.ctrlKey;
      if (!horizontal && !pinch && !e.shiftKey) return;
      e.preventDefault();
      const width = el.clientWidth || 1;
      if (pinch) queue(0, e.deltaY, e.offsetX / width);
      else queue(e.shiftKey && !horizontal ? e.deltaY : e.deltaX, 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [chartEl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag on the chart pans; drag on the overview moves the window directly.
  const drag = useRef<{ x: number; mode: "chart" | "overview" } | null>(null);
  const onPointerDown = (mode: "chart" | "overview") => (e: React.PointerEvent<Element>) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, mode };
    if (mode === "overview") jumpOverview(e);
  };
  const onPointerMove = (e: React.PointerEvent<Element>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    drag.current.x = e.clientX;
    if (drag.current.mode === "chart") queue(-dx, 0);
    else jumpOverview(e);
  };
  const onPointerUp = () => { drag.current = null; };
  /** Centre the window on the overview position under the pointer. */
  const jumpOverview = (e: React.PointerEvent<Element>) => {
    const { first: f, last: l } = boundsRef.current;
    const svg = overviewRef.current;
    if (!svg || f === undefined || l === undefined || l <= f) return;
    const rect = svg.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const cur = viewRef.current ?? { start: Math.max(f, l - LIVE_SPAN_MS), end: l };
    const span = cur.end - cur.start;
    let start = f + frac * (l - f) - span / 2;
    start = Math.max(f, Math.min(l - span, start));
    viewRef.current = { start, end: start + span };
    setView(viewRef.current);
  };

  // A window pinned to the live edge slides along as new samples arrive.
  const prevLast = useRef(last);
  useEffect(() => {
    const v = viewRef.current;
    if (v && last !== undefined && prevLast.current !== undefined && v.end >= prevLast.current) {
      const span = v.end - v.start;
      viewRef.current = { start: last - span, end: last };
      setView(viewRef.current);
    }
    prevLast.current = last;
  }, [last]);

  const following = view === null;
  const liveWindow = first !== undefined && last !== undefined ? { start: Math.max(first, last - LIVE_SPAN_MS), end: last } : null;
  const window = view ?? liveWindow;
  const MAX_POINTS = 320;
  const visible = useMemo(() => {
    const pad = 20_000;
    const inWindow = window ? samples.filter((s) => s.t >= window.start - pad && s.t <= window.end + pad) : samples;
    if (inWindow.length <= MAX_POINTS) return inWindow;
    const stride = Math.ceil(inWindow.length / MAX_POINTS);
    return inWindow.filter((_, i) => i % stride === 0 || i === inWindow.length - 1);
  }, [samples, window?.start, window?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  // Overview strip: the whole loaded range, downsampled.
  const overview = useMemo(() => {
    if (samples.length < 2 || first === undefined || last === undefined) return null;
    const stride = Math.max(1, Math.ceil(samples.length / 200));
    const pts = samples.filter((_, i) => i % stride === 0 || i === samples.length - 1);
    const field = CHANNEL_META[channel].field;
    const vals = pts.map((s) => s[field]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const spanV = hi - lo || 1;
    const W = 1000;
    const H = 30;
    const path = pts
      .map((s, i) => `${i === 0 ? "M" : "L"}${(((s.t - first) / (last - first)) * W).toFixed(1)},${(H - 3 - ((s[field] - lo) / spanV) * (H - 6)).toFixed(1)}`)
      .join(" ");
    const win = window ?? { start: first, end: last };
    const x0 = ((win.start - first) / (last - first)) * W;
    const x1 = ((win.end - first) / (last - first)) * W;
    return { path, W, H, x0, x1 };
  }, [samples, window?.start, window?.end, first, last, channel]); // eslint-disable-line react-hooks/exhaustive-deps
  const fmtShort = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtRange = (a: number, b: number) => `${fmtShort(a)} – ${fmtShort(b)}`;
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
                <Box
                  h="180px"
                  ref={setChartEl}
                  sx={{ overscrollBehaviorX: "contain", touchAction: "pan-y", userSelect: "none" }}
                  cursor={drag.current?.mode === "chart" ? "grabbing" : "grab"}
                  onPointerDown={onPointerDown("chart")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visible} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                      <XAxis
                        dataKey="t"
                        type="number"
                        scale="time"
                        domain={window ? [window.start, window.end] : ["dataMin", "dataMax"]}
                        allowDataOverflow
                        tickFormatter={fmtTime}
                        stroke="#3A424B"
                        tick={{ fill: "#82888F", fontSize: 11 }}
                        minTickGap={48}
                      />
                      <YAxis
                        stroke="#3A424B"
                        tick={{ fill: "#82888F", fontSize: 11 }}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => Number(v).toFixed(1)}
                        width={52}
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
                {overview && (
                  <Box mt={1} px={1}>
                    <svg
                      ref={overviewRef}
                      viewBox={`0 0 ${overview.W} ${overview.H}`}
                      preserveAspectRatio="none"
                      width="100%"
                      height={overview.H}
                      style={{ display: "block", cursor: "pointer", touchAction: "none" }}
                      onPointerDown={onPointerDown("overview")}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                      aria-label="Timeline overview. Drag to move the window."
                    >
                      <rect x={0} y={0} width={overview.W} height={overview.H} fill="#22282E" rx={3} />
                      <path d={overview.path} fill="none" stroke="#82888F" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                      <rect x={overview.x0} y={0} width={Math.max(6, overview.x1 - overview.x0)} height={overview.H} fill="#5B9CFF" fillOpacity={0.18} stroke="#5B9CFF" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    </svg>
                  </Box>
                )}
                <HStack justify="space-between" mt={2} spacing={3}>
                  <Text fontSize="xs" color="text.muted">
                    {history.isLoading
                      ? "Loading history…"
                      : history.isError
                      ? "History unavailable; showing live readings only."
                      : view
                      ? `${fmtRange(view.start, view.end)} · ${Math.round((view.end - view.start) / 60_000)} min window · ${historyMinutes / 60} h loaded`
                      : `Live · last ${LIVE_SPAN_MS / 60_000} min of ${historyMinutes / 60} h loaded`}
                    {!history.isLoading && !history.isError && " · drag or swipe sideways to scrub, pinch to zoom."}
                  </Text>
                  {!following && (
                    <Button size="xs" variant="outline" colorScheme="gray" leftIcon={<Radio size={12} />} onClick={() => setView(null)} flexShrink={0}>
                      Live
                    </Button>
                  )}
                </HStack>
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
                      title={sev ? `${openHere.length} open, ${ackedHere.length} in progress` : "No alerts"}
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
                {meta.label} alerts
                {channelAlerts.length > 0 && (
                  <Text as="span" fontSize="xs" color="text.muted" fontWeight={400} ml={2}>
                    {channelAlerts.length} {channelAlerts.length === 1 ? "occurrence" : "occurrences"}, newest first
                  </Text>
                )}
              </Heading>
              <AlertList
                alerts={channelAlerts}
                compact
                exactTime
                emptyTitle={`No alerts on ${meta.label.toLowerCase()}`}
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
