import { Box, HStack, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { MachineModel, ZoneModel } from "../hooks/useFloor";
import { CHANNELS, CHANNEL_META, type Channel } from "../lib/channels";
import { STATUS_LABEL, toneHex, worstSeverity } from "../lib/health";
import { circleAt, cuboidFaces, cylinderParts, mix, poly, project, TILE, shade } from "../lib/iso";
import { MODELS, PAINT, type Part } from "../lib/machineModels";
import { OfflineBadge } from "./OfflineBadge";

/**
 * Isometric view of one zone. Machines are modelled from primitives so they
 * read as real equipment. The pad under each machine carries its state
 * colour; the four chips on the pad's front edge are its subsystems.
 */
const INK = "#F4F6F7";

function ownerOf(m: MachineModel): string {
  const names = Array.from(new Set(m.state.acked.map((a) => a.acknowledgedBy).filter(Boolean)));
  return names.length ? names.join(", ") : "unassigned";
}
const MUTED = "#82888F";
const SLOT = 4.8;

interface Props {
  zone: ZoneModel;
  selectedMachine?: string;
  offline: boolean;
  onSelect: (machineId: string, channel?: Channel) => void;
}

interface HoverInfo {
  m: MachineModel;
  channel?: Channel;
}

function partKey(p: Part) {
  const layer = p.layer ?? 0;
  const sum = p.kind === "box" ? p.x + p.y + p.z : p.x - p.r + (p.y - p.r) + p.z;
  return layer * 1000 + sum;
}

export function IsoScene({ zone, selectedMachine, offline, onSelect }: Props) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const cols = zone.machines.length <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(zone.machines.length / cols));
  const floor = { w: cols * SLOT + 0.6, d: rows * SLOT + 0.6 };

  const placed = useMemo(
    () =>
      zone.machines.map((m, i) => {
        const model = MODELS[m.machine.type]();
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.3 + col * SLOT + (SLOT - model.w) / 2;
        const y = 0.3 + row * SLOT + (SLOT - model.d) / 2;
        return { m, model, x, y };
      }),
    [zone.machines, cols]
  );

  const corners = [project(0, 0), project(floor.w, 0), project(floor.w, floor.d), project(0, floor.d)];
  const minX = Math.min(...corners.map((c) => c.x)) - 16;
  const maxX = Math.max(...corners.map((c) => c.x)) + 16;
  const minY = Math.min(...corners.map((c) => c.y)) - 3.4 * TILE;
  const maxY = Math.max(...corners.map((c) => c.y)) + 34;

  const ordered = [...placed].sort((a, b) => a.x + a.y - (b.x + b.y));

  return (
    <Box position="relative" w="full" h="full" bg="carbon.900" borderRadius="lg" overflow="hidden">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width="100%" height="100%" style={{ display: "block" }}>
        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <polygon points={poly(corners)} fill="#1C2126" stroke="#2C333A" strokeWidth={1} />
          {Array.from({ length: Math.floor(floor.w) + 1 }, (_, i) => (
            <line key={`gx${i}`} x1={project(i, 0).x} y1={project(i, 0).y} x2={project(i, floor.d).x} y2={project(i, floor.d).y} stroke="#242A30" strokeWidth={0.75} />
          ))}
          {Array.from({ length: Math.floor(floor.d) + 1 }, (_, i) => (
            <line key={`gy${i}`} x1={project(0, i).x} y1={project(0, i).y} x2={project(floor.w, i).x} y2={project(floor.w, i).y} stroke="#242A30" strokeWidth={0.75} />
          ))}
        </motion.g>

        {ordered.map(({ m, model, x, y }, i) => {
          const hex = toneHex(m.state.tone);
          const neutral = m.state.tone === "healthy" || m.state.tone === "idle" || m.state.tone === "maintenance";
          const tint = neutral ? 0 : m.state.hollow ? 0.18 : 0.38;
          const selected = selectedMachine === m.machine.id;
          const pulse = m.state.tone === "critical" && !m.state.hollow && !reduce;
          const margin = 0.35;
          const pad = poly([
            project(x - margin, y - margin, 0),
            project(x + model.w + margin, y - margin, 0),
            project(x + model.w + margin, y + model.d + margin, 0),
            project(x - margin, y + model.d + margin, 0),
          ]);
          const padBottom = project(x + model.w + margin, y + model.d + margin, 0);
          const padCenter = project(x + model.w / 2, y + model.d / 2, 0);
          const top = project(x + model.w / 2, y + model.d / 2, model.h);
          const parts = [...model.parts].sort((a, b) => partKey(a) - partKey(b));
          const paintOf = (p: keyof typeof PAINT) => (tint ? mix(PAINT[p], hex, tint) : PAINT[p]);

          return (
            <motion.g
              key={m.machine.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease: "easeOut" }}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(m.machine.id)}
              onMouseEnter={() => setHover({ m })}
              onMouseLeave={() => setHover(null)}
            >
              {/* state pad */}
              <polygon points={pad} fill={`${hex}${neutral ? "14" : "26"}`} stroke={selected ? "#5B9CFF" : hex} strokeWidth={selected ? 1.5 : 1} strokeOpacity={neutral && !selected ? 0.5 : 1} />
              {pulse && (
                <motion.polygon points={pad} fill="none" stroke={hex} strokeWidth={2} animate={{ opacity: [0.9, 0.15, 0.9] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
              )}

              {/* model */}
              {parts.map((p, pi) => {
                if (p.kind === "box") {
                  const f = cuboidFaces({ x: x + p.x, y: y + p.y, w: p.w, d: p.d, h: p.h });
                  const c = paintOf(p.paint);
                  const op = p.opacity ?? 1;
                  return (
                    <g key={pi} opacity={op}>
                      <polygon points={f.left} fill={shade(c, 0.45)} stroke="#0F1214" strokeWidth={0.5} strokeOpacity={0.6} />
                      <polygon points={f.right} fill={shade(c, 0.28)} stroke="#0F1214" strokeWidth={0.5} strokeOpacity={0.6} />
                      <polygon points={f.top} fill={c} stroke="#0F1214" strokeWidth={0.5} strokeOpacity={0.6} />
                    </g>
                  );
                }
                if (p.kind === "cyl") {
                  const cp = cylinderParts(x + p.x, y + p.y, p.z, p.r, p.h);
                  const c = paintOf(p.paint);
                  return (
                    <g key={pi}>
                      <ellipse cx={cp.bottom.cx} cy={cp.bottom.cy} rx={cp.bottom.rx} ry={cp.bottom.ry} fill={shade(c, 0.45)} />
                      <polygon points={cp.side} fill={shade(c, 0.3)} />
                      <ellipse cx={cp.top.cx} cy={cp.top.cy} rx={cp.top.rx} ry={cp.top.ry} fill={c} stroke="#0F1214" strokeWidth={0.5} strokeOpacity={0.6} />
                    </g>
                  );
                }
                const lamp = circleAt(x + p.x, y + p.y, p.z, p.r);
                const glow = circleAt(x + p.x, y + p.y, p.z, p.r * 2.6);
                return (
                  <g key={pi}>
                    <ellipse cx={glow.cx} cy={glow.cy} rx={glow.rx} ry={glow.ry} fill={hex} opacity={0.25} />
                    <ellipse cx={lamp.cx} cy={lamp.cy} rx={lamp.rx} ry={lamp.ry} fill={hex} />
                  </g>
                );
              })}

              {/* subsystem chips along the pad's front edge */}
              {CHANNELS.map((channel, ci) => {
                const size = 0.5;
                const gap = (model.w + margin * 2 - CHANNELS.length * size) / (CHANNELS.length + 1);
                const cx = x - margin + gap + ci * (size + gap);
                const cy = y + model.d + margin - size - 0.12;
                const mine = [...m.state.open, ...m.state.acked].filter((a) => a.channel === channel);
                const open = mine.filter((a) => !a.acknowledged);
                const sev = worstSeverity(open) ?? worstSeverity(mine);
                const lit = sev ? toneHex(sev) : null;
                const hollow = !!sev && open.length === 0;
                const pts = poly([project(cx, cy, 0.02), project(cx + size, cy, 0.02), project(cx + size, cy + size, 0.02), project(cx, cy + size, 0.02)]);
                return (
                  <polygon
                    key={channel}
                    points={pts}
                    fill={lit ? (hollow ? `${lit}44` : lit) : "#ffffff18"}
                    stroke={lit ?? "#ffffff30"}
                    strokeWidth={lit ? 1 : 0.6}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(m.machine.id, channel);
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHover({ m, channel });
                    }}
                    onMouseLeave={() => setHover({ m })}
                  />
                );
              })}

              <text x={padCenter.x} y={padBottom.y + 14} fill={INK} fontSize={11} fontWeight={500} textAnchor="middle">{m.machine.name}</text>
              <text x={padCenter.x} y={padBottom.y + 27} fill={neutral ? MUTED : hex} fontSize={10} textAnchor="middle">
                {m.state.open.length > 0 ? `${m.state.open.length} open` : m.state.hollow ? `In progress · ${ownerOf(m)}` : STATUS_LABEL[m.machine.status]}
              </text>
              {offline && <OfflineBadge x={top.x - 9} y={top.y - 30} size={18} />}
            </motion.g>
          );
        })}
      </svg>

      <HStack position="absolute" bottom={3} left={4} spacing={4} fontSize="xs" color="text.muted" pointerEvents="none">
        <Text>Pad chips, left to right:</Text>
        {CHANNELS.map((c) => (
          <Text key={c}>{CHANNEL_META[c].label}</Text>
        ))}
      </HStack>

      {hover && (
        <Box position="absolute" top={3} right={3} bg="carbon.700" borderRadius="md" px={3} py={2} fontSize="sm" pointerEvents="none" maxW="280px" boxShadow="lg">
          <Text fontWeight={500}>{hover.m.machine.name}</Text>
          {hover.channel ? (
            <Text fontSize="xs" color="text.muted">
              {CHANNEL_META[hover.channel].label} · {hover.m.machine.telemetry[CHANNEL_META[hover.channel].field].toFixed(1)} {CHANNEL_META[hover.channel].unit}
            </Text>
          ) : (
            <Text fontSize="xs" color="text.muted">{STATUS_LABEL[hover.m.machine.status]} · click for detail</Text>
          )}
          {hover.m.state.open
            .filter((a) => !hover.channel || a.channel === hover.channel)
            .slice(0, 2)
            .map((a) => (
              <Text key={a.id} fontSize="xs" color={toneHex(a.severity)} mt={1} noOfLines={1}>{a.message}</Text>
            ))}
          {hover.m.state.acked
            .filter((a) => !hover.channel || a.channel === hover.channel)
            .map((a) => (
              <Text key={a.id} fontSize="xs" color="text.muted" mt={1} noOfLines={1}>
                In progress · {a.acknowledgedBy ?? "unassigned"} · {a.message}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}
