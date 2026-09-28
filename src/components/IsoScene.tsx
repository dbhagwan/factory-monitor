import { Box, HStack, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { MachineModel, ZoneModel } from "../hooks/useFloor";
import { CHANNELS, CHANNEL_META, type Channel } from "../lib/channels";
import { STATUS_LABEL, toneHex, worstSeverity } from "../lib/health";
import { cuboidFaces, floorSize, layoutMachines, mix, poly, project, TILE } from "../lib/iso";

/**
 * Isometric view of one zone. Each machine is a cuboid whose colour follows
 * its worst open alert. The four tiles on its top face are the subsystems
 * (telemetry channels); a lit tile is where the problem is.
 */
const BODY = "#3A424B";
const INK = "#F4F6F7";
const MUTED = "#82888F";

interface Props {
  zone: ZoneModel;
  selectedMachine?: string;
  onSelect: (machineId: string, channel?: Channel) => void;
}

interface HoverInfo {
  m: MachineModel;
  channel?: Channel;
}

export function IsoScene({ zone, selectedMachine, onSelect }: Props) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const machines = zone.machines.map((m) => m.machine);
  const placed = useMemo(() => layoutMachines(machines), [machines]);
  const floor = floorSize(machines.length);

  // Bounds of the projected floor plus tallest machine.
  const corners = [project(0, 0, 0), project(floor.w, 0, 0), project(floor.w, floor.d, 0), project(0, floor.d, 0)];
  const minX = Math.min(...corners.map((c) => c.x)) - 20;
  const maxX = Math.max(...corners.map((c) => c.x)) + 20;
  const minY = Math.min(...corners.map((c) => c.y)) - 3.2 * TILE;
  const maxY = Math.max(...corners.map((c) => c.y)) + 44;

  const ordered = [...placed].sort((a, b) => a.box.x + a.box.y - (b.box.x + b.box.y));

  return (
    <Box position="relative" w="full" bg="carbon.900" borderRadius="lg" overflow="hidden">
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        width="100%"
        style={{ display: "block", maxHeight: 560 }}
      >
        {/* floor slab */}
        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <polygon points={poly(corners)} fill="#1C2126" stroke="#2C333A" strokeWidth={1} />
          {Array.from({ length: Math.floor(floor.w) + 1 }, (_, i) => (
            <line
              key={`gx${i}`}
              x1={project(i, 0).x}
              y1={project(i, 0).y}
              x2={project(i, floor.d).x}
              y2={project(i, floor.d).y}
              stroke="#242A30"
              strokeWidth={0.75}
            />
          ))}
          {Array.from({ length: Math.floor(floor.d) + 1 }, (_, i) => (
            <line
              key={`gy${i}`}
              x1={project(0, i).x}
              y1={project(0, i).y}
              x2={project(floor.w, i).x}
              y2={project(floor.w, i).y}
              stroke="#242A30"
              strokeWidth={0.75}
            />
          ))}
        </motion.g>

        {ordered.map(({ machine, box }, i) => {
          const model = zone.machines.find((m) => m.machine.id === machine.id)!;
          const hex = toneHex(model.state.tone);
          const neutral = model.state.tone === "healthy" || model.state.tone === "idle" || model.state.tone === "maintenance";
          const topColor = neutral ? mix(BODY, hex, model.state.tone === "healthy" ? 0.25 : 0.05) : mix(BODY, hex, model.state.hollow ? 0.3 : 0.6);
          const faces = cuboidFaces(box);
          const selected = selectedMachine === machine.id;
          const pulse = model.state.tone === "critical" && !model.state.hollow && !reduce;
          const label = project(box.x, box.y + box.d, 0);

          return (
            <motion.g
              key={machine.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.45, ease: "easeOut" }}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(machine.id)}
              onMouseEnter={() => setHover({ m: model })}
              onMouseLeave={() => setHover(null)}
            >
              <polygon points={faces.left} fill={mix(topColor, "#0F1214", 0.45)} stroke="#0F1214" strokeWidth={0.6} />
              <polygon points={faces.right} fill={mix(topColor, "#0F1214", 0.3)} stroke="#0F1214" strokeWidth={0.6} />
              <polygon points={faces.top} fill={topColor} stroke={selected ? "#5B9CFF" : "#0F1214"} strokeWidth={selected ? 1.5 : 0.6} />
              {pulse && (
                <motion.polygon
                  points={faces.top}
                  fill="none"
                  stroke={hex}
                  strokeWidth={2}
                  animate={{ opacity: [0.9, 0.15, 0.9] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {/* subsystem tiles: 2×2 on the top face */}
              {CHANNELS.map((channel, ci) => {
                const col = ci % 2;
                const row = Math.floor(ci / 2);
                const inset = 0.18;
                const tw = (box.w - inset * 3) / 2;
                const td = (box.d - inset * 3) / 2;
                const tx = box.x + inset + col * (tw + inset);
                const ty = box.y + inset + row * (td + inset);
                const z = box.h + 0.02;
                const mine = [...model.state.open, ...model.state.acked].filter(
                  (a) => a.channel === channel
                );
                const open = mine.filter((a) => !a.acknowledged);
                const sev = worstSeverity(open) ?? worstSeverity(mine);
                const lit = sev ? toneHex(sev) : null;
                const hollow = !!sev && open.length === 0;
                const pts = poly([
                  project(tx, ty, z),
                  project(tx + tw, ty, z),
                  project(tx + tw, ty + td, z),
                  project(tx, ty + td, z),
                ]);
                return (
                  <polygon
                    key={channel}
                    points={pts}
                    fill={lit ? (hollow ? `${lit}33` : lit) : "#ffffff14"}
                    stroke={lit ?? "#ffffff22"}
                    strokeWidth={lit ? 1 : 0.5}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(machine.id, channel);
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHover({ m: model, channel });
                    }}
                    onMouseLeave={() => setHover({ m: model })}
                  />
                );
              })}

              <text x={label.x} y={label.y + 16} fill={INK} fontSize={11} fontWeight={500}>
                {machine.name}
              </text>
              <text x={label.x} y={label.y + 29} fill={neutral ? MUTED : hex} fontSize={10}>
                {model.state.open.length > 0
                  ? `${model.state.open.length} open`
                  : model.state.hollow
                  ? "Acknowledged"
                  : STATUS_LABEL[machine.status]}
              </text>
            </motion.g>
          );
        })}
      </svg>

      <HStack
        position="absolute"
        bottom={3}
        left={4}
        spacing={4}
        fontSize="xs"
        color="text.muted"
        pointerEvents="none"
      >
        <Text>Top-face tiles:</Text>
        {CHANNELS.map((c, i) => (
          <HStack key={c} spacing={1}>
            <Text color="ink">{["◤", "◥", "◣", "◢"][i]}</Text>
            <Text>{CHANNEL_META[c].label}</Text>
          </HStack>
        ))}
      </HStack>

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
          <Text fontWeight={500}>{hover.m.machine.name}</Text>
          {hover.channel ? (
            <Text fontSize="xs" color="text.muted">
              {CHANNEL_META[hover.channel].label} ·{" "}
              {hover.m.machine.telemetry[CHANNEL_META[hover.channel].field].toFixed(1)}{" "}
              {CHANNEL_META[hover.channel].unit}
            </Text>
          ) : (
            <Text fontSize="xs" color="text.muted">
              {STATUS_LABEL[hover.m.machine.status]} · click for detail
            </Text>
          )}
          {hover.m.state.open
            .filter((a) => !hover.channel || a.channel === hover.channel)
            .slice(0, 2)
            .map((a) => (
              <Text key={a.id} fontSize="xs" color={toneHex(a.severity)} mt={1} noOfLines={1}>
                {a.message}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}
