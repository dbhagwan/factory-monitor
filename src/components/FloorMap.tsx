import { Box, HStack, Skeleton, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MachineModel, ZoneModel } from "../hooks/useFloor";
import {
  HEALTH_LABEL,
  HEALTH_TONE,
  MACHINE_TYPE_LABEL,
  STATUS_LABEL,
  toneHex,
} from "../lib/health";

/**
 * Top-down floor map. Pure SVG so it scales with its container and every
 * shape is a real DOM node with hover and click. Layout is a fixed 2×2 grid
 * of zones because the API has no coordinates.
 */
const W = 1000;
const H = 600;
const PAD = 16;
const ZONE_W = (W - PAD * 3) / 2;
const ZONE_H = (H - PAD * 3) / 2;
const CELL_W = 118;
const CELL_H = 74;
const CELL_GAP = 14;

const INK = "#F4F6F7";
const MUTED = "#82888F";
const PANEL = "#171B1F";

interface Props {
  zones: ZoneModel[];
  isLoading?: boolean;
}

export function FloorMap({ zones, isLoading }: Props) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<MachineModel | null>(null);

  if (isLoading) return <Skeleton w="full" pt="60%" borderRadius="lg" />;

  return (
    <Box position="relative" w="full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1C2126" strokeWidth="1" />
          </pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#4A525B" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" rx={12} />

        {zones.map((z, zi) => {
          const col = zi % 2;
          const row = Math.floor(zi / 2);
          const x = PAD + col * (ZONE_W + PAD);
          const y = PAD + row * (ZONE_H + PAD);
          const healthHex = toneHex(HEALTH_TONE[z.health]);
          const perRow = Math.max(1, Math.floor((ZONE_W - 32) / (CELL_W + CELL_GAP)));

          return (
            <motion.g
              key={z.zone.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: zi * 0.08, duration: 0.5, ease: "easeOut" }}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/zones/${z.zone.id}`)}
              role="link"
              aria-label={`${z.zone.name}, ${HEALTH_LABEL[z.health]}, ${z.openAlerts.length} open problems`}
            >
              <rect
                x={x}
                y={y}
                width={ZONE_W}
                height={ZONE_H}
                rx={10}
                fill={PANEL}
                stroke={healthHex}
                strokeOpacity={z.health === "healthy" ? 0.35 : 0.9}
                strokeWidth={z.health === "healthy" ? 1 : 1.5}
              />
              <text x={x + 18} y={y + 30} fill={INK} fontSize={17} fontWeight={500}>
                {z.zone.name}
              </text>
              <text x={x + 18} y={y + 50} fill={MUTED} fontSize={12}>
                {z.machines.length} machines · {HEALTH_LABEL[z.health]}
              </text>

              {/* counter */}
              <g transform={`translate(${x + ZONE_W - 18}, ${y + 30})`}>
                {z.openAlerts.length === 0 ? (
                  <>
                    <circle cx={-8} cy={-4} r={5} fill={toneHex("healthy")} />
                  </>
                ) : (
                  <>
                    <rect
                      x={-44}
                      y={-18}
                      width={44}
                      height={26}
                      rx={13}
                      fill={toneHex(z.worst ?? "info")}
                    />
                    <text
                      x={-22}
                      y={0}
                      fill="#0F1214"
                      fontSize={14}
                      fontWeight={600}
                      textAnchor="middle"
                    >
                      {z.openAlerts.length}
                    </text>
                  </>
                )}
              </g>

              {z.machines.map((m, mi) => {
                const cx = x + 18 + (mi % perRow) * (CELL_W + CELL_GAP);
                const cy = y + 68 + Math.floor(mi / perRow) * (CELL_H + CELL_GAP);
                const hex = toneHex(m.state.tone);
                const isIdle = m.state.tone === "idle" || m.state.tone === "maintenance";
                const pulse = m.state.tone === "critical" && !m.state.hollow && !reduce;
                return (
                  <motion.g
                    key={m.machine.id}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + zi * 0.08 + mi * 0.04, duration: 0.35 }}
                    style={{ transformOrigin: `${cx + CELL_W / 2}px ${cy + CELL_H / 2}px` }}
                    onMouseEnter={() => setHover(m)}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/zones/${z.zone.id}?machine=${m.machine.id}`);
                    }}
                  >
                    <rect
                      x={cx}
                      y={cy}
                      width={CELL_W}
                      height={CELL_H}
                      rx={6}
                      fill={m.state.hollow ? `${hex}22` : isIdle ? "url(#hatch)" : `${hex}33`}
                      stroke={hex}
                      strokeWidth={m.state.hollow ? 1.5 : 1}
                      strokeDasharray={isIdle ? "4 3" : undefined}
                    />
                    {pulse && (
                      <motion.rect
                        x={cx}
                        y={cy}
                        width={CELL_W}
                        height={CELL_H}
                        rx={6}
                        fill="none"
                        stroke={hex}
                        strokeWidth={2}
                        animate={{ opacity: [0.9, 0.1, 0.9] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    <rect x={cx + 10} y={cy + 12} width={8} height={8} rx={2} fill={hex} />
                    <text x={cx + 24} y={cy + 20} fill={INK} fontSize={12} fontWeight={500}>
                      {truncate(m.machine.name, 15)}
                    </text>
                    <text x={cx + 10} y={cy + 40} fill={MUTED} fontSize={11}>
                      {MACHINE_TYPE_LABEL[m.machine.type]}
                    </text>
                    <text x={cx + 10} y={cy + 58} fill={hex} fontSize={11}>
                      {m.state.open.length > 0
                        ? `${m.state.open.length} open`
                        : m.state.hollow
                        ? "Acknowledged"
                        : STATUS_LABEL[m.machine.status]}
                    </text>
                  </motion.g>
                );
              })}
            </motion.g>
          );
        })}
      </svg>

      {hover && (
        <Box
          position="absolute"
          top={3}
          right={3}
          bg="carbon.700"
          borderRadius="md"
          px={3}
          py={2}
          fontSize="sm"
          pointerEvents="none"
          maxW="280px"
          boxShadow="lg"
        >
          <HStack spacing={2}>
            <Box w="8px" h="8px" borderRadius="sm" bg={toneHex(hover.state.tone)} />
            <Text fontWeight={500}>{hover.machine.name}</Text>
          </HStack>
          <Text color="text.muted" fontSize="xs">
            {STATUS_LABEL[hover.machine.status]} · {hover.machine.telemetry.temperature.toFixed(0)}°C ·{" "}
            {hover.machine.telemetry.throughput} units/h
          </Text>
          {hover.state.open.slice(0, 2).map((a) => (
            <Text key={a.id} fontSize="xs" color={toneHex(a.severity)} mt={1} noOfLines={1}>
              {a.message}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
