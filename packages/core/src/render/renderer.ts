import type { PriceScale } from '../model/price-scale.js';
import type { TimeTick } from '../model/time-format.js';
import type { IndexRange, TimeScale } from '../model/time-scale.js';
import type { Bar } from '../types.js';
import type { CanvasLayer } from './canvas-layer.js';
import { Painter } from './painter.js';
import { heikinAshi } from './heikin-ashi.js';
import type { DrawingManager } from '../objects/drawings.js';
import type { TradingLabels, TradingLayer } from '../objects/trading.js';
import type { AxisBadge, ChartOverlay, PaneCoords } from '../objects/types.js';
import type { IndicatorOutput } from '../indicators/definitions.js';
import type { ChartSettings } from '../settings.js';
import { barColorOf, drawIndicator, drawIndicatorBackgrounds, drawIndicatorTables } from './indicator-draw.js';

/**
 * candles · hollow (속 빈 캔들: hollow when it closed above its open, colored by the close against
 * the previous close) · heikin (하이킨아시, render/heikin-ashi.ts) · line · area.
 */
/**
 * 'bars': OHLC bars (a high–low line, the open's tick left, the close's right). 'baseline': the
 * close as a line, filled up-colored above the first visible close and down-colored below.
 * 'step': the close held flat until the next one (a staircase).
 */
/**
 * 'volumeCandles': candles as wide as their volume (the busiest on screen the widest).
 * 'renko' · 'kagi' · 'lineBreak' · 'pnf': drawn from price moves, not time (model/price-bars.ts).
 */
export type ChartType = 'candles' | 'hollow' | 'heikin' | 'bars' | 'line' | 'step' | 'baseline' | 'area' | 'volumeCandles' | 'renko' | 'kagi' | 'lineBreak' | 'pnf';

/** 'main', 'volume', or an indicator id for indicator panes. */
export type PaneId = string;

export interface PaneFrame {
  id: PaneId;
  kind: 'main' | 'volume' | 'indicator';
  top: number;
  height: number;
  scale: PriceScale;
  /** Values for grid lines and axis labels. */
  ticks: number[];
  /** Crosshair/value label format. */
  format(value: number): string;
  /** Axis tick label format (defaults to `format`). */
  tickFormat?: (value: number) => string;
  indicator?: IndicatorOutput;
}

export interface Palette {
  background: string;
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  accent: string;
}

/** Everything computed once per full frame; shared by the main and overlay passes. */
export interface Frame {
  width: number;
  height: number;
  plotWidth: number;
  panesHeight: number;
  timeAxisHeight: number;
  panes: PaneFrame[];
  range: IndexRange;
  priceTicks: number[];
  timeTicks: TimeTick[];
  highLow: { highIndex: number; lowIndex: number } | null;
  settings: ChartSettings;
  /** Indicators drawn over the candles. */
  overlays: IndicatorOutput[];
  palette: Palette;
  font: string;
  radius: number;
  /** Time left in the current bar ("04:59"), shown under the last-price badge. */
  countdown: string | null;
  /** Pre-market / after-hours price (its own dotted line and badge), with the word for its session. */
  extendedPrice: { price: number; session: 'pre' | 'post'; label: string } | null;
  /** x ranges (plot pixels) of intraday bars outside the regular session, shaded. */
  sessionShade: [number, number][];
}

export interface CrosshairInfo {
  index: number;
  time: number;
  bar: Bar;
  /** Price (main pane) or volume (volume pane) under the crosshair. */
  value: number;
  pane: PaneId;
  x: number;
  y: number;
  /** 'sync': mirrored from a linked chart (setSyncedCrosshair) — time only, `y` is -1. */
  source: 'mouse' | 'touch' | 'sync';
}

/** Fill details shown next to an execution marker. */
export interface Tooltip {
  x: number;
  y: number;
  side: 'buy' | 'sell';
  lines: string[];
}

/**
 * How the pointer shows over the chart: 'cross' dashed lines through it (default), 'dot' a dot,
 * 'arrow' the normal arrow, 'demo' a big highlighted spot (for recordings), 'eraser' an eraser that
 * deletes the drawing it clicks. All but 'demo' keep the price / time badges on the axes.
 */
export type CursorMode = 'cross' | 'dot' | 'arrow' | 'demo' | 'eraser';

