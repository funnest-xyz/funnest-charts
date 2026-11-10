import { seriesColor, treemap } from '@funnest/charts-viz';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatNumber, VAR } from './context';

export interface TreemapItem {
  id: string;
  label: string;
  /** Tile size (market cap, holding value). */
  value: number;
  /** Colors the tile: up / down intensity (e.g. today's change, %). */
  change?: number;
  /** Fixed tile color (wins over `change`). */
  color?: string;
  /** Second line under the label (e.g. price). */
  sublabel?: string;
}

export interface TreemapChartProps {
  data: readonly TreemapItem[];
  width?: number;
  /** Default 280. */
  height?: number;
  /** Gap between tiles, px. Default 2. */
  gap?: number;
  /** Tile corner radius. Default 4. */
  radius?: number;
  /** Color for rising tiles. Default '#F04452' (Korean red-up). */
  upColor?: string;
  /** Color for falling tiles. Default '#3182F6'. */
  downColor?: string;
  /** Color for flat (or near-zero) tiles. Default '#8B95A1'. */
  flatColor?: string;
  /** |change| at or above this gets the full up/down color. Default 5 (%). */
  maxChange?: number;
  /** Custom tile color; return undefined to fall back. */
  getColor?: (item: TreemapItem, index: number) => string | undefined;
  /** Change text on tiles and in the tooltip. Default "+2.31%". */
  changeFormatter?: (change: number) => string;
  valueFormatter?: (value: number) => string;
  /** Hover / arrow keys show a tooltip with the value. Default true. */
  enableTooltip?: boolean;
  onItemClick?: (item: TreemapItem) => void;
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const hex = (c: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
/** Mix two #rrggbb colors (falls back to `b` for other formats). */
const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  if (!x || !y) return t >= 0.5 ? b : a;
  const c = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const defaultChange = (c: number) => `${c > 0 ? '+' : ''}${c.toFixed(2)}%`;
const textWidth = (t: string, size: number) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.6), 0);

/**
 * Tiles sized by value and colored by change: market maps, sector heatmaps, holdings by weight.
 * Labels shrink with the tile and hide when they don't fit.
 */
