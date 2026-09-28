import type { Sample } from "../lib/telemetryStore";
import type { MachineTelemetry } from "../types";

interface Props {
  samples: Sample[];
  field: keyof MachineTelemetry;
  color: string;
  width?: number;
  height?: number;
}

/** Tiny dependency-free trend line for a single telemetry channel. */
export function Sparkline({ samples, field, color, width = 96, height = 28 }: Props) {
  if (samples.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity={0.4} strokeDasharray="2 3" />
      </svg>
    );
  }
  const values = samples.map((s) => s[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