export interface RenderModel {
  frame: Frame;
  /** The pointer's look (a drawing tool in use always shows the cross). */
  cursorMode?: CursorMode;
  /** Where the mouse is, unsnapped (the dot and demo cursors follow it). */
  pointer?: { x: number; y: number } | null;
  bars: readonly Bar[];
  /** Price-move charts: their box, and kagi's thick / thin lines. */
  priceBars?: { box: number; yang?: Uint8Array; cross?: Float64Array } | null;
  /** The bar the last-price line reads, when it isn't the last one drawn (price-move charts: the price now). */
  lastBar?: Bar | null;
  timeScale: TimeScale;
  formatPrice(price: number): string;
  formatVolume(volume: number): string;
  /** An indicator color for the canvas: CSS variables resolved, 'up' / 'down' the palette's. */
  color(value: string): string;
  formatCrosshairTime(time: number): string;
  labels: { high: string; low: string };
  chartType: ChartType;
  /** Replay start picking: the area right of the crosshair is shaded. */
  replaySelecting?: boolean;
  objects: {
    coords: PaneCoords;
    overlays: readonly ChartOverlay[];
    drawings: DrawingManager;
    trading: TradingLayer;
    tradingLabels: TradingLabels;
    barIndexAt(time: number): number;
  };
}

const VOLUME_ALPHA = 0.35;
const BADGE_HEIGHT = 20;
const DASH: readonly [number, number] = [4, 4];
const DOT: readonly [number, number] = [2, 3];
/** Pre-market and after-hours lines: apart from the up/down colors (red/blue here, green/red elsewhere). */
/** A dark background (#rgb / #rrggbb / rgb()), for a shade that shows on it. */
function isDarkColor(color: string): boolean {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  let rgb: number[] | null = null;
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split('').map((x) => x + x).join('') : hex[1]!;
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (m) rgb = m[1]!.split(',').slice(0, 3).map((x) => Number(x));
  }
  return !!rgb && 0.299 * rgb[0]! + 0.587 * rgb[1]! + 0.114 * rgb[2]! < 128;
}
const EXT_PRE = '#F08C00';
const EXT_POST = '#8B5CF6';

/** Candle geometry in device pixels: wick width and an odd/even-matched body so the wick stays centered. */
function barGeometry(barSpacing: number, dpr: number): { wick: number; body: number } {
  const spacing = barSpacing * dpr;
  const wick = Math.max(1, Math.floor(dpr));
  let body = Math.floor(spacing * 0.72);
  if (spacing >= 3) body = Math.min(body, Math.floor(spacing) - 1);
  body = Math.max(wick, body);
  if ((body - wick) % 2 !== 0) body -= 1;
  return { wick, body };
}

