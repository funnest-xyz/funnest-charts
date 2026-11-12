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
/** Width estimate without a canvas (server render): CJK a full em, the rest 0.62. */
const estimate = (t: string, size: number) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.62), 0);
type Measure = (text: string, size: number, weight: number) => number;

let canvasCtx: CanvasRenderingContext2D | null | undefined;
/** Real text widths in `family` (a canvas); the estimate where there's none. */
function measurer(family: string | null): Measure {
  if (canvasCtx === undefined) {
    try {
      canvasCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      canvasCtx = null;
    }
  }
  const ctx = canvasCtx;
  if (!ctx || !family) return (t, size) => estimate(t, size);
  const cache = new Map<string, number>();
  return (t, size, weight) => {
    const key = `${weight}|${t}`;
    let w1 = cache.get(key);
    if (w1 === undefined) {
      ctx.font = `${weight} 100px ${family}`;
      w1 = ctx.measureText(t).width / 100;
      cache.set(key, w1);
    }
    return w1 * size;
  };
}

const MIN_FONT = 7;
const isHangul = (ch: string) => /[\u3131-\u318e\uac00-\ud7a3]/.test(ch);

/** Two-line splits of a label: at spaces, between Hangul, or where Latin meets Hangul — never inside a Latin word. */
function splits(label: string): [string, string][] {
  const chars = [...label];
  const out: [string, string][] = [];
  for (let i = 1; i < chars.length; i++) {
    const a = chars[i - 1]!;
    const b = chars[i]!;
    if (b === ' ') out.push([chars.slice(0, i).join(''), chars.slice(i + 1).join('')]);
    else if (a !== ' ' && (isHangul(a) || isHangul(b))) out.push([chars.slice(0, i).join(''), chars.slice(i).join('')]);
  }
  return out.filter(([x, y]) => x.trim() && y.trim());
}

export interface TileLabel {
  lines: string[];
  size: number;
  /** The second line (change or sublabel) and its size, when it fits too. */
  sub?: { text: string; size: number };
}

/**
 * How a tile's label fits: one line as big as the tile allows (up to 22px); if that's under 7px,
 * the label on two lines (a narrow, tall tile); still not, cut short with "…". The change goes
 * under it when there's room. Null when not even two letters fit.
 */
export function fitLabel(label: string, sub: string | undefined, width: number, height: number, measure: Measure): TileLabel | null {
  const w = width - 8;
  const h = height - 6;
  if (w < MIN_FONT * 1.5 || h < MIN_FONT * 1.1) return null;
  const base = Math.min(22, Math.sqrt(width * height) / 6);
  const sizeFor = (lines: string[]) => {
    const widest = Math.max(...lines.map((l) => measure(l, 1, 700)));
    return Math.min(base, w / Math.max(widest, 0.01), h / (lines.length * 1.2));
  };
  let best: { lines: string[]; size: number } | null = null;
  const one = sizeFor([label]);
  if (one >= Math.min(base, 9)) best = { lines: [label], size: one };
  else {
    const candidates = [[label], ...splits(label)].map((lines) => ({ lines, size: sizeFor(lines) }));
    for (const c of candidates) if (c.size >= MIN_FONT && (!best || c.size > best.size + 0.5)) best = c;
  }
  if (!best) {
    // Cut short: as many letters as fit at the smallest size, then "…".
    const size = Math.max(MIN_FONT, Math.min(base, h / 1.2));
    const chars = [...label];
    let n = chars.length - 1;
    while (n >= 2 && measure(`${chars.slice(0, n).join('')}…`, size, 700) > w) n--;
    if (n < 2 || size > h / 1.1) return null;
    return { lines: [`${chars.slice(0, n).join('')}…`], size };
  }
  const out: TileLabel = { lines: best.lines, size: best.size };
  if (sub) {
    const size = Math.min(best.size * 0.78, w / Math.max(measure(sub, 1, 600), 0.01));
    const used = best.lines.length * best.size * 1.2;
    if (size >= MIN_FONT && used + size * 1.3 <= h) out.sub = { text: sub, size };
  }
  return out;
}

/**
 * Tiles sized by value and colored by change: market maps, sector heatmaps, holdings by weight.
 * Labels shrink with the tile, wrap onto two lines in narrow ones and are cut short with "…" in
 * small ones; only tiles too small for two letters go without.
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
  // Labels are fitted with real text widths once the font is known (estimated on the server).
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (el) setFamily(getComputedStyle(el).fontFamily || null);
  }, []);
  const measure = useMemo(() => measurer(family), [family]);
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
    const tw = Math.max(...rows.map(([a, b]) => measure(a, 12, 400) + measure(b, 12, 700) + 28)) + 8;
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
          // Label size follows the tile; a narrow one wraps, a tiny one cuts short (the tooltip has it all).
          const fit = fitLabel(d.label, d.change !== undefined ? changeFormatter(d.change) : d.sublabel, r.width, r.height, measure);
          const lineH = fit ? fit.size * 1.2 : 0;
          const block = fit ? fit.lines.length * lineH + (fit.sub ? fit.sub.size * 1.3 : 0) : 0;
          const top = r.y + r.height / 2 - block / 2;
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
              {fit && (
                <text textAnchor="middle" pointerEvents="none" fontWeight={700} fontSize={fit.size} style={{ fill: '#fff' }}>
                  {fit.lines.map((line, k) => (
                    <tspan key={k} x={r.x + r.width / 2} y={top + lineH * (k + 0.5)} dominantBaseline="central">
                      {line}
                    </tspan>
                  ))}
                  {fit.sub && (
                    <tspan
                      x={r.x + r.width / 2}
                      y={top + fit.lines.length * lineH + fit.sub.size * 0.65}
                      dominantBaseline="central"
                      fontSize={fit.sub.size}
                      fontWeight={600}
                      style={{ fill: 'rgba(255,255,255,0.88)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {fit.sub.text}
                    </tspan>
                  )}
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
