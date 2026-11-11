import type { PriceScale } from '../model/price-scale';
import type { TimeTick } from '../model/time-format';
import type { IndexRange, TimeScale } from '../model/time-scale';
import type { Bar } from '../types';
import type { CanvasLayer } from './canvas-layer';
import { Painter } from './painter';
import type { DrawingManager } from '../objects/drawings';
import type { TradingLabels, TradingLayer } from '../objects/trading';
import type { AxisBadge, PaneCoords } from '../objects/types';
import type { IndicatorOutput } from '../indicators/definitions';
import type { ChartSettings } from '../settings';

export type ChartType = 'candles' | 'line' | 'area';

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

export interface RenderModel {
  frame: Frame;
  bars: readonly Bar[];
  timeScale: TimeScale;
  formatPrice(price: number): string;
  formatVolume(volume: number): string;
  formatCrosshairTime(time: number): string;
  labels: { high: string; low: string };
  chartType: ChartType;
  /** Replay start picking: the area right of the crosshair is shaded. */
  replaySelecting?: boolean;
  objects: {
    coords: PaneCoords;
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

function drawCandles(ctx: CanvasRenderingContext2D, dpr: number, m: RenderModel, pane: PaneFrame): void {
  const { bars, timeScale, frame } = m;
  const { from, to } = frame.range;
  const { wick, body } = barGeometry(timeScale.barSpacing, dpr);
  const half = wick >> 1;
  const inset = (body - wick) / 2;
  const s = pane.scale;
  const y = (price: number) => Math.round((pane.top + s.priceToY(price)) * dpr);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const up of [true, false]) {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      if (bar.close >= bar.open !== up) continue;
      const left = Math.round(timeScale.indexToX(i) * dpr) - half;
      const yHigh = y(bar.high);
      const yLow = y(bar.low);
      ctx.rect(left, yHigh, wick, Math.max(1, yLow - yHigh));
      if (body > wick) {
        const yOpen = y(bar.open);
        const yClose = y(bar.close);
        const top = Math.min(yOpen, yClose);
        ctx.rect(left - inset, top, body, Math.max(1, Math.max(yOpen, yClose) - top));
      }
    }
    ctx.fillStyle = up ? frame.palette.up : frame.palette.down;
    ctx.fill();
  }
  ctx.restore();
}

