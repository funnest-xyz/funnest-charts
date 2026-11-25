import type {
  BarColors,
  Extend,
  IndicatorFill,
  IndicatorGraphics,
  IndicatorOutput,
  IndicatorSeries,
  LineStyle,
  MarkLocation,
  MarkShape,
  MarkSize,
  TablePosition,
} from '../indicators/definitions.js';
import type { Painter } from './painter.js';
import type { PaneFrame, RenderModel } from './renderer.js';

/**
 * Everything an indicator draws in a pane: its series (line, step, area, circles, cross,
 * histogram, columns — a color per bar if it has one), fills, reference levels, and free-form
 * graphics (backgrounds, shapes, labels, lines, boxes, tables). Only what's on screen is visited.
 */

const NONE = 255;
const FONT_PX: Record<MarkSize, number> = { tiny: 9, small: 10, normal: 11, large: 13 };
const MARK_PX: Record<MarkSize, number> = { tiny: 3, small: 4.5, normal: 6, large: 9 };
/** Fills / backgrounds / box fills without their own alpha are painted this see-through. */
const FILL_ALPHA = 0.07;
const SHADE_ALPHA = 0.15;

interface Ctx {
  ctx: CanvasRenderingContext2D;
  p: Painter;
  m: RenderModel;
  pane: PaneFrame;
  n: number;
  /** Visible data indices (one beyond each edge). */
  from: number;
  to: number;
  x(i: number): number;
  y(v: number): number;
  color(c: string | undefined, fallback: string): string;
}

/** Whether a color carries its own alpha (#rrggbbaa, rgba(), hsla(), "… / 0.5"). */
export const hasAlpha = (c: string) => /^#[0-9a-f]{8}$/i.test(c) || /^#[0-9a-f]{4}$/i.test(c) || /^(rgba|hsla)\(/i.test(c) || c.includes('/');

/** A color at an opacity (0…1): '#rgb' / '#rrggbb' gain an alpha byte, 'rgb(…)' becomes 'rgba(…)'; others as they are. */
export function withAlpha(color: string, opacity: number): string {
  const a = Math.max(0, Math.min(1, opacity));
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex) {
    if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join('');
    return `#${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
  }
  const rgb = /^rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*\)$/i.exec(color);
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})` : color;
}

/** 'up' / 'down' (optionally 'up/0.2': with an opacity) as the palette's colors; anything else through `resolve`. */
export function resolveIndicatorColor(value: string, up: string, down: string, resolve: (v: string) => string): string {
  const m = /^(up|down)(?:\/([\d.]+))?$/.exec(value);
  if (!m) return resolve(value);
  const base = m[1] === 'up' ? up : down;
  return m[2] === undefined ? base : withAlpha(base, Number(m[2]));
}

const colorAt = (bc: BarColors | undefined, i: number): string | null => {
  if (!bc) return null;
  const k = bc.index[i];
  return k === undefined || k === NONE ? null : (bc.palette[k] ?? null);
};

function dashOf(style: LineStyle | undefined, width: number): number[] {
  if (style === 'dotted') return [Math.max(1, width), Math.max(2, width * 2)];
  if (style === 'dashed') return [width * 4 + 2, width * 3 + 1];
  return [];
}

function context(ctx: CanvasRenderingContext2D, p: Painter, m: RenderModel, pane: PaneFrame): Ctx {
  const { timeScale, frame } = m;
  const n = m.bars.length;
  return {
    ctx,
    p,
    m,
    pane,
    n,
    from: Math.max(0, frame.range.from - 1),
    to: Math.min(n - 1, frame.range.to + 1),
    x: (i) => timeScale.indexToX(i),
    y: (v) => pane.top + pane.scale.priceToY(v),
    color: (c, fallback) => (c ? m.color(c) : fallback),
  };
}