export function TreemapChart({
  data,
  width: fixedWidth,
  height = 280,
  gap = 2,
  radius = 4,
  upColor = '#F04452',
  downColor = '#3182F6',
  flatColor = '#8B95A1',
  maxChange = 5,
  getColor,
  changeFormatter = defaultChange,
  valueFormatter = formatNumber,
  enableTooltip = true,
  onItemClick,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
}: TreemapChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(fixedWidth ?? 0);
  const [active, setActive] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (fixedWidth !== undefined) return setMeasured(fixedWidth);
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setMeasured(Math.round(e.contentRect.width)));
    ro.observe(el);
    setMeasured(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [fixedWidth]);
  const w = measured;

  const byId = useMemo(() => new Map(data.map((d, i) => [d.id, { d, i }])), [data]);
  const rects = useMemo(() => treemap(data, w, height, gap), [data, w, height, gap]);

  const colorOf = (d: TreemapItem, i: number) => {
    const custom = getColor?.(d, i) ?? d.color;
    if (custom) return custom;
    if (d.change === undefined) return seriesColor(i, palette);
    if (Math.abs(d.change) < 1e-9) return flatColor;
    // Even small moves get some color; full color at maxChange.
    const t = 0.45 + 0.55 * Math.min(1, Math.abs(d.change) / maxChange);
    return mix(flatColor, d.change > 0 ? upColor : downColor, t);
  };

  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!rects.length) return;
    const k = rects.findIndex((r) => r.id === active);
    let next: string | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = rects[(k + 1) % rects.length]!.id;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = rects[(k <= 0 ? rects.length : k) - 1]!.id;
    else if (e.key === 'Home') next = rects[0]!.id;
    else if (e.key === 'End') next = rects[rects.length - 1]!.id;
    else if (e.key === 'Escape') next = null;
    else if ((e.key === 'Enter' || e.key === ' ') && active && onItemClick) {
      e.preventDefault();
      onItemClick(byId.get(active)!.d);
      return;
    }
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  const describe = (d: TreemapItem) =>
    [d.label, d.sublabel, d.change !== undefined ? changeFormatter(d.change) : undefined, valueFormatter(d.value)].filter(Boolean).join(' ');

  const hit = active ? rects.find((r) => r.id === active) : undefined;
  const hitItem = hit ? byId.get(hit.id)!.d : undefined;
  let tip: { x: number; y: number; w: number; h: number; rows: [string, string][] } | null = null;
  if (enableTooltip && hit && hitItem) {
    const rows: [string, string][] = [[hitItem.label, valueFormatter(hitItem.value)]];
    if (hitItem.change !== undefined) rows.push(['', changeFormatter(hitItem.change)]);
    const tw = Math.max(...rows.map(([a, b]) => textWidth(a, 12) + textWidth(b, 12) + 28)) + 8;
    const th = rows.length * 18 + 14;
    const cx = hit.x + hit.width / 2;
    let tx = cx - tw / 2;
    tx = Math.max(0, Math.min(w - tw, tx));
    // Above the tile when there's room, else inside its bottom.
    const ty = hit.y - th - 6 >= 0 ? hit.y - th - 6 : Math.min(height - th, hit.y + hit.height + 6 <= height - th ? hit.y + hit.height + 6 : hit.y + 6);
    tip = { x: tx, y: ty, w: tw, h: th, rows };
  }

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: fixedWidth ?? '100%', fontFamily: VAR.font, ...style }}>
      <svg
        width={w || '100%'}
        height={height}
        role="img"
        aria-label={ariaLabel ?? data.map(describe).join(', ')}
        tabIndex={0}
        style={{ display: 'block', overflow: 'visible', userSelect: 'none', outline: 'none', borderRadius: radius + 2, boxShadow: focused ? `0 0 0 2px ${VAR.accentRing}` : undefined }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setActive(null);
        }}
        onPointerLeave={() => setActive(null)}
      >
        {rects.map((r) => {
          const { d, i } = byId.get(r.id)!;
          const on = active === r.id;
          // Label size follows the tile: big tiles get big type.
          // …then shrinks to fit the tile width (down to 9px) before giving up.
          const fs = Math.max(9, Math.min(22, Math.sqrt(r.width * r.height) / 6, (r.width - 10) / Math.max(1, textWidth(d.label, 1))));
          const sub = d.change !== undefined ? changeFormatter(d.change) : d.sublabel;
          const fitsLabel = r.width >= textWidth(d.label, fs) + 10 && r.height >= fs + 8;
          const fitsSub = !!sub && fitsLabel && r.height >= fs * 2 + 14 && r.width >= textWidth(sub, fs * 0.8) + 10;
          const cy = r.y + r.height / 2;
          return (
            <g key={r.id} onPointerEnter={() => setActive(r.id)} onClick={onItemClick ? () => onItemClick(d) : undefined} style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
              <rect
                x={r.x}
                y={r.y}
                width={Math.max(0, r.width)}
                height={Math.max(0, r.height)}
                rx={Math.min(radius, r.width / 2, r.height / 2)}
                style={{ fill: colorOf(d, i), transition: 'opacity 0.15s' }}
                opacity={active && !on ? 0.55 : 1}
              />
              {on && (
                <rect
                  x={r.x + 1}
                  y={r.y + 1}
                  width={Math.max(0, r.width - 2)}
                  height={Math.max(0, r.height - 2)}
                  rx={Math.min(radius, r.width / 2, r.height / 2)}
                  fill="none"
                  strokeWidth={2}
                  style={{ stroke: '#fff' }}
                />
              )}
              {fitsLabel && (
                <text
                  x={r.x + r.width / 2}
                  y={fitsSub ? cy - fs * 0.45 : cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fs}
                  fontWeight={700}
                  pointerEvents="none"
                  style={{ fill: '#fff' }}
                >
                  {d.label}
                </text>
              )}
              {fitsSub && (
                <text
                  x={r.x + r.width / 2}
                  y={cy + fs * 0.65}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fs * 0.78}
                  fontWeight={600}
                  pointerEvents="none"
                  style={{ fill: 'rgba(255,255,255,0.88)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {sub}
                </text>
              )}
            </g>
          );
        })}
        {tip && (
          <g transform={`translate(${tip.x},${tip.y})`} pointerEvents="none">
            <rect width={tip.w} height={tip.h} rx={8} strokeWidth={1} style={{ fill: VAR.bg, stroke: VAR.grid }} />
            {tip.rows.map(([a, b], k) => (
              <g key={k} transform={`translate(10,${7 + 9 + k * 18})`}>
                <text dominantBaseline="central" fontSize={12} style={{ fill: VAR.text }}>
                  {a}
                </text>
                <text
                  x={tip.w - 20}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={12}
                  fontWeight={700}
                  style={{ fill: k === 1 && hitItem?.change ? (hitItem.change > 0 ? upColor : downColor) : VAR.textStrong, fontVariantNumeric: 'tabular-nums' }}
                >
                  {b}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {focused && hitItem ? describe(hitItem) : ''}
      </span>
    </div>
  );
}