/** Close-price line, optionally with a gradient area fill underneath. */
function drawLineSeries(ctx: CanvasRenderingContext2D, m: RenderModel, pane: PaneFrame, area: boolean): void {
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
    else ctx.lineTo(x, y);
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

/** Lines, histograms, band fill and reference levels of one indicator inside `pane`. */
function drawIndicator(ctx: CanvasRenderingContext2D, p: Painter, m: RenderModel, pane: PaneFrame, output: IndicatorOutput): void {
  const { timeScale, frame } = m;
  const pal = frame.palette;
  const n = m.bars.length;
  if (frame.range.to < frame.range.from) return;
  /** Data indices to draw for a series shifted right by `shift` bars (into the empty space past the last bar). */
  const span = (shift: number): [number, number] => {
    const lastX = Math.ceil(timeScale.xToIndexFloat(frame.plotWidth)) + 1;
    return [Math.max(0, frame.range.from - 1 - shift), Math.min(n - 1, (shift > 0 ? lastX : frame.range.to + 1) - shift)];
  };
  const [from, to] = span(0);
  const yOf = (v: number) => pane.top + pane.scale.priceToY(v);
  const byKey = (key: string) => output.series.find((s) => s.key === key);

  for (const level of output.levels ?? []) p.hLine(yOf(level), 0, frame.plotWidth, pal.textSecondary, [3, 4]);

  if (output.fill) {
    const upperSeries = byKey(output.fill.upper);
    const lower = byKey(output.fill.lower)?.values;
    if (upperSeries && lower) {
      const upper = upperSeries.values;
      const shift = upperSeries.shift ?? 0;
      const [f0, f1] = span(shift);
      const { color, downColor } = output.fill;
      const sideOf = (j: number) => (downColor && lower[j]! > upper[j]! ? 1 : 0);
      const valid = (j: number) => !Number.isNaN(upper[j]!) && !Number.isNaN(lower[j]!);
      ctx.save();
      ctx.globalAlpha = 0.07;
      // One polygon per contiguous run of valid values on the same side (cloud color flips).
      let i = f0;
      while (i <= f1) {
        while (i <= f1 && !valid(i)) i++;
        const start = i;
        const side = valid(i) ? sideOf(i) : 0;
        while (i <= f1 && valid(i) && sideOf(i) === side) i++;
        // Overlap one bar into the next run so there's no gap where the color flips.
        const end = i <= f1 && valid(i) ? i + 1 : i;
        if (end - start < 2) continue;
        ctx.fillStyle = side ? downColor! : color;
        ctx.beginPath();
        for (let j = start; j < end; j++) ctx.lineTo(timeScale.indexToX(j + shift), yOf(upper[j]!));
        for (let j = end - 1; j >= start; j--) ctx.lineTo(timeScale.indexToX(j + shift), yOf(lower[j]!));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  for (const series of output.series) {
    if (series.kind !== 'histogram') continue;
    const { wick, body } = barGeometry(timeScale.barSpacing, layerDpr(ctx));
    const dpr = layerDpr(ctx);
    const zero = Math.round(yOf(0) * dpr);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.6;
    for (const positive of [true, false]) {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const v = series.values[i]!;
        if (Number.isNaN(v) || v >= 0 !== positive) continue;
        const left = Math.round(timeScale.indexToX(i) * dpr) - (wick >> 1) - (body - wick) / 2;
        const y = Math.round(yOf(v) * dpr);
        ctx.rect(left, Math.min(y, zero), body, Math.max(1, Math.abs(zero - y)));
      }
      ctx.fillStyle = positive ? pal.up : pal.down;
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.lineJoin = 'round';
  for (const series of output.series) {
    if (series.kind !== 'line') continue;
    ctx.lineWidth = series.width;
    ctx.beginPath();
    let pen = false;
    const shift = series.shift ?? 0;
    const [s0, s1] = span(shift);
    for (let i = s0; i <= s1; i++) {
      const v = series.values[i]!;
      if (Number.isNaN(v)) {
        pen = false;
        continue;
      }
      const x = timeScale.indexToX(i + shift);
      if (pen) ctx.lineTo(x, yOf(v));
      else ctx.moveTo(x, yOf(v));
      pen = true;
    }
    ctx.strokeStyle = series.color;
    ctx.stroke();
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
  const [main, volume] = f.panes as [PaneFrame, PaneFrame | undefined];

  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, f.width, f.height);
  ctx.font = f.font;

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

  // Series
  const hasBars = f.range.to >= f.range.from;
  if (hasBars) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, main.top, f.plotWidth, main.height);
    ctx.clip();
    if (m.chartType === 'candles') drawCandles(ctx, layer.dpr, m, main);
    else drawLineSeries(ctx, m, main, m.chartType === 'area');
    for (const overlay of f.overlays) drawIndicator(ctx, p, m, main, overlay);
    if (f.settings.highLowMarkers) drawHighLow(p, m, main);
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
    drawIndicator(ctx, p, m, pane, pane.indicator);
    ctx.restore();
  }

  // Drawings and trading lines (clipped to the price pane; their axis badges come later)
  const badges: AxisBadge[] = [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, main.top, f.plotWidth, main.height);
  ctx.clip();
  const o = m.objects;
  const rc = { painter: p, coords: o.coords, palette: pal };
  o.trading.render(rc, m.bars, o.barIndexAt, (i) => m.timeScale.indexToX(i), o.tradingLabels, badges);
  o.drawings.render(rc, badges);
  ctx.restore();

  // Last price line
  const last = f.settings.lastPriceLine ? m.bars[m.bars.length - 1] : undefined;
  const lastColor = last && last.close >= last.open ? pal.up : pal.down;
  const lastY = last ? main.scale.priceToY(last.close) : NaN;
  if (last && lastY >= 0 && lastY <= main.height) p.hLine(lastY, 0, f.plotWidth, lastColor, DOT);

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

  p.vLine(ch.x, 0, f.panesHeight, pal.crosshair, DASH);
  if (ch.source !== 'sync') drawCrosshairValue(p, m, ch);

  // Time badge on the time axis
  const timeLabel = m.formatCrosshairTime(ch.time);
  const w = p.measure(timeLabel) + 16;
  const cx = Math.min(f.plotWidth - w / 2, Math.max(w / 2, ch.x));
  p.roundRect(cx - w / 2, f.panesHeight + 4, w, f.timeAxisHeight - 8, 4, pal.text);
  p.text(timeLabel, cx, f.panesHeight + f.timeAxisHeight / 2, pal.background, 'center');
}

/** Horizontal line, touch dot and price-axis badge of a pointer crosshair. */
function drawCrosshairValue(p: Painter, m: RenderModel, ch: CrosshairInfo): void {
  const f = m.frame;
  const pal = f.palette;
  const ctx = p.ctx;
  p.hLine(ch.y, 0, f.plotWidth, pal.crosshair, DASH);

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