function withFont(c: Ctx, size: MarkSize, weight = ''): void {
  const base = c.m.frame.font;
  c.ctx.font = `${weight ? `${weight} ` : ''}${base.replace(/^(\d+ )?\d+(\.\d+)?px/, `${FONT_PX[size]}px`)}`;
}

// ── series ────────────────────────────────────────────────────────

/** Data indices to draw for a series shifted right by `shift` bars (into the empty space past the last bar). */
function span(c: Ctx, shift: number): [number, number] {
  const { timeScale, frame } = c.m;
  const lastX = Math.ceil(timeScale.xToIndexFloat(frame.plotWidth)) + 1;
  return [Math.max(0, frame.range.from - 1 - shift), Math.min(c.n - 1, (shift > 0 ? lastX : frame.range.to + 1) - shift)];
}

function drawBars(c: Ctx, s: IndicatorSeries): void {
  const { ctx, m } = c;
  const pal = m.frame.palette;
  const spacing = m.timeScale.barSpacing;
  const body = Math.max(1, Math.min(spacing - 1, spacing * 0.72));
  const zero = c.y(0);
  const shift = s.shift ?? 0;
  const [s0, s1] = span(c, shift);
  // Grouped by color: one path each.
  const paths = new Map<string, Path2D>();
  for (let i = s0; i <= s1; i++) {
    const v = s.values[i]!;
    if (Number.isNaN(v)) continue;
    const own = colorAt(s.colors, i);
    const color = own ? c.color(own, s.color) : s.kind === 'histogram' ? (v >= 0 ? pal.up : pal.down) : c.color(s.color, pal.accent);
    let path = paths.get(color);
    if (!path) paths.set(color, (path = new Path2D()));
    const yv = c.y(v);
    path.rect(c.x(i + shift) - body / 2, Math.min(yv, zero), body, Math.max(1, Math.abs(zero - yv)));
  }
  ctx.save();
  ctx.globalAlpha = s.kind === 'histogram' && !s.colors ? 0.6 : 0.85;
  for (const [color, path] of paths) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  ctx.restore();
}

function drawLine(c: Ctx, s: IndicatorSeries): void {
  const { ctx } = c;
  const shift = s.shift ?? 0;
  const [s0, s1] = span(c, shift);
  const base = c.color(s.color, c.m.frame.palette.accent);
  const step = s.kind === 'step';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s.width;
  ctx.setLineDash(dashOf(s.lineStyle, s.width));
  // One stroke per run of segments with the same color (a segment takes the color of the bar it ends on).
  let path: Path2D | null = null;
  let pathColor = '';
  const flush = () => {
    if (!path) return;
    ctx.strokeStyle = pathColor;
    ctx.stroke(path);
    path = null;
  };
  let prev: { x: number; y: number } | null = null;
  for (let i = s0; i <= s1; i++) {
    const v = s.values[i]!;
    if (Number.isNaN(v)) {
      prev = null;
      continue;
    }
    const pt = { x: c.x(i + shift), y: c.y(v) };
    if (prev) {
      const color = s.colors ? c.color(colorAt(s.colors, i) ?? undefined, base) : base;
      if (color !== pathColor || !path) {
        flush();
        path = new Path2D();
        pathColor = color;
        path.moveTo(prev.x, prev.y);
      }
      if (step) path.lineTo(pt.x, prev.y);
      path.lineTo(pt.x, pt.y);
    }
    prev = pt;
  }
  flush();
  if (s.kind === 'area') {
    // A shade from the line down to zero (or the pane's bottom edge when zero is off it).
    const bottom = c.pane.top + c.pane.height;
    const zeroY = Math.min(bottom, Math.max(c.pane.top, c.y(0)));
    ctx.globalAlpha = SHADE_ALPHA;
    ctx.fillStyle = base;
    let run: number[] = [];
    const fillRun = () => {
      if (run.length < 2) return void (run = []);
      ctx.beginPath();
      ctx.moveTo(c.x(run[0]! + shift), zeroY);
      for (const j of run) ctx.lineTo(c.x(j + shift), c.y(s.values[j]!));
      ctx.lineTo(c.x(run[run.length - 1]! + shift), zeroY);
      ctx.closePath();
      ctx.fill();
      run = [];
    };
    for (let i = s0; i <= s1; i++) {
      if (Number.isNaN(s.values[i]!)) fillRun();
      else run.push(i);
    }
    fillRun();
  }
  ctx.restore();
}

