import type { Machine } from "../types";

/**
 * Minimal isometric projection. World units are floor tiles; z is height.
 * Screen x grows with world x and shrinks with world y; larger x+y is nearer
 * the viewer, which gives the painter's order for free.
 */
export const TILE = 28;
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

export interface Pt {
  x: number;
  y: number;
}

export function project(x: number, y: number, z = 0): Pt {
  return { x: (x - y) * COS * TILE, y: (x + y) * SIN * TILE - z * TILE };
}

export function poly(points: Pt[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export interface Box3 {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

/** Three visible faces of a cuboid, as SVG point strings. */
export function cuboidFaces(b: Box3) {
  const { x, y, w, d, h } = b;
  return {
    top: poly([project(x, y, h), project(x + w, y, h), project(x + w, y + d, h), project(x, y + d, h)]),
    left: poly([project(x, y + d, 0), project(x + w, y + d, 0), project(x + w, y + d, h), project(x, y + d, h)]),
    right: poly([project(x + w, y, 0), project(x + w, y + d, 0), project(x + w, y + d, h), project(x + w, y, h)]),
  };
}

/** Footprint and height per machine type, in tiles. */
export const FOOTPRINT: Record<Machine["type"], { w: number; d: number; h: number }> = {
  conveyor: { w: 3.2, d: 1.2, h: 0.7 },
  press: { w: 2, d: 2, h: 2.3 },
  welder: { w: 1.8, d: 1.8, h: 1.6 },
  cnc_mill: { w: 2.2, d: 1.8, h: 1.8 },
  robotic_arm: { w: 1.4, d: 1.4, h: 2.6 },
  spray_booth: { w: 2.4, d: 2.4, h: 2.8 },
};

export const SLOT = 4.6;

/** Lay machines out on a grid of slots. Returns boxes in world units. */
export function layoutMachines(machines: Machine[]): Array<{ machine: Machine; box: Box3 }> {
  const cols = machines.length <= 4 ? 2 : 3;
  return machines.map((machine, i) => {
    const fp = FOOTPRINT[machine.type];
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      machine,
      box: {
        x: 0.8 + col * SLOT + (SLOT - 0.8 - fp.w) / 2,
        y: 0.8 + row * SLOT + (SLOT - 0.8 - fp.d) / 2,
        ...fp,
      },
    };
  });
}

export function floorSize(count: number) {
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(count / cols));
  return { w: cols * SLOT + 0.8, d: rows * SLOT + 0.8 };
}

/** Mix two hex colours. t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const va = (pa >> s) & 255;
    const vb = (pb >> s) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