function drawCandles(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame, bars: readonly Bar[] = m.bars, byVolume = false, boxes = false): void {
  const { timeScale, frame } = m;
  const { from, to } = frame.range;
  const geometry = barGeometry(timeScale.barSpacing, dpr);
  const { wick } = geometry;
  // Bricks and lines fill their slot but for a hairline between them.
  const full = Math.max(wick, Math.floor(timeScale.barSpacing * dpr) - Math.max(1, Math.round(dpr)));
  const body = boxes ? full - ((full - wick) % 2) : geometry.body;
  const half = wick >> 1;
  const inset = (body - wick) / 2;
  // 거래량 캔들: a body as wide as its volume against the busiest one on screen (a quarter at least).
  let most = 0;
  if (byVolume) for (let i = from; i <= to; i++) most = Math.max(most, bars[i]?.volume ?? 0);
  const widthOf = (i: number) => {
    if (!byVolume || !(most > 0)) return body;
    const w = Math.round(body * (0.25 + 0.75 * Math.min(1, (bars[i]!.volume ?? 0) / most)));
    return Math.max(wick, w - ((w - wick) % 2));
  };
  const s = pane.scale;
  const y = (price: number) => Math.round((pane.top + s.priceToY(price)) * dpr);

  // Candles an indicator recolors (barColors) are drawn in their own color, the rest up / down.
  const own = frame.overlays.some((o) => o.barColors) ? (i: number) => barColorOf(frame.overlays, i) : null;
  const custom = new Map<string, number[]>();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (own)
    for (let i = from; i <= to; i++) {
      const color = own(i);
      if (color) (custom.get(color) ?? custom.set(color, []).get(color)!).push(i);
    }
  const paint = (indices: Iterable<number>) => {
    for (const i of indices) {
      const bar = bars[i]!;
      const left = Math.round(timeScale.indexToX(i) * dpr) - half;
      const yHigh = y(bar.high);
      const yLow = y(bar.low);
      ctx.rect(left, yHigh, wick, Math.max(1, yLow - yHigh));
      const w = widthOf(i);
      if (w > wick) {
        const yOpen = y(bar.open);
        const yClose = y(bar.close);
        const top = Math.min(yOpen, yClose);
        ctx.rect(left - (w - wick) / 2, top, w, Math.max(1, Math.max(yOpen, yClose) - top));
      }
    }
  };
  const recolored = new Set([...custom.values()].flat());
  for (const up of [true, false]) {
    ctx.beginPath();
    const indices: number[] = [];
    for (let i = from; i <= to; i++) if (bars[i]!.close >= bars[i]!.open === up && !recolored.has(i)) indices.push(i);
    paint(indices);
    ctx.fillStyle = up ? frame.palette.up : frame.palette.down;
    ctx.fill();
  }
  for (const [color, indices] of custom) {
    ctx.beginPath();
    paint(indices);
    ctx.fillStyle = m.color(color);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Kagi: each line straight up or down from where the last one turned, joined by a short level
 * step; thick in the up color once it has risen past the last shoulder (양), thin in the down
 * color once it has fallen past the last waist (음) — a line that crosses one changes there.
 */
function drawKagi(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const yang = m.priceBars?.yang;
  const cross = m.priceBars?.cross;
  const y = (price: number) => (pane.top + pane.scale.priceToY(price)) * dpr;
  const x = (i: number) => timeScale.indexToX(i) * dpr;
  const thickW = Math.max(2, Math.round(2.5 * dpr));
  const thinW = Math.max(1, Math.round(dpr));
  const seg = (x1: number, y1: number, x2: number, y2: number, thick: boolean) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = thick ? thickW : thinW;
    ctx.strokeStyle = thick ? frame.palette.up : frame.palette.down;
    ctx.stroke();
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'square';
  for (let i = Math.max(0, from - 1); i <= to; i++) {
    const b = bars[i];
    if (!b) continue;
    const end = yang ? yang[i] === 1 : b.close >= b.open;
    const turn = cross?.[i];
    const before = Number.isFinite(turn) ? !end : end;
    // The step over from the last line's end, at its level, in that line's state.
    if (i > 0) seg(x(i - 1), y(b.open), x(i), y(b.open), yang ? yang[i - 1] === 1 : bars[i - 1]!.close >= bars[i - 1]!.open);
    if (Number.isFinite(turn)) {
      seg(x(i), y(b.open), x(i), y(turn!), before);
      seg(x(i), y(turn!), x(i), y(b.close), end);
    } else seg(x(i), y(b.open), x(i), y(b.close), end);
  }
  ctx.restore();
}

/** P&F: a column of X boxes (rising, up color) or O boxes (falling, down color) per bar. */
function drawPointFigure(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const box = m.priceBars?.box ?? 0;
  if (!(box > 0)) return;
  const y = (price: number) => (pane.top + pane.scale.priceToY(price)) * dpr;
  const boxPx = Math.abs(y(0) - y(box));
  const size = Math.max(2, Math.min(timeScale.barSpacing * dpr * 0.8, boxPx * 0.85));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = Math.max(1, Math.round(dpr * (size > 10 * dpr ? 1.5 : 1)));
  for (const up of [true, false]) {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const b = bars[i];
      if (!b || b.close > b.open !== up) continue;
      const cx = timeScale.indexToX(i) * dpr;
      const n = Math.round((b.high - b.low) / box);
      // Too many to tell apart: one bar for the column.
      if (boxPx < 3) {
        ctx.moveTo(cx, y(b.low));
        ctx.lineTo(cx, y(b.high));
        continue;
      }
      for (let k = 0; k < n; k++) {
        const cy = y(b.low + (k + 0.5) * box);
        const r = size / 2;
        if (up) {
          ctx.moveTo(cx - r, cy - r);
          ctx.lineTo(cx + r, cy + r);
          ctx.moveTo(cx + r, cy - r);
          ctx.lineTo(cx - r, cy + r);
        } else {
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
    }
    ctx.strokeStyle = up ? frame.palette.up : frame.palette.down;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 속 빈 캔들 (TradingView's hollow candles): the color says whether it closed above the previous
 * close (up) or below (down); a hollow body says it closed above its own open, a filled one below.
 */
function drawHollowCandles(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const { wick, body } = barGeometry(timeScale.barSpacing, dpr);
  const half = wick >> 1;
  const inset = (body - wick) / 2;
  const s = pane.scale;
  const y = (price: number) => Math.round((pane.top + s.priceToY(price)) * dpr);
  // An outline as wide as the wick, kept inside the body (so hollow and filled bodies line up).
  const line = Math.max(1, wick);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const up of [true, false]) {
    const color = up ? frame.palette.up : frame.palette.down;
    const filled: number[] = [];
    const hollow: number[] = [];
    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      const prev = bars[i - 1];
      if ((prev ? bar.close >= prev.close : bar.close >= bar.open) !== up) continue;
      (bar.close > bar.open && body > wick + 2 * line ? hollow : filled).push(i);
    }
    const solid = new Set(filled);
    ctx.beginPath();
    for (const i of [...filled, ...hollow]) {
      const bar = bars[i]!;
      const left = Math.round(timeScale.indexToX(i) * dpr) - half;
      const yOpen = y(bar.open);
      const yClose = y(bar.close);
      const top = Math.min(yOpen, yClose);
      const bottom = Math.max(yOpen, yClose);
      const yHigh = y(bar.high);
      const yLow = y(bar.low);
      // The wick above and below the body (not through a hollow one).
      if (body > wick) {
        ctx.rect(left, yHigh, wick, Math.max(0, top - yHigh));
        ctx.rect(left, bottom, wick, Math.max(0, yLow - bottom));
      } else ctx.rect(left, yHigh, wick, Math.max(1, yLow - yHigh));
      if (body <= wick) continue;
      const h = Math.max(1, bottom - top);
      if (solid.has(i) || h <= 2 * line) ctx.rect(left - inset, top, body, h);
      else {
        // A frame: four sides of the body.
        ctx.rect(left - inset, top, body, line);
        ctx.rect(left - inset, top + h - line, body, line);
        ctx.rect(left - inset, top + line, line, h - 2 * line);
        ctx.rect(left - inset + body - line, top + line, line, h - 2 * line);
      }
    }
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

/** Close-price line, optionally with a gradient area fill underneath. */
/** OHLC bars: a high–low line with the open's tick on the left and the close's on the right. */
function drawOhlcBars(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const { wick, body } = barGeometry(timeScale.barSpacing, dpr);
  const half = wick >> 1;
  // Ticks reach half the body's width each side (at least a pixel or two when zoomed out).
  const tick = Math.max(wick, Math.floor(body / 2));
  const y = (price: number) => Math.round((pane.top + pane.scale.priceToY(price)) * dpr);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const up of [true, false]) {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      if (bar.close >= bar.open !== up) continue;
      const left = Math.round(timeScale.indexToX(i) * dpr) - half;
      const yHigh = y(bar.high);
      ctx.rect(left, yHigh, wick, Math.max(1, y(bar.low) - yHigh));
      if (body <= wick) continue;
      ctx.rect(left - tick, y(bar.open) - half, tick, wick);
      ctx.rect(left + wick, y(bar.close) - half, tick, wick);
    }
    ctx.fillStyle = up ? frame.palette.up : frame.palette.down;
    ctx.fill();
  }
  ctx.restore();
}

/** The close as a line over a baseline (the first visible close): up-colored above, down-colored below. */
function drawBaseline(ctx: CanvasRenderingContext2D, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const from = Math.max(0, frame.range.from - 1);
  const to = Math.min(bars.length - 1, frame.range.to + 1);
  if (to < from) return;
  const base = bars[Math.max(0, frame.range.from)]!.close;
  const yBase = pane.top + pane.scale.priceToY(base);
  const points: [number, number][] = [];
  for (let i = from; i <= to; i++) points.push([timeScale.indexToX(i), pane.top + pane.scale.priceToY(bars[i]!.close)]);
  const path = () => {
    ctx.beginPath();
    points.forEach(([x, py], k) => (k === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py)));
  };
  ctx.save();
  for (const up of [true, false]) {
    const color = up ? frame.palette.up : frame.palette.down;
    ctx.save();
    // Above the baseline for the up color, below it for the down color.
    ctx.beginPath();
    if (up) ctx.rect(0, pane.top, timeScale.indexToX(to) + 2, yBase - pane.top);
    else ctx.rect(0, yBase, timeScale.indexToX(to) + 2, pane.top + pane.height - yBase);
    ctx.clip();
    path();
    ctx.lineTo(points.at(-1)![0], yBase);
    ctx.lineTo(points[0]![0], yBase);
    ctx.closePath();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    path();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }
  // The baseline itself, dotted.
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(0, Math.round(yBase) + 0.5);
  ctx.lineTo(timeScale.indexToX(to), Math.round(yBase) + 0.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = frame.palette.grid;
  ctx.stroke();
  ctx.restore();
}

function drawLineSeries(ctx: CanvasRenderingContext2D, m: RenderModel, pane: PaneFrame, area: boolean, step = false): void {
  const { bars, timeScale, frame } = m;
  // Include one bar beyond each edge so the line runs off-screen instead of stopping short.
  const from = Math.max(0, frame.range.from - 1);
  const to = Math.min(bars.length - 1, frame.range.to + 1);
  if (to < from) return;
  const color = frame.palette.accent;
  ctx.save();
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const x = timeScale.indexToX(i);
    const y = pane.top + pane.scale.priceToY(bars[i]!.close);
    if (i === from) ctx.moveTo(x, y);
    else {
      // A staircase: across at the last close, then up or down to this one.
      if (step) ctx.lineTo(x, pane.top + pane.scale.priceToY(bars[i - 1]!.close));
      ctx.lineTo(x, y);
    }
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (area) {
    const bottom = pane.top + pane.height;
    ctx.lineTo(timeScale.indexToX(to), bottom);
    ctx.lineTo(timeScale.indexToX(from), bottom);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, pane.top, 0, bottom);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = gradient;
    ctx.fill();
  }
  ctx.restore();
}

/** Device pixel ratio of a context whose base transform is a dpr scale. */
const layerDpr = (ctx: CanvasRenderingContext2D) => ctx.getTransform().a || 1;

function drawVolume(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const { wick, body } = barGeometry(timeScale.barSpacing, dpr);
  const half = wick >> 1;
  const inset = (body - wick) / 2;
  const bottom = Math.round((pane.top + pane.height) * dpr);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = VOLUME_ALPHA;
  for (const up of [true, false]) {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      if (!bar.volume || bar.close >= bar.open !== up) continue;
      const left = Math.round(timeScale.indexToX(i) * dpr) - half - inset;
      const top = Math.round((pane.top + pane.scale.priceToY(bar.volume)) * dpr);
      ctx.rect(left, top, body, Math.max(1, bottom - top));
    }
    ctx.fillStyle = up ? frame.palette.up : frame.palette.down;
    ctx.fill();
  }
  ctx.restore();
}

/** "최고 72,300 ─" markers at the visible extremes, pointing toward the chart center. */
function drawHighLow(p: Painter, m: RenderModel, pane: PaneFrame): void {
  const { frame, bars, timeScale } = m;
  if (!frame.highLow) return;
  const marks = [
    { index: frame.highLow.highIndex, price: bars[frame.highLow.highIndex]!.high, label: m.labels.high },
    { index: frame.highLow.lowIndex, price: bars[frame.highLow.lowIndex]!.low, label: m.labels.low },
  ];
  for (const mark of marks) {
    const x = timeScale.indexToX(mark.index);
    const y = pane.top + Math.min(pane.height - 8, Math.max(8, pane.scale.priceToY(mark.price)));
    const toLeft = x > frame.plotWidth / 2;
    const dir = toLeft ? -1 : 1;
    const text = `${mark.label} ${m.formatPrice(mark.price)}`;
    p.hLine(y, Math.min(x, x + dir * 12), Math.max(x, x + dir * 12), frame.palette.textSecondary);
    p.text(text, x + dir * 16, y, frame.palette.textSecondary, toLeft ? 'right' : 'left');
  }
}

export function drawMain(layer: CanvasLayer, m: RenderModel): void {
  const ctx = layer.begin();
  const p = new Painter(ctx, layer.dpr);
  const f = m.frame;
  const pal = f.palette;
  const main = f.panes[0]!;
  // Anywhere among the lower panes: the user can move it below indicators.
  const volume = f.panes.find((x) => x.kind === 'volume');

  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, f.width, f.height);
  ctx.font = f.font;

  // Pre-market / after-hours bars: a faint band behind them, through every pane.
  if (f.sessionShade.length) {
    ctx.save();
    ctx.fillStyle = isDarkColor(pal.background) ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.05)';
    for (const [x0, x1] of f.sessionShade) ctx.fillRect(x0, 0, x1 - x0, f.panesHeight);
    ctx.restore();
  }

  // Grid
  const gridH = f.settings.gridHorizontal;
  for (const price of gridH ? f.priceTicks : []) {
    const y = main.scale.priceToY(price);
    if (y > 0 && y < main.height) p.hLine(y, 0, f.plotWidth, pal.grid);
  }
  // The volume pane has no labels of its own; continue the price grid's rhythm through it
  // so the background reads as one continuous grid.
  const [t0, t1] = f.priceTicks;
  if (gridH && volume && volume.kind === 'volume' && t0 !== undefined && t1 !== undefined) {
    const step = Math.abs(main.scale.priceToY(t1) - main.scale.priceToY(t0));
    if (step >= 8) {
      const phase = main.scale.priceToY(t0);
      let y = phase + Math.ceil((volume.top - phase) / step) * step;
      if (y <= volume.top) y += step;
      const bottom = volume.top + volume.height;
      // Skip lines hugging the pane edges; they read as a doubled border.
      for (; y < bottom; y += step) if (y - volume.top > 10 && bottom - y > 10) p.hLine(y, 0, f.plotWidth, pal.grid);
    }
  }
  if (f.settings.gridVertical) for (const tick of f.timeTicks) p.vLine(tick.x, 0, f.panesHeight, pal.grid);

  // App overlays that sit under the series (layer: 'below')
  const o = m.objects;
  const rc = { painter: p, coords: o.coords, palette: pal };
  const runOverlay = (overlay: (typeof o.overlays)[number]) => {
    ctx.save();
    try {
      overlay.render(rc);
    } catch (error) {
      console.error('[fnc] overlay', error);
    }
    ctx.restore();
  };
  if (o.overlays.some((x) => x.layer === 'below')) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, main.top, f.plotWidth, main.height);
    ctx.clip();
    for (const overlay of o.overlays) if (overlay.layer === 'below') runOverlay(overlay);
    ctx.restore();
  }

  // Series
  const hasBars = f.range.to >= f.range.from;
  if (hasBars) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, main.top, f.plotWidth, main.height);
    ctx.clip();
    for (const overlay of f.overlays) drawIndicatorBackgrounds(ctx, p, m, main, overlay);
    if (m.chartType === 'candles') drawCandles(ctx, layer.dpr, m, main);
    else if (m.chartType === 'renko' || m.chartType === 'lineBreak') drawCandles(ctx, layer.dpr, m, main, m.bars, false, true);
    else if (m.chartType === 'volumeCandles') drawCandles(ctx, layer.dpr, m, main, m.bars, true);
    else if (m.chartType === 'kagi') drawKagi(ctx, layer.dpr, m, main);
    else if (m.chartType === 'pnf') drawPointFigure(ctx, layer.dpr, m, main);
    else if (m.chartType === 'heikin') drawCandles(ctx, layer.dpr, m, main, heikinAshi(m.bars));
    else if (m.chartType === 'hollow') drawHollowCandles(ctx, layer.dpr, m, main);
    else if (m.chartType === 'bars') drawOhlcBars(ctx, layer.dpr, m, main);
    else if (m.chartType === 'baseline') drawBaseline(ctx, m, main);
    else drawLineSeries(ctx, m, main, m.chartType === 'area', m.chartType === 'step');
    for (const overlay of f.overlays) drawIndicator(ctx, p, m, main, overlay);
    if (f.settings.highLowMarkers) drawHighLow(p, m, main);
    for (const overlay of f.overlays) drawIndicatorTables(ctx, p, m, main, overlay);
    ctx.restore();

    if (volume && volume.kind === 'volume' && volume.height > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, volume.top, f.plotWidth, volume.height);
      ctx.clip();
      drawVolume(ctx, layer.dpr, m, volume);
      ctx.restore();
    }
  }

  // Indicator panes
  for (const pane of f.panes) {
    if (pane.kind !== 'indicator' || !pane.indicator) continue;
    for (const v of gridH ? pane.ticks : []) {
      const y = pane.top + pane.scale.priceToY(v);
      if (y > pane.top && y < pane.top + pane.height) p.hLine(y, 0, f.plotWidth, pal.grid);
    }
    if (!hasBars) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pane.top, f.plotWidth, pane.height);
    ctx.clip();
    drawIndicatorBackgrounds(ctx, p, m, pane, pane.indicator);
    drawIndicator(ctx, p, m, pane, pane.indicator);
    drawIndicatorTables(ctx, p, m, pane, pane.indicator);
    ctx.restore();
  }

  // Drawings and trading lines (clipped to the price pane; their axis badges come later)
  const badges: AxisBadge[] = [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, main.top, f.plotWidth, main.height);
  ctx.clip();
  for (const overlay of o.overlays) if (overlay.layer !== 'below') runOverlay(overlay);
  o.trading.render(rc, m.bars, o.barIndexAt, (i) => m.timeScale.indexToX(i), o.tradingLabels, badges);
  o.drawings.render(rc, badges, m.bars, o.barIndexAt);
  ctx.restore();

  // Last price line
  const last = f.settings.lastPriceLine ? (m.lastBar ?? m.bars[m.bars.length - 1]) : undefined;
  const lastColor = last && last.close >= last.open ? pal.up : pal.down;
  const lastY = last ? main.scale.priceToY(last.close) : NaN;
  if (last && lastY >= 0 && lastY <= main.height) p.hLine(lastY, 0, f.plotWidth, lastColor, DOT);

  // Pre-market (orange) / after-hours (purple) price: a dotted line, its word at the right end.
  const ext = f.extendedPrice;
  const extColor = ext?.session === 'pre' ? EXT_PRE : EXT_POST;
  const extY = ext ? main.scale.priceToY(ext.price) : NaN;
  const extShown = !!ext && extY >= 0 && extY <= main.height;
  if (extShown) {
    p.hLine(extY, 0, f.plotWidth, extColor, DOT);
    p.text(ext!.label, f.plotWidth - 6, extY - 9, extColor, 'right');
  }

  // Frame lines
  for (const pane of f.panes) if (pane.kind !== 'main') p.hLine(pane.top, 0, f.plotWidth, pal.border);
  p.vLine(f.plotWidth, 0, f.panesHeight, pal.border);
  p.hLine(f.panesHeight, 0, f.width, pal.border);

  // Price axis labels (skipping any hidden behind the last-price badge)
  const labelX = f.plotWidth + 8;
  for (const price of f.priceTicks) {
    const y = main.scale.priceToY(price);
    if (y < 8 || y > main.height - 8) continue;
    if (last && y > lastY - BADGE_HEIGHT && y < lastY + (f.countdown ? BADGE_HEIGHT * 2 - 4 : BADGE_HEIGHT)) continue;
    if (extShown && Math.abs(y - extY) < BADGE_HEIGHT) continue;
    p.text((main.tickFormat ?? m.formatPrice)(price), labelX, y, pal.textSecondary);
  }

  // Indicator pane axis labels
  for (const pane of f.panes) {
    if (pane.kind !== 'indicator') continue;
    for (const v of pane.ticks) {
      const y = pane.top + pane.scale.priceToY(v);
      if (y < pane.top + 8 || y > pane.top + pane.height - 8) continue;
      p.text((pane.tickFormat ?? pane.format)(v), labelX, y, pal.textSecondary);
    }
  }

  // Object badges (orders, positions, horizontal lines), clamped to the pane edge when off-screen
  for (const badge of badges) {
    const y = Math.min(main.height - BADGE_HEIGHT / 2, Math.max(BADGE_HEIGHT / 2, badge.y));
    p.roundRect(f.plotWidth + 2, y - BADGE_HEIGHT / 2, f.width - f.plotWidth - 4, BADGE_HEIGHT, 4, badge.bg);
    p.text(badge.text, labelX, y, badge.fg);
  }

  // Pre-market / after-hours badge (under the last price's if they meet)
  if (extShown) {
    const y = Math.min(main.height - BADGE_HEIGHT / 2, Math.max(BADGE_HEIGHT / 2, extY));
    p.roundRect(f.plotWidth + 2, y - BADGE_HEIGHT / 2, f.width - f.plotWidth - 4, BADGE_HEIGHT, 4, extColor);
    p.text(main.format(ext!.price), labelX, y, '#FFFFFF');
  }

  // Last price badge (on top: the most important number on the axis)
  if (last && lastY >= 0 && lastY <= main.height) {
    // With a countdown the badge grows downward: price on top, time left below.
    const h = f.countdown ? BADGE_HEIGHT * 2 - 4 : BADGE_HEIGHT;
    const y = Math.min(main.height - h + BADGE_HEIGHT / 2, Math.max(BADGE_HEIGHT / 2, lastY));
    p.roundRect(f.plotWidth + 2, y - BADGE_HEIGHT / 2, f.width - f.plotWidth - 4, h, 4, lastColor);
    p.text(main.format(last.close), labelX, y, '#FFFFFF');
    if (f.countdown) {
      p.ctx.save();
      p.ctx.globalAlpha = 0.85;
      p.text(f.countdown, labelX, y + BADGE_HEIGHT - 4, '#FFFFFF');
      p.ctx.restore();
    }
  }

  // Time axis labels
  const timeY = f.panesHeight + f.timeAxisHeight / 2;
  for (const tick of f.timeTicks) {
    const w = p.measure(tick.label);
    if (tick.x - w / 2 < 0 || tick.x + w / 2 > f.plotWidth) continue;
    p.text(tick.label, tick.x, timeY, pal.textSecondary, 'center');
  }
}

