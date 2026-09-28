import { Box, HStack, Skeleton, Text } from "@chakra-ui/react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MachineModel, ZoneModel } from "../hooks/useFloor";
import {
  AISLES,
  BUILDING,
  COLUMNS,
  DESKS,
  DOCK_DOORS,
  PLAN_H,
  PLAN_W,
  QC_BENCH,
  RACKS,
  ROOMS,
  ZONES,
  bounds,
  slotFor,
} from "../lib/floorPlan";
import { HEALTH_LABEL, HEALTH_TONE, STATUS_LABEL, toneHex } from "../lib/health";
import { OfflineBadge } from "./OfflineBadge";

const INK = "#F4F6F7";

function ownerOf(m: MachineModel): string {
  const names = Array.from(new Set(m.state.acked.map((a) => a.acknowledgedBy).filter(Boolean)));
  return names.length ? names.join(", ") : "unassigned";
}
const MUTED = "#82888F";
const LINE = "#2C333A";
const FLOOR = "#14181B";
const ROOM = "#171B1F";
const SAFETY = "#F5B301";

const FULL_VIEW = `0 0 ${PLAN_W} ${PLAN_H}`;

function zoneViewBox(zoneId: string) {
  const z = ZONES[zoneId];
  if (!z) return FULL_VIEW;
  const b = bounds(z.polygon);
  const pad = 24;
  // keep the plan's aspect ratio so the zoom does not distort
  const aspect = PLAN_W / PLAN_H;
  let w = b.w + pad * 2;
  let h = b.h + pad * 2;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
}

interface Props {
  zones: ZoneModel[];
  isLoading?: boolean;
  offline: boolean;
  /** Zone to zoom into; when the zoom finishes, onZoomed fires. */
  zoomTo?: string | null;
  /** Zone we are returning from; the map starts zoomed there and pulls out. */
  returnFrom?: string | null;
  /** Machine to pick out (e.g. while hovering its alert in the rail). */
  highlightMachine?: string;
  onZoomed?: () => void;
  onZoneClick: (zoneId: string) => void;
  onMachineClick: (zoneId: string, machineId: string) => void;
}

