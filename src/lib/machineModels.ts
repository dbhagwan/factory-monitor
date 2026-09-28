import type { Machine } from "../types";

/**
 * Machine models as lists of isometric primitives in local tile units.
 * Each model is authored to read as the real equipment: a CNC mill is a
 * cabinet with an enclosure window and control pendant, a press has two
 * columns and a ram, a conveyor has legs, rollers and side rails, etc.
 */
export type Part =
  | { kind: "box"; x: number; y: number; z: number; w: number; d: number; h: number; paint: Paint; opacity?: number; layer?: number }
  | { kind: "cyl"; x: number; y: number; z: number; r: number; h: number; paint: Paint; layer?: number }
  | { kind: "lamp"; x: number; y: number; z: number; r: number; layer?: number };

export type Paint = "body" | "dark" | "steel" | "glass" | "belt" | "accent" | "warm";

export const PAINT: Record<Paint, string> = {
  body: "#4B545E",
  dark: "#2C333A",
  steel: "#6B7580",
  glass: "#7FB1FF",
  belt: "#22282E",
  accent: "#5B9CFF",
  warm: "#F5B301",
};

export interface Model {
  w: number;
  d: number;
  h: number;
  parts: Part[];
}

const box = (x: number, y: number, z: number, w: number, d: number, h: number, paint: Paint, opacity?: number, layer?: number): Part => ({
  kind: "box", x, y, z, w, d, h, paint, opacity, layer,
});
const cyl = (x: number, y: number, z: number, r: number, h: number, paint: Paint, layer?: number): Part => ({ kind: "cyl", x, y, z, r, h, paint, layer });

function cncMill(): Model {
  return {
    w: 2.4, d: 1.9, h: 2.1,
    parts: [
      box(0, 0, 0, 2.4, 1.9, 0.9, "dark"), // base cabinet
      box(0.1, 0.1, 0.9, 2.2, 1.0, 1.2, "body"), // enclosure
      box(0.25, 1.08, 1.3, 1.4, 0.04, 0.65, "glass", 0.8), // viewing window on front
      box(0.1, 1.1, 0.9, 2.2, 0.7, 0.35, "steel"), // work table apron
      cyl(1.2, 0.6, 2.1, 0.22, 0.25, "steel"), // spindle motor
      box(2.05, 1.35, 0.9, 0.3, 0.3, 1.1, "dark"), // control pendant post
      box(1.95, 1.3, 1.95, 0.5, 0.35, 0.3, "glass", 0.9), // pendant screen
      { kind: "lamp", x: 0.35, y: 0.3, z: 2.1, r: 0.09 },
    ],
  };
}

function roboticArm(): Model {
  return {
    w: 1.6, d: 1.6, h: 2.6,
    parts: [
      cyl(0.8, 0.8, 0, 0.62, 0.22, "dark"), // plinth
      cyl(0.8, 0.8, 0.22, 0.34, 1.0, "body"), // column
      box(0.5, 0.5, 1.2, 0.6, 0.6, 0.5, "steel"), // shoulder
      box(0.6, 0.62, 1.55, 1.0, 0.36, 0.34, "body"), // upper arm reaching +x
      box(1.25, 0.62, 1.55, 0.36, 0.36, 1.0, "body"), // forearm up
      cyl(1.43, 0.8, 2.55, 0.16, 0.12, "dark"), // wrist
      { kind: "lamp", x: 0.8, y: 0.8, z: 1.7, r: 0.09 },
    ],
  };
}

function conveyor(): Model {
  const L = 3.4;
  const parts: Part[] = [];
  for (const [lx, ly] of [[0.15, 0.15], [L - 0.27, 0.15], [0.15, 0.85], [L - 0.27, 0.85], [L / 2, 0.15], [L / 2, 0.85]]) {
    parts.push(box(lx, ly, 0, 0.12, 0.12, 0.62, "dark", undefined, -1));
  }
  parts.push(box(0, 0.08, 0.62, L, 0.96, 0.16, "belt")); // bed
  for (let i = 0.25; i < L - 0.2; i += 0.32) parts.push(box(i, 0.1, 0.78, 0.06, 0.92, 0.02, "steel")); // rollers
  parts.push(box(0, 0, 0.62, L, 0.08, 0.3, "steel")); // rails
  parts.push(box(0, 1.04, 0.62, L, 0.08, 0.3, "steel"));
  parts.push(cyl(0.3, -0.25, 0.3, 0.2, 0.32, "dark")); // drive motor
  parts.push(box(0.9, 0.35, 0.8, 0.42, 0.42, 0.34, "body")); // parts on belt
  parts.push(box(2.1, 0.3, 0.8, 0.5, 0.5, 0.4, "body"));
  return { w: L, d: 1.12, h: 0.92, parts };
}