function drawPoints(c: Ctx, s: IndicatorSeries): void {
  const { ctx } = c;
  const shift = s.shift ?? 0;
  const [s0, s1] = span(c, shift);
  const base = c.color(s.color, c.m.frame.palette.accent);
  const r = Math.max(1.5, s.width + 0.5);
  ctx.save();
  ctx.lineWidth = Math.max(1, s.width);
  for (let i = s0; i <= s1; i++) {
    const v = s.values[i]!;
    if (Number.isNaN(v)) continue;
    const color = s.colors ? c.color(colorAt(s.colors, i) ?? undefined, base) : base;
    const x = c.x(i + shift), y = c.y(v);
    ctx.beginPath();
    if (s.kind === 'cross') {
      ctx.moveTo(x - r - 1, y);
      ctx.lineTo(x + r + 1, y);
      ctx.moveTo(x, y - r - 1);
      ctx.lineTo(x, y + r + 1);
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── fills and levels ──────────────────────────────────────────────

function drawFill(c: Ctx, output: IndicatorOutput, fill: IndicatorFill): void {
  const byKey = (key: string) => output.series.find((s) => s.key === key);
  const upperSeries = byKey(fill.upper);
  const lower = byKey(fill.lower)?.values;
  if (!upperSeries || !lower) return;
  const { ctx } = c;
  const upper = upperSeries.values;
  const shift = upperSeries.shift ?? 0;
  const [f0, f1] = span(c, shift);
  /** The color of bar j ('' = no fill there). */
  const colorOf = (j: number): string => {
    if (fill.colors) return colorAt(fill.colors, j) ?? '';
    return fill.downColor && lower[j]! > upper[j]! ? fill.downColor : fill.color;
  };
  const valid = (j: number) => !Number.isNaN(upper[j]!) && !Number.isNaN(lower[j]!) && colorOf(j) !== '';
  ctx.save();
  // One polygon per contiguous run of valid values of one color.
  let i = f0;
  while (i <= f1) {
    while (i <= f1 && !valid(i)) i++;
    if (i > f1) break;
    const start = i;
    const color = colorOf(i);
    while (i <= f1 && valid(i) && colorOf(i) === color) i++;
    // Overlap one bar into the next run so there's no gap where the color flips.
    const end = i <= f1 && valid(i) ? i + 1 : i;
    if (end - start < 2) continue;
    const resolved = c.color(color, color);
    ctx.globalAlpha = hasAlpha(resolved) ? 1 : FILL_ALPHA;
    ctx.fillStyle = resolved;
    ctx.beginPath();
    for (let j = start; j < end; j++) ctx.lineTo(c.x(j + shift), c.y(upper[j]!));
    for (let j = end - 1; j >= start; j--) ctx.lineTo(c.x(j + shift), c.y(lower[j]!));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLevels(c: Ctx, output: IndicatorOutput): void {
  const pal = c.m.frame.palette;
  const w = c.m.frame.plotWidth;
  for (const level of output.levels ?? []) {
    if (typeof level === 'number') {
      c.p.hLine(c.y(level), 0, w, pal.textSecondary, [3, 4]);
      continue;
    }
    if (!Number.isFinite(level.value)) continue;
    const color = c.color(level.color, pal.textSecondary);
    const y = c.y(level.value);
    const width = level.width ?? 1;
    const { ctx } = c;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashOf(level.style ?? 'dashed', width));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    if (level.label) {
      withFont(c, 'small');
      c.p.text(level.label, w - 6, y - 2, color, 'right', 'bottom');
    }
    ctx.restore();
  }
}

// ── graphics ──────────────────────────────────────────────────────

/** Background layers (call before the candles on the price pane, first thing in other panes). */
export function drawIndicatorBackgrounds(ctx: CanvasRenderingContext2D, p: Painter, m: RenderModel, pane: PaneFrame, output: IndicatorOutput): void {
  const layers = output.graphics?.backgrounds;
  if (!layers?.length || m.frame.range.to < m.frame.range.from) return;
  const c = context(ctx, p, m, pane);
  const half = m.timeScale.barSpacing / 2;
  ctx.save();
  for (const layer of layers) {
    let start = -1;
    let color = '';
    const flush = (end: number) => {
      if (start < 0) return;
      const resolved = c.color(color, color);
      ctx.globalAlpha = hasAlpha(resolved) ? 1 : SHADE_ALPHA;
      ctx.fillStyle = resolved;
      const x0 = c.x(start) - half;
      ctx.fillRect(x0, pane.top, c.x(end) + half - x0, pane.height);
      start = -1;
    };
    for (let i = c.from; i <= c.to; i++) {
      const own = colorAt(layer.colors, i);
      if (own !== color || own === null) flush(i - 1);
      if (own !== null && start < 0) {
        start = i;
        color = own;
      }
    }
    flush(c.to);
  }
  ctx.restore();
}

function shapePath(ctx: CanvasRenderingContext2D, shape: MarkShape, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'triangleup':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.8);
      ctx.lineTo(x - r, y + r * 0.8);
      break;
    case 'triangledown':
      ctx.moveTo(x, y + r);
      ctx.lineTo(x + r, y - r * 0.8);
      ctx.lineTo(x - r, y - r * 0.8);
      break;
    case 'arrowup':
    case 'arrowdown': {
      const d = shape === 'arrowup' ? 1 : -1;
      ctx.moveTo(x, y - r * d);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + r * 0.4, y);
      ctx.lineTo(x + r * 0.4, y + r * d);
      ctx.lineTo(x - r * 0.4, y + r * d);
      ctx.lineTo(x - r * 0.4, y);
      ctx.lineTo(x - r, y);
      break;
    }
    case 'square':
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      return;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      break;
    case 'flag':
      ctx.moveTo(x - r * 0.6, y + r);
      ctx.lineTo(x - r * 0.6, y - r);
      ctx.lineTo(x + r, y - r * 0.5);
      ctx.lineTo(x - r * 0.6, y);
      break;
    case 'cross':
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      return;
    case 'xcross':
      ctx.moveTo(x - r * 0.8, y - r * 0.8);
      ctx.lineTo(x + r * 0.8, y + r * 0.8);
      ctx.moveTo(x + r * 0.8, y - r * 0.8);
      ctx.lineTo(x - r * 0.8, y + r * 0.8);
      return;
    default:
      ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  }
  ctx.closePath();
}

/** Marks stack outward on the same bar and side instead of covering each other. */
function stacker(c: Ctx) {
  const used = new Map<string, number>();
  const onPrice = c.pane.kind === 'main';
  return (i: number, location: MarkLocation, size: number): number => {
    const loc = !onPrice && (location === 'above' || location === 'below') ? (location === 'above' ? 'top' : 'bottom') : location;
    const key = `${i}${loc}`;
    const k = used.get(key) ?? 0;
    used.set(key, k + size * 2 + 4);
    const bar = c.m.bars[Math.min(c.n - 1, Math.max(0, i))];
    switch (loc) {
      case 'above':
        return (bar ? c.y(bar.high) : c.pane.top) - 6 - size - k;
      case 'below':
        return (bar ? c.y(bar.low) : c.pane.top + c.pane.height) + 6 + size + k;
      case 'top':
        return c.pane.top + 6 + size + k;
      default:
        return c.pane.top + c.pane.height - 6 - size - k;
    }
  };
}

function drawShapes(c: Ctx, shapes: NonNullable<IndicatorGraphics['shapes']>, place: ReturnType<typeof stacker>): void {
  const { ctx } = c;
  const pal = c.m.frame.palette;
  ctx.save();
  withFont(c, 'small', '600');
  for (const s of shapes) {
    const color = c.color(s.color, pal.accent);
    const textColor = c.color(s.textColor, color);
    const r = MARK_PX[s.size] ?? MARK_PX.normal;
    for (let i = c.from; i <= c.to; i++) {
      if (s.when[i] !== 1) continue;
      const x = c.x(i);
      const y = s.location === 'price' ? (s.price ? c.y(s.price[i]!) : NaN) : place(i, s.location, r);
      if (!Number.isFinite(y)) continue;
      shapePath(ctx, s.shape, x, y, r);
      if (s.shape === 'cross' || s.shape === 'xcross') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
      if (s.text) {
        const under = s.location === 'below' || s.location === 'bottom' || (s.location === 'price' && (s.shape === 'triangleup' || s.shape === 'arrowup'));
        c.p.text(s.text, x, under ? y + r + 3 : y - r - 3, textColor, 'center', under ? 'top' : 'bottom');
      }
    }
  }
  ctx.restore();
}

function drawLabels(c: Ctx, labels: NonNullable<IndicatorGraphics['labels']>, place: ReturnType<typeof stacker>): void {
  const { ctx, p } = c;
  const pal = c.m.frame.palette;
  const w = c.m.frame.plotWidth;
  ctx.save();
  for (const l of labels) {
    const x = c.x(l.bar);
    if (x < -300 || x > w + 300) continue;
    withFont(c, l.size, l.style === 'box' ? '600' : '');
    const px = FONT_PX[l.size];
    const tw = p.measure(l.text) + (l.style === 'box' ? 12 : 0);
    const h = px + 8;
    const yMid = l.location === 'price' ? (l.price !== undefined ? c.y(l.price) : NaN) : place(l.bar, l.location, h / 2);
    if (!Number.isFinite(yMid)) continue;
    const left = l.align === 'right' ? x + 4 : l.align === 'left' ? x - 4 - tw : x - tw / 2;
    if (l.style === 'box') {
      p.roundRect(left, yMid - h / 2, tw, h, 4, c.color(l.color, pal.textSecondary));
      p.text(l.text, left + tw / 2, yMid, c.color(l.textColor, '#FFFFFF'), 'center', 'middle');
    } else p.text(l.text, left + tw / 2, yMid, c.color(l.textColor ?? l.color, pal.text), 'center', 'middle');
  }
  ctx.restore();
}

/** The far end of a segment pushed out to the pane's edge in its own direction. */
function extendPoint(ax: number, ay: number, bx: number, by: number, width: number): { x: number; y: number } {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return { x: bx, y: by };
  const k = 1e4 / Math.max(1e-9, Math.hypot(dx, dy)) + width;
  return { x: bx + dx * k, y: by + dy * k };
}

function drawSegments(c: Ctx, lines: NonNullable<IndicatorGraphics['lines']>): void {
  const { ctx } = c;
  const pal = c.m.frame.palette;
  const w = c.m.frame.plotWidth;
  ctx.save();
  ctx.lineCap = 'butt';
  for (const l of lines) {
    let a = { x: c.x(l.x1), y: c.y(l.y1) };
    let b = { x: c.x(l.x2), y: c.y(l.y2) };
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
    const ext: Extend = l.extend;
    if (ext === 'right' || ext === 'both') b = extendPoint(a.x, a.y, b.x, b.y, w);
    if (ext === 'left' || ext === 'both') a = extendPoint(b.x, b.y, a.x, a.y, w);
    if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > w) continue;
    ctx.strokeStyle = c.color(l.color, pal.accent);
    ctx.lineWidth = l.width;
    ctx.setLineDash(dashOf(l.style, l.width));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoxes(c: Ctx, boxes: NonNullable<IndicatorGraphics['boxes']>): void {
  const { ctx, p } = c;
  const pal = c.m.frame.palette;
  const w = c.m.frame.plotWidth;
  ctx.save();
  for (const b of boxes) {
    let x0 = c.x(b.left), x1 = c.x(b.right);
    if (b.extend === 'left' || b.extend === 'both') x0 = Math.min(x0, 0);
    if (b.extend === 'right' || b.extend === 'both') x1 = Math.max(x1, w);
    const y0 = c.y(b.top), y1 = c.y(b.bottom);
    if (![x0, x1, y0, y1].every(Number.isFinite) || Math.max(x0, x1) < 0 || Math.min(x0, x1) > w) continue;
    const rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.max(1, Math.abs(y1 - y0));
    if (b.bg) {
      const bg = c.color(b.bg, b.bg);
      ctx.globalAlpha = hasAlpha(bg) ? 1 : SHADE_ALPHA;
      ctx.fillStyle = bg;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.globalAlpha = 1;
    }
    if (b.color && b.width > 0) {
      ctx.strokeStyle = c.color(b.color, pal.accent);
      ctx.lineWidth = b.width;
      ctx.setLineDash(dashOf(b.style, b.width));
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
    if (b.text) {
      withFont(c, 'small');
      p.text(b.text, Math.max(rx, 0) + Math.min(rw, w) / 2, ry + rh / 2, c.color(b.textColor, pal.text), 'center', 'middle');
    }
  }
  ctx.restore();
}

/** Tables pinned to the pane's corners and edges (drawn last, over everything). */
export function drawIndicatorTables(ctx: CanvasRenderingContext2D, p: Painter, m: RenderModel, pane: PaneFrame, output: IndicatorOutput): void {
  const tables = output.graphics?.tables;
  if (!tables?.length) return;
  const c = context(ctx, p, m, pane);
  const pal = m.frame.palette;
  const W = m.frame.plotWidth;
  ctx.save();
  const pad = 7, gap = 6, edge = 8;
  // Measure first: tables on the same side (left / center / right) are stacked, not overlapped.
  const laid = tables
    .filter((t) => t.rows.length)
    .map((t) => {
      withFont(c, t.size);
      const rowH = FONT_PX[t.size] + 9;
      const cols = Math.max(...t.rows.map((r) => r.length));
      const widths = Array.from({ length: cols }, (_, k) => Math.max(0, ...t.rows.map((r) => (r[k] ? p.measure(r[k]!.text) : 0))) + pad * 2);
      const [v, h] = t.position.split('-') as [string, string];
      return { t, rowH, widths, tw: widths.reduce((a, b) => a + b, 0), th: rowH * t.rows.length, v, h, y0: 0 };
    });
  for (const side of ['left', 'center', 'right']) {
    const group = laid.filter((x) => x.h === side);
    const order = ['top', 'middle', 'bottom'];
    group.sort((a, b) => order.indexOf(a.v) - order.indexOf(b.v));
    const total = group.reduce((s, x) => s + x.th, 0) + gap * Math.max(0, group.length - 1);
    if (total > pane.height - edge * 2) {
      // Too tall together: one after another from the top (the last ones run off the bottom).
      let y = pane.top + edge;
      for (const x of group) (x.y0 = y), (y += x.th + gap);
      continue;
    }
    let top = pane.top + edge;
    for (const x of group.filter((g) => g.v === 'top')) (x.y0 = top), (top += x.th + gap);
    let bottom = pane.top + pane.height - edge;
    for (const x of group.filter((g) => g.v === 'bottom').reverse()) (x.y0 = bottom - x.th), (bottom -= x.th + gap);
    const middle = group.filter((g) => g.v === 'middle');
    const mh = middle.reduce((s, x) => s + x.th, 0) + gap * Math.max(0, middle.length - 1);
    let y = Math.min(Math.max(top, pane.top + (pane.height - mh) / 2), bottom + gap - mh);
    for (const x of middle) (x.y0 = y), (y += x.th + gap);
  }
  for (const { t, rowH, widths, tw, th, h, y0 } of laid) {
    withFont(c, t.size);
    const x0 = h === 'left' ? edge : h === 'right' ? W - tw - edge : (W - tw) / 2;
    // The chart's own background, nearly opaque: readable on dark and light themes alike.
    ctx.fillStyle = c.color(t.bg, withAlpha(pal.background, 0.9));
    ctx.fillRect(x0, y0, tw, th);
    t.rows.forEach((row, r) => {
      let x = x0;
      row.forEach((cell, k) => {
        const cw = widths[k]!;
        if (cell.bg) {
          ctx.fillStyle = c.color(cell.bg, cell.bg);
          ctx.fillRect(x, y0 + r * rowH, cw, rowH);
        }
        const align = cell.align ?? (k === 0 ? 'left' : 'right');
        const tx = align === 'left' ? x + pad : align === 'right' ? x + cw - pad : x + cw / 2;
        p.text(cell.text, tx, y0 + r * rowH + rowH / 2, c.color(cell.color ?? t.textColor, pal.text), align, 'middle');
        x += cw;
      });
    });
    ctx.strokeStyle = c.color(t.border, pal.border);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, tw - 1, th - 1);
  }
  ctx.restore();
}

/**
 * Levels, fills, series and graphics of one indicator inside `pane` (backgrounds and tables are
 * separate calls: under the candles / over everything).
 */
export function drawIndicator(ctx: CanvasRenderingContext2D, p: Painter, m: RenderModel, pane: PaneFrame, output: IndicatorOutput): void {
  if (m.frame.range.to < m.frame.range.from) return;
  const c = context(ctx, p, m, pane);
  drawLevels(c, output);
  for (const fill of [output.fill, ...(output.fills ?? [])]) if (fill) drawFill(c, output, fill);
  for (const s of output.series) if (s.visible !== false && (s.kind === 'histogram' || s.kind === 'columns')) drawBars(c, s);
  for (const s of output.series) {
    if (s.visible === false) continue;
    if (s.kind === 'line' || s.kind === 'step' || s.kind === 'area') drawLine(c, s);
    else if (s.kind === 'circles' || s.kind === 'cross') drawPoints(c, s);
  }
  const g = output.graphics;
  if (!g) return;
  if (g.boxes?.length) drawBoxes(c, g.boxes);
  if (g.lines?.length) drawSegments(c, g.lines);
  const place = stacker(c);
  if (g.shapes?.length) drawShapes(c, g.shapes, place);
  if (g.labels?.length) drawLabels(c, g.labels, place);
}

/** Candle colors set by indicators over the candles (the last one with a color for a bar wins). */
export function barColorOf(overlays: readonly IndicatorOutput[], i: number): string | null {
  let out: string | null = null;
  for (const o of overlays) out = colorAt(o.barColors, i) ?? out;
  return out;
}

/** Prices an indicator's graphics reach between bars `from`..`to` (for scaling a pane that has little else). */
export function graphicsRange(g: IndicatorGraphics | undefined, from: number, to: number): [number, number] | null {
  if (!g) return null;
  let lo = Infinity, hi = -Infinity;
  const take = (v: number | undefined) => {
    if (v === undefined || !Number.isFinite(v)) return;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  };
  for (const s of g.shapes ?? []) if (s.price) for (let i = from; i <= to; i++) if (s.when[i] === 1) take(s.price[i]);
  for (const l of g.labels ?? []) if (l.bar >= from && l.bar <= to) take(l.price);
  for (const l of g.lines ?? []) if (Math.max(l.x1, l.x2) >= from && Math.min(l.x1, l.x2) <= to) (take(l.y1), take(l.y2));
  for (const b of g.boxes ?? []) if (b.extend !== 'none' || (b.right >= from && b.left <= to)) (take(b.top), take(b.bottom));
  return lo <= hi ? [lo, hi] : null;
}