function drawTooltip(p: Painter, f: Frame, tip: Tooltip): void {
  const { ctx } = p;
  const pal = f.palette;
  const lineHeight = 18;
  const pad = 10;
  const w = Math.ceil(Math.max(...tip.lines.map((l) => p.measure(l)))) + pad * 2;
  const h = tip.lines.length * lineHeight + pad * 2 - 4;
  // Buys sit under the bar → tooltip below; sells above. Flip when there's no room.
  let y = tip.side === 'buy' ? tip.y + 12 : tip.y - 12 - h;
  if (y < 4) y = tip.y + 12;
  if (y + h > f.panesHeight - 4) y = tip.y - 12 - h;
  const x = Math.min(f.plotWidth - w - 4, Math.max(4, tip.x - w / 2));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  p.roundRect(x, y, w, h, 8, pal.background);
  ctx.restore();
  tip.lines.forEach((line, i) => {
    const color = i === 0 ? (tip.side === 'buy' ? pal.up : pal.down) : i === tip.lines.length - 1 ? pal.textSecondary : pal.text;
    p.text(line, x + pad, y + pad + i * lineHeight + 7, color);
  });
}

export function drawOverlay(layer: CanvasLayer, m: RenderModel, ch: CrosshairInfo | null, tooltip: Tooltip | null = null): void {
  const ctx = layer.begin();
  const p = new Painter(ctx, layer.dpr);
  const f = m.frame;
  const pal = f.palette;
  ctx.font = f.font;
  if (tooltip) drawTooltip(p, f, tooltip);
  if (!ch) return;

  if (m.replaySelecting) {
    // Everything right of the pointer is what the replay will hide.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = pal.text;
    ctx.fillRect(ch.x, 0, f.plotWidth - ch.x, f.panesHeight);
    ctx.restore();
  }

  const mode = ch.source === 'mouse' ? (m.cursorMode ?? 'cross') : 'cross';
  if (mode === 'demo') {
    // A presenter's spot: no lines or badges, just where the pointer is.
    const at = m.pointer ?? { x: ch.x, y: ch.y };
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#FFC400';
    ctx.beginPath();
    ctx.arc(at.x, at.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (mode === 'cross') p.vLine(ch.x, 0, f.panesHeight, pal.crosshair, DASH);
  if (mode === 'dot') {
    const at = m.pointer ?? { x: ch.x, y: ch.y };
    ctx.beginPath();
    ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = pal.background;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(at.x, at.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = pal.text;
    ctx.fill();
  }
  if (ch.source !== 'sync') drawCrosshairValue(p, m, ch, mode === 'cross');

  // Time badge on the time axis
  const timeLabel = m.formatCrosshairTime(ch.time);
  const w = p.measure(timeLabel) + 16;
  const cx = Math.min(f.plotWidth - w / 2, Math.max(w / 2, ch.x));
  p.roundRect(cx - w / 2, f.panesHeight + 4, w, f.timeAxisHeight - 8, 4, pal.text);
  p.text(timeLabel, cx, f.panesHeight + f.timeAxisHeight / 2, pal.background, 'center');
}

/** Horizontal line, touch dot and price-axis badge of a pointer crosshair. */
function drawCrosshairValue(p: Painter, m: RenderModel, ch: CrosshairInfo, lines = true): void {
  const f = m.frame;
  const pal = f.palette;
  const ctx = p.ctx;
  if (lines) p.hLine(ch.y, 0, f.plotWidth, pal.crosshair, DASH);

  if (ch.source === 'touch') {
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pal.background;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ch.x, ch.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = ch.bar.close >= ch.bar.open ? pal.up : pal.down;
    ctx.fill();
  }

  // Value badge on the price axis
  const pane = f.panes.find((x) => x.id === ch.pane);
  const valueLabel = pane ? pane.format(ch.value) : m.formatPrice(ch.value);
  const by = Math.min(f.panesHeight - BADGE_HEIGHT / 2, Math.max(BADGE_HEIGHT / 2, ch.y));
  p.roundRect(f.plotWidth + 2, by - BADGE_HEIGHT / 2, f.width - f.plotWidth - 4, BADGE_HEIGHT, 4, pal.text);
  p.text(valueLabel, f.plotWidth + 8, by, pal.background);
}