function press(): Model {
  return {
    w: 2.2, d: 2.2, h: 3.0,
    parts: [
      box(0, 0, 0, 2.2, 2.2, 0.55, "dark"), // bed
      box(0.15, 0.15, 0.55, 0.42, 0.42, 2.05, "body"), // columns
      box(1.63, 0.15, 0.55, 0.42, 0.42, 2.05, "body"),
      box(0.15, 1.63, 0.55, 0.42, 0.42, 2.05, "body"),
      box(1.63, 1.63, 0.55, 0.42, 0.42, 2.05, "body"),
      box(0, 0, 2.6, 2.2, 2.2, 0.4, "steel", undefined, 1), // crown
      box(0.7, 0.7, 1.5, 0.8, 0.8, 1.1, "dark"), // ram
      box(0.55, 0.55, 0.55, 1.1, 1.1, 0.2, "steel"), // die
      cyl(1.1, 1.1, 3.0, 0.3, 0.3, "dark", 1), // hydraulic unit
      { kind: "lamp", x: 1.9, y: 1.9, z: 3.0, r: 0.09, layer: 1 },
    ],
  };
}

function welder(): Model {
  return {
    w: 2.0, d: 2.0, h: 2.0,
    parts: [
      box(0, 0, 0, 1.0, 0.8, 1.15, "dark"), // power source
      box(0.1, 0.82, 0.9, 0.8, 0.02, 0.2, "glass", 0.9), // display
      box(0, 0.9, 0, 2.0, 1.1, 0.8, "body"), // welding table
      box(0.1, 1.0, 0.8, 1.8, 0.9, 0.06, "steel"), // table top
      box(1.7, 0.1, 0, 0.14, 0.14, 1.9, "steel"), // torch post
      box(1.05, 0.1, 1.76, 0.8, 0.14, 0.14, "steel"), // torch boom
      cyl(1.1, 0.17, 1.35, 0.06, 0.42, "dark"), // torch drop
      cyl(1.35, 0.4, 0, 0.22, 1.0, "steel"), // gas cylinder
      { kind: "lamp", x: 0.2, y: 0.2, z: 1.15, r: 0.09 },
    ],
  };
}

function sprayBooth(): Model {
  return {
    w: 2.6, d: 2.6, h: 2.9,
    parts: [
      box(0, 0, 0, 2.6, 2.6, 0.12, "dark"), // grated floor
      box(0, 0, 0.12, 2.6, 0.18, 2.6, "body"), // back wall
      box(0, 0, 0.12, 0.18, 2.6, 2.6, "body"), // left wall
      box(2.42, 0, 0.12, 0.18, 2.6, 2.6, "glass", 0.35), // right wall (glazed)
      box(0, 0, 2.72, 2.6, 2.6, 0.18, "steel", undefined, 1), // roof
      cyl(0.6, 0.6, 2.9, 0.22, 0.5, "dark", 1), // exhaust stack
      cyl(1.3, 1.3, 0.12, 0.3, 0.5, "dark"), // part stand
      box(0.95, 0.95, 0.62, 0.7, 0.7, 0.6, "steel"), // part being coated
      cyl(0.5, 1.9, 0.12, 0.2, 1.2, "dark"), // spray robot column
      box(0.5, 1.7, 1.3, 0.7, 0.25, 0.2, "body"), // spray arm
      { kind: "lamp", x: 2.3, y: 2.3, z: 2.9, r: 0.09, layer: 1 },
    ],
  };
}

export const MODELS: Record<Machine["type"], () => Model> = {
  cnc_mill: cncMill,
  robotic_arm: roboticArm,
  conveyor,
  press,
  welder,
  spray_booth: sprayBooth,
};