export function FloorMap({
  zones,
  isLoading,
  offline,
  zoomTo,
  returnFrom,
  highlightMachine,
  onZoomed,
  onZoneClick,
  onMachineClick,
}: Props) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<MachineModel | null>(null);
  const initialView = useMemo(() => (returnFrom ? zoneViewBox(returnFrom) : FULL_VIEW), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera: animate the SVG viewBox between the whole plan and one zone.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const from = el.getAttribute("viewBox") ?? FULL_VIEW;
    const to = zoomTo ? zoneViewBox(zoomTo) : FULL_VIEW;
    if (from === to) {
      if (zoomTo) onZoomed?.();
      return;
    }
    if (reduce) {
      el.setAttribute("viewBox", to);
      if (zoomTo) onZoomed?.();
      return;
    }
    const controls = animate(from, to, {
      duration: zoomTo ? 0.6 : 0.5,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => el.setAttribute("viewBox", v),
      onComplete: () => zoomTo && onZoomed?.(),
    });
    return () => controls.stop();
  }, [zoomTo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Skeleton w="full" pt="63%" borderRadius="lg" />;

  return (
    <Box position="relative" w="full" h="full">
      <svg ref={svgRef} viewBox={initialView} width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style={{ display: "block" }}>
        <defs>
          <pattern id="concrete" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1F24" strokeWidth="1" />
          </pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#4A525B" strokeWidth="2" />
          </pattern>
          <pattern id="crosswalk" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="5" height="10" fill={SAFETY} fillOpacity={0.18} />
          </pattern>
          <pattern id="rack" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="4" x2="8" y2="4" stroke="#3A424B" strokeWidth="1" />
          </pattern>
        </defs>

        {/* building shell */}
        <polygon points={BUILDING.map((p) => p.join(",")).join(" ")} fill={FLOOR} stroke="#3A424B" strokeWidth={6} />
        <polygon points={BUILDING.map((p) => p.join(",")).join(" ")} fill="url(#concrete)" />

        {/* aisles */}
        {AISLES.map((a, i) => (
          <g key={i}>
            <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="#1A1F24" />
            <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="none" stroke={SAFETY} strokeOpacity={0.35} strokeWidth={1.5} />
            {a.w > a.h ? (
              <line x1={a.x} y1={a.y + a.h / 2} x2={a.x + a.w} y2={a.y + a.h / 2} stroke={SAFETY} strokeOpacity={0.25} strokeDasharray="14 10" />
            ) : (
              <line x1={a.x + a.w / 2} y1={a.y} x2={a.x + a.w / 2} y2={a.y + a.h} stroke={SAFETY} strokeOpacity={0.25} strokeDasharray="14 10" />
            )}
          </g>
        ))}
        <rect x={520} y={400} width={52} height={48} fill="url(#crosswalk)" />
        <text x={80} y={430} fill={MUTED} fontSize={11}>Main aisle · forklift traffic</text>

        {/* rooms */}
        {ROOMS.map((r) => (
          <g key={r.id}>
            <polygon points={r.polygon.map((p) => p.join(",")).join(" ")} fill={ROOM} stroke={LINE} strokeWidth={1.5} />
            <text x={r.label[0]} y={r.label[1]} fill={MUTED} fontSize={12} fontWeight={500}>{r.name}</text>
          </g>
        ))}
        {DESKS.map((d, i) => (
          <g key={i}>
            <rect x={d.x} y={d.y} width={40} height={18} rx={2} fill="#22282E" stroke={LINE} />
            <circle cx={d.x + 20} cy={d.y + 27} r={5} fill="none" stroke={LINE} />
          </g>
        ))}
        <rect x={QC_BENCH.x} y={QC_BENCH.y} width={QC_BENCH.w} height={QC_BENCH.h} rx={2} fill="#22282E" stroke={LINE} />
        <text x={QC_BENCH.x + 8} y={QC_BENCH.y + 19} fill={MUTED} fontSize={10}>QC inspection bench</text>
        {RACKS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#rack)" stroke={LINE} />
        ))}
        {/* maintenance strip contents */}
        {[720, 772, 824, 876].map((x) => (
          <rect key={x} x={x} y={48} width={40} height={14} rx={2} fill="#22282E" stroke={LINE} />
        ))}

        {/* columns */}
        {COLUMNS.map(([x, y], i) => (
          <rect key={i} x={x - 4} y={y - 4} width={8} height={8} fill="#3A424B" />
        ))}

        {/* loading dock */}
        <rect x={40} y={700} width={460} height={60} fill="#101316" />
        {DOCK_DOORS.map((d, i) => (
          <g key={i}>
            <rect x={d.x} y={694} width={d.w} height={12} fill="#0F1214" stroke={SAFETY} strokeOpacity={0.5} strokeDasharray="4 3" />
            <rect x={d.x + 8} y={712} width={d.w - 16} height={40} rx={3} fill="#1C2126" stroke={LINE} />
            <rect x={d.x + 8} y={712} width={12} height={40} rx={3} fill="#22282E" stroke={LINE} />
          </g>
        ))}
        <text x={56} y={740} fill={MUTED} fontSize={11}>Loading dock</text>


        {/* production zones */}
        {zones.map((z, zi) => {
          const plan = ZONES[z.zone.id];
          if (!plan) return null;
          const healthHex = toneHex(HEALTH_TONE[z.health]);
          const zoneHasHighlight = !!highlightMachine && z.machines.some((m) => m.machine.id === highlightMachine);
          return (
            <motion.g
              key={z.zone.id}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: zi * 0.08, duration: 0.5 }}
              style={{ cursor: "pointer" }}
              onClick={() => onZoneClick(z.zone.id)}
              role="link"
              aria-label={`${z.zone.name}, ${HEALTH_LABEL[z.health]}, ${z.openAlerts.length} open problems`}
            >
              <polygon
                points={plan.polygon.map((p) => p.join(",")).join(" ")}
                fill={ROOM}
                stroke={zoneHasHighlight ? "#5B9CFF" : healthHex}
                strokeOpacity={zoneHasHighlight ? 1 : z.health === "healthy" ? 0.4 : 0.95}
                strokeWidth={zoneHasHighlight ? 2 : z.health === "healthy" ? 1.5 : 2}
                strokeLinejoin="round"
                style={{ transition: "stroke 150ms" }}
              />
              <text x={plan.label[0]} y={plan.label[1]} fill={INK} fontSize={16} fontWeight={500}>
                {z.zone.name}
              </text>
              <text x={plan.label[0]} y={plan.label[1] + 17} fill={MUTED} fontSize={11}>
                {z.machines.length} machines · {HEALTH_LABEL[z.health]}
              </text>

              <g transform={`translate(${plan.counter[0]}, ${plan.counter[1]})`}>
                {z.openAlerts.length === 0 ? (
                  <circle cx={-8} cy={-4} r={5} fill={toneHex("healthy")} />
                ) : (
                  <>
                    <rect x={-40} y={-17} width={40} height={24} rx={12} fill={toneHex(z.worst ?? "info")} />
                    <text x={-20} y={0} fill="#0F1214" fontSize={13} fontWeight={600} textAnchor="middle">
                      {z.openAlerts.length}
                    </text>
                  </>
                )}
              </g>

              {z.machines.map((m, mi) => {
                const s = slotFor(z.zone.id, m.machine.id, mi);
                const hex = toneHex(m.state.tone);
                const isIdle = m.state.tone === "idle" || m.state.tone === "maintenance";
                const pulse = m.state.tone === "critical" && !m.state.hollow && !reduce;
                const thin = s.h < 50;
                const narrow = s.w < 90;
                const t = m.machine.telemetry;
                const isHighlighted = highlightMachine === m.machine.id;
                const dimmed = !!highlightMachine && !isHighlighted;
                const statusText =
                  m.state.open.length > 0
                    ? `${m.state.open.length} open`
                    : m.state.hollow
                    ? `In progress · ${ownerOf(m)}`
                    : STATUS_LABEL[m.machine.status];
                return (
                  <motion.g
                    key={m.machine.id}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + zi * 0.08 + mi * 0.05, duration: 0.35 }}
                    onMouseEnter={() => setHover(m)}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMachineClick(z.zone.id, m.machine.id);
                    }}
                  >
                   <g opacity={dimmed ? 0.4 : 1} style={{ transition: "opacity 150ms" }}>
                    {isHighlighted && (
                      <rect x={s.x - 5} y={s.y - 5} width={s.w + 10} height={s.h + 10} rx={8} fill="none" stroke="#5B9CFF" strokeOpacity={0.35} strokeWidth={8} data-highlight="machine" />
                    )}
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      rx={5}
                      fill={m.state.hollow ? `${hex}22` : isIdle ? "url(#hatch)" : `${hex}33`}
                      stroke={isHighlighted ? "#5B9CFF" : hex}
                      strokeWidth={isHighlighted ? 2 : m.state.hollow ? 1.5 : 1}
                      strokeDasharray={isIdle && !isHighlighted ? "4 3" : undefined}
                    />
                    {pulse && (
                      <motion.rect
                        x={s.x}
                        y={s.y}
                        width={s.w}
                        height={s.h}
                        rx={5}
                        fill="none"
                        stroke={hex}
                        strokeWidth={2}
                        animate={{ opacity: [0.9, 0.1, 0.9] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    {narrow ? (
                      <text
                        transform={`translate(${s.x + s.w / 2 + 4}, ${s.y + s.h / 2}) rotate(-90)`}
                        fill={INK}
                        fontSize={11}
                        fontWeight={500}
                        textAnchor="middle"
                      >
                        {m.machine.name}
                      </text>
                    ) : thin ? (
                      <>
                        <rect x={s.x + 10} y={s.y + s.h / 2 - 4} width={8} height={8} rx={2} fill={hex} />
                        <text x={s.x + 24} y={s.y + s.h / 2 + 4} fill={INK} fontSize={11} fontWeight={500}>
                          {m.machine.name}
                        </text>
                        <text x={s.x + s.w - 10} y={s.y + s.h / 2 + 4} fill={hex} fontSize={10} textAnchor="end">
                          {statusText} · {t.throughput} u/h
                        </text>
                      </>
                    ) : (
                      <>
                        <rect x={s.x + 10} y={s.y + 12} width={8} height={8} rx={2} fill={hex} />
                        <text x={s.x + 24} y={s.y + 20} fill={INK} fontSize={12} fontWeight={500}>
                          {m.machine.name}
                        </text>
                        <text x={s.x + 10} y={s.y + 38} fill={MUTED} fontSize={10}>
                          {t.temperature.toFixed(0)}°C · {t.throughput} u/h · {t.powerDraw.toFixed(1)} kW
                        </text>
                        <text x={s.x + 10} y={s.y + s.h - 10} fill={hex} fontSize={10}>
                          {statusText}
                        </text>
                      </>
                    )}
                    {offline && <OfflineBadge x={s.x + s.w - 24} y={s.y - 8} size={14} />}
                   </g>
                  </motion.g>
                );
              })}
            </motion.g>
          );
        })}
      </svg>

      {hover && (
        <Box position="absolute" top={3} right={3} bg="carbon.700" borderRadius="md" px={3} py={2} fontSize="sm" pointerEvents="none" maxW="280px" boxShadow="lg">
          <HStack spacing={2}>
            <Box w="8px" h="8px" borderRadius="sm" bg={toneHex(hover.state.tone)} />
            <Text fontWeight={500}>{hover.machine.name}</Text>
          </HStack>
          <Text color="text.muted" fontSize="xs">
            {STATUS_LABEL[hover.machine.status]} · {hover.machine.telemetry.temperature.toFixed(0)}°C · {hover.machine.telemetry.throughput} units/h
          </Text>
          {hover.state.open.slice(0, 2).map((a) => (
            <Text key={a.id} fontSize="xs" color={toneHex(a.severity)} mt={1} noOfLines={1}>
              {a.message}
            </Text>
          ))}
          {hover.state.acked.map((a) => (
            <Text key={a.id} fontSize="xs" color="text.muted" mt={1} noOfLines={1}>
              In progress · {a.acknowledgedBy ?? "unassigned"} · {a.message}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
