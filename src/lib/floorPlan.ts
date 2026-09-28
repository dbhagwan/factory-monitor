/**
 * Static floor plan. The API carries no coordinates, so the plant layout is
 * authored here in plan units (roughly decimetres on a 1200 × 760 sheet).
 * Zones are irregular bays separated by aisles; machines have named slots so
 * the plan reads like a real floor rather than a grid.
 */
export type P = [number, number];

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZonePlan {
  polygon: P[];
  label: P;
  counter: P;
  slots: Record<string, Slot>;
  /** Fallback slot origin for machines without a named slot. */
  fallback: { x: number; y: number; w: number; h: number; perRow: number };
}

export const PLAN_W = 1200;
export const PLAN_H = 760;

export const BUILDING: P[] = [
  [40, 40],
  [1160, 40],
  [1160, 700],
  [40, 700],
];

export const ZONES: Record<string, ZonePlan> = {
  assembly: {
    polygon: [
      [70, 80],
      [400, 80],
      [400, 150],
      [485, 150],
      [485, 380],
      [70, 380],
    ],
    label: [86, 108],
    counter: [470, 176],
    slots: {
      "cnc-mill-01": { x: 92, y: 130, w: 140, h: 64 },
      "cnc-mill-02": { x: 246, y: 130, w: 140, h: 64 },
      "robot-arm-01": { x: 92, y: 212, w: 140, h: 64 },
      "conveyor-01": { x: 92, y: 300, w: 372, h: 36 },
    },
    fallback: { x: 92, y: 130, w: 140, h: 64, perRow: 2 },
  },
  welding: {
    polygon: [
      [600, 80],
      [900, 80],
      [930, 110],
      [930, 350],
      [600, 350],
    ],
    label: [616, 108],
    counter: [914, 108],
    slots: {
      "welder-01": { x: 622, y: 132, w: 140, h: 64 },
      "welder-02": { x: 776, y: 132, w: 140, h: 64 },
      "robot-arm-02": { x: 622, y: 232, w: 140, h: 64 },
    },
    fallback: { x: 622, y: 132, w: 140, h: 64, perRow: 2 },
  },
  painting: {
    polygon: [
      [600, 480],
      [1000, 480],
      [1000, 670],
      [600, 670],
    ],
    label: [616, 508],
    counter: [984, 508],
    slots: {
      "spray-01": { x: 622, y: 532, w: 140, h: 64 },
      "spray-02": { x: 776, y: 532, w: 140, h: 64 },
      "conveyor-02": { x: 622, y: 616, w: 350, h: 36 },
    },
    fallback: { x: 622, y: 532, w: 140, h: 64, perRow: 2 },
  },
  packaging: {
    polygon: [
      [70, 480],
      [485, 480],
      [485, 670],
      [70, 670],
    ],
    label: [86, 508],
    counter: [470, 508],
    slots: {
      "press-01": { x: 92, y: 532, w: 140, h: 64 },
      "robot-arm-03": { x: 246, y: 532, w: 140, h: 64 },
      "conveyor-03": { x: 92, y: 606, w: 294, h: 30 },
      "conveyor-04": { x: 400, y: 532, w: 64, h: 104 },
    },
    fallback: { x: 92, y: 532, w: 140, h: 64, perRow: 2 },
  },
};

/** Forklift aisles. */
export const AISLES: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 40, y: 400, w: 1120, h: 48 }, // main aisle
  { x: 520, y: 40, w: 52, h: 660 }, // cross aisle
];

/** Non-production rooms and features. */
export interface Room {
  id: string;
  name: string;
  polygon: P[];
  label: P;
}

export const ROOMS: Room[] = [
  {
    id: "offices",
    name: "Offices & QC lab",
    polygon: [
      [960, 80],
      [1130, 80],
      [1130, 350],
      [960, 350],
    ],
    label: [976, 108],
  },
  {
    id: "storage",
    name: "Raw material storage",
    polygon: [
      [1030, 480],
      [1130, 480],
      [1130, 670],
      [1030, 670],
    ],
    label: [1046, 508],
  },
  {
    id: "maintenance",
    name: "Maintenance",
    polygon: [
      [600, 40],
      [930, 40],
      [930, 70],
      [600, 70],
    ],
    label: [616, 60],
  },
];

export const DESKS: Array<{ x: number; y: number }> = [
  { x: 990, y: 140 },
  { x: 1060, y: 140 },
  { x: 990, y: 190 },
  { x: 1060, y: 190 },
  { x: 990, y: 240 },
  { x: 1060, y: 240 },
];

export const QC_BENCH = { x: 985, y: 296, w: 120, h: 30 };

export const RACKS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 1044, y: 520, w: 72, h: 20 },
  { x: 1044, y: 552, w: 72, h: 20 },
  { x: 1044, y: 584, w: 72, h: 20 },
  { x: 1044, y: 616, w: 72, h: 20 },
];

/** Structural columns along the aisles. */
export const COLUMNS: P[] = [
  [520, 400], [572, 400], [520, 448], [572, 448],
  [300, 400], [300, 448], [800, 400], [800, 448],
  [520, 220], [572, 220], [520, 600], [572, 600],
];

export const DOCK_DOORS: Array<{ x: number; w: number }> = [
  { x: 120, w: 70 },
  { x: 230, w: 70 },
  { x: 340, w: 70 },
];


export function bounds(polygon: P[]) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function slotFor(zoneId: string, machineId: string, index: number): Slot {
  const z = ZONES[zoneId];
  if (!z) return { x: 0, y: 0, w: 140, h: 64 };
  const named = z.slots[machineId];
  if (named) return named;
  const f = z.fallback;
  return {
    x: f.x + (index % f.perRow) * (f.w + 14),
    y: f.y + Math.floor(index / f.perRow) * (f.h + 16),
    w: f.w,
    h: f.h,
  };
}
