/**
 * The legend painted into screenshots: the same rows @funnest/charts-ui shows over the chart
 * (symbol · interval · exchange, OHLC and change, compares, indicator values), as text on the
 * canvas, so a saved or shared image says what it is. Layout mirrors the DOM legend's CSS
 * (12px from the left, 8px from the top, 80px clear of the price axis, wrapping items).
 */

/** A piece of text (or a color dot) drawn as-is. */
export interface LegendRun {
  text: string;
  color: string;
  /** Default 400. */
  weight?: number;
  /** A filled circle of this color before the text (compare rows). */
  dot?: boolean;
}

/** Runs that stay together on one line; groups wrap between them. */
export type LegendGroup = LegendRun[];

export interface LegendRow {
  groups: LegendGroup[];
  /** Space between groups. */
  gap: number;
  size: number;
  lineHeight: number;
}

export interface PlacedRun {
  run: LegendRun;
  x: number;
  /** Middle of the line. */
  y: number;
  size: number;
}

export interface LegendLayout {
  runs: PlacedRun[];
  /** Bottom of the last line. */
  bottom: number;
  /** Right edge of the widest line. */
  right: number;
}

export type MeasureText = (text: string, size: number, weight: number) => number;

const ROW_GAP = 2;
const DOT = 8;
const DOT_GAP = 6;

export const LEGEND_LEFT = 12;
export const LEGEND_TOP = 8;
export const LEGEND_RIGHT_CLEARANCE = 80;

/** Places rows top-down from (left, top), wrapping groups that don't fit within maxWidth. */
export function layoutLegend(rows: readonly LegendRow[], left: number, top: number, maxWidth: number, measure: MeasureText): LegendLayout {
  const runs: PlacedRun[] = [];
  let y = top;
  let right = left;
  rows.forEach((row, i) => {
    if (i > 0) y += ROW_GAP;
    let x = left;
    let lineStart = true;
    const widths = row.groups.map((g) => g.reduce((w, r) => w + runWidth(r, row.size, measure), 0));
    row.groups.forEach((group, gi) => {
      const w = widths[gi]!;
      if (!lineStart && x + row.gap + w > left + maxWidth) {
        y += row.lineHeight;
        x = left;
        lineStart = true;
      }
      if (!lineStart) x += row.gap;
      for (const run of group) {
        runs.push({ run, x, y: y + row.lineHeight / 2, size: row.size });
        x += runWidth(run, row.size, measure);
      }
      right = Math.max(right, x);
      lineStart = false;
    });
    y += row.lineHeight;
  });
  return { runs, bottom: y, right };
}

function runWidth(run: LegendRun, size: number, measure: MeasureText): number {
  return (run.dot ? DOT + DOT_GAP : 0) + (run.text ? measure(run.text, size, run.weight ?? 400) : 0);
}

const font = (size: number, weight: number, family: string) => `${weight} ${size}px ${family}`;

export function canvasMeasure(ctx: CanvasRenderingContext2D, family: string): MeasureText {
  return (text, size, weight) => {
    ctx.font = font(size, weight, family);
    return ctx.measureText(text).width;
  };
}

/**
 * Paints a layout. With `backdrop`, a translucent panel goes behind it first — for legends taller
 * than the space the chart keeps clear above the candles.
 */
export function paintLegend(ctx: CanvasRenderingContext2D, layout: LegendLayout, family: string, backdrop: { color: string; top: number; left: number } | null): void {
  ctx.save();
  if (backdrop && layout.runs.length) {
    const pad = 4;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = backdrop.color;
    ctx.beginPath();
    ctx.roundRect(backdrop.left - pad, backdrop.top - pad, layout.right - backdrop.left + pad * 2, layout.bottom - backdrop.top + pad * 2, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const { run, x, y, size } of layout.runs) {
    let tx = x;
    if (run.dot) {
      ctx.fillStyle = run.color;
      ctx.beginPath();
      ctx.arc(x + DOT / 2, y, DOT / 2, 0, Math.PI * 2);
      ctx.fill();
      tx += DOT + DOT_GAP;
      if (!run.text) continue;
    }
    ctx.font = font(size, run.weight ?? 400, family);
    ctx.fillStyle = run.color;
    ctx.fillText(run.text, tx, y);
  }
  ctx.restore();
}

/** Words the screenshot legend uses (the widget's own strings live in @funnest/charts-ui). */
export const LEGEND_STRINGS = {
  ko: { open: '시', high: '고', low: '저', close: '종', volume: '거래량', volumePane: '거래량' },
  en: { open: 'O', high: 'H', low: 'L', close: 'C', volume: 'Vol', volumePane: 'Volume' },
} as const;
