/** SVG "no link" badge drawn over a machine that cannot be reached. */
export function OfflineBadge({ x, y, size = 18 }: { x: number; y: number; size?: number }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <circle cx={size / 2} cy={size / 2} r={size / 2 + 4} fill="#0F1214" stroke="#E5484D" strokeWidth={1.5} />
      <g transform={`scale(${s})`} fill="none" stroke="#E5484D" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h.01" />
        <path d="M8.5 16.4a5 5 0 0 1 7 0" />
        <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
        <path d="M2 8.8a15 15 0 0 1 20 0" />
        <path d="M17.1 12.9a10 10 0 0 0-2.4-1.6" />
        <path d="M2 2l20 20" />
      </g>
    </g>
  );
}
