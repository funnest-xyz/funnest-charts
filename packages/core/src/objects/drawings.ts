import type { Bar } from '../types.js';
import { shownOnInterval, type IntervalVisibility } from '../intervals.js';
import type { Locale } from '../model/time-format.js';
import type { Painter } from '../render/painter.js';
import type { Palette } from '../render/renderer.js';
import { newId, type AxisBadge, type ObjectHit, type ObjectRenderContext, type PaneCoords, type TimeAxisBadge } from './types.js';

/** Built-in drawing tools. */
export type BuiltinDrawingType = 'trendline' | 'horizontal' | 'fibonacci';
/** A built-in tool, or the `type` of a definition passed in `ChartOptions.drawings`. */
export type DrawingType = BuiltinDrawingType | (string & {});

export interface DrawingPoint {
  /** UTC ms — anchored to time, so drawings survive history loads and resolution changes. */
  time: number;
  price: number;
}

/** How a drawing looks beyond its color (all optional; tools read them through the render context). */
export interface DrawingStyle {
  /** Main line width in CSS px (1–4). */
  width?: number;
  /** Main line pattern. */
  dash?: 'solid' | 'dashed' | 'dotted';
  /** Text tools (and notes on others): what it says. */
  text?: string;
  /** Text size in CSS px. */
  fontSize?: number;
  /** A note's color (other tools than text ones); absent: the drawing's color. */
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  /** Where a note sits: along the line / across the box. */
  textH?: 'left' | 'center' | 'right';
  /** Above, on or below the line (top / middle / bottom of the box). */
  textV?: 'top' | 'middle' | 'bottom';
  /** Can't be dragged or edited until unlocked (still selectable). */
  locked?: boolean;
  /** Not drawn and can't be hit (a drawings list can show it again). */
  hidden?: boolean;
  /** Colors of the tool's parts (`DrawingDefinition.colors` keys), where set apart from the rest. */
  colors?: Record<string, string>;
  /**
   * The tool's levels as the user set them (피보나치 레벨: values, which are shown, their colors),
   * for tools with `DrawingDefinition.levels`. Absent: the tool's own.
   */
  levels?: DrawingLevel[];
  /** The tool's settings as the user set them (`DrawingDefinition.options`); absent keys: the defaults. */
  options?: Record<string, DrawingOptionValue>;
  /** 보임: which intervals it shows on (absent: all). */
  intervals?: IntervalVisibility;
}

export type DrawingOptionValue = number | boolean | string;

/**
 * A setting of a tool (연장, 배경, 편차 배수, 계좌 금액…): the widget's 설정 menu shows it, the
 * tool reads it with `rc.option(key)`.
 */
export interface DrawingOption {
  key: string;
  label: Record<Locale, string>;
  /** 'number': a number field (min / max / step, `unit` after it); 'toggle': on / off; 'choice': one of `choices`. */
  kind: 'number' | 'toggle' | 'choice';
  default: DrawingOptionValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  choices?: { value: string; label: Record<Locale, string> }[];
}

/** A drawing's setting: its own value (kept within the option's range), else the default. */
export function drawingOption<T extends DrawingOptionValue>(def: Pick<DrawingDefinition, 'options'>, drawing: Pick<Drawing, 'style'>, key: string): T {
  const spec = def.options?.find((o) => o.key === key);
  const own = drawing.style?.options?.[key];
  if (!spec) return own as T;
  if (own === undefined || typeof own !== typeof spec.default) return spec.default as T;
  if (spec.kind === 'number') {
    const v = Number(own);
    if (!Number.isFinite(v)) return spec.default as T;
    return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, v)) as T;
  }
  if (spec.kind === 'choice' && !spec.choices?.some((c) => c.value === own)) return spec.default as T;
  return own as T;
}

/** One level of a level tool (0.618 of a retracement…). */
export interface DrawingLevel {
  value: number;
  /** Shown (default true). */
  on?: boolean;
  /** Its own color; absent: the drawing's color, else the tool's default for that place. */
  color?: string;
  /** Words shown on its line (the tool says where). */
  text?: string;
}

/** A tool's levels: the defaults, their colors, and the key each one's color had under `style.colors`. */
export interface DrawingLevelSpec {
  values: number[];
  /** More levels the tool offers, off until turned on (트레이딩뷰's 1.272 … 4.764), after `values`. */
  off?: number[];
  /** Default colors, by place (repeating). */
  colors?: string[];
  /** The `style.colors` key of default level i (colors set before levels could be edited). Default: `l${i}`. */
  key?(index: number): string;
}

/**
 * Every level of a drawing as it stands (off ones too), each with its color resolved: the
 * drawing's own list, else the tool's defaults with any part colors set on them. The drawing's
 * main color isn't used (level tools have no one color: the widget offers none for them).
 */
export function drawingLevels(def: Pick<DrawingDefinition, 'levels'>, drawing: Pick<Drawing, 'color' | 'style'>, fallback = '#8B95A1'): Required<DrawingLevel>[] {
  const spec = def.levels;
  if (!spec) return [];
  const own = drawing.style?.levels;
  const base = (i: number) => spec.colors?.length ? spec.colors[i % spec.colors.length]! : fallback;
  // Each level keeps its own color: the drawing's one color (from before levels had their own) doesn't paint them all.
  if (own) return own.map((l, i) => ({ value: l.value, on: l.on !== false, color: l.color ?? base(i), text: l.text ?? '' }));
  const offered = spec.off ?? [];
  return [
    ...spec.values.map((value, i) => ({ value, on: true, color: drawing.style?.colors?.[spec.key?.(i) ?? `l${i}`] ?? base(i), text: '' })),
    ...offered.map((value, j) => ({ value, on: false, color: base(spec.values.length + j), text: '' })),
  ];
}

/**
 * A part of a tool with its own color (a Fibonacci level, a position's target zone…). Its color
 * is `style.colors[key]`, else the drawing's color (picking one recolors every part), else `color`.
 */
export interface DrawingColorSlot {
  key: string;
  name: Record<Locale, string>;
  /** Default color. */
  color: string;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color?: string;
  style?: DrawingStyle;
}

const DASHES: Record<NonNullable<DrawingStyle['dash']>, number[]> = { solid: [], dashed: [6, 4], dotted: [1.5, 3] };

/** What a drawing definition gets to measure and paint itself. Pixels are relative to the price pane. */
export interface DrawingGeometry {
  coords: PaneCoords;
  /** `drawing.points` in pane pixels. */
  points: [number, number][];
}

export interface DrawingRenderContext extends DrawingGeometry {
  painter: Painter;
  palette: Palette;
  /** `drawing.color`, or the theme accent. */
  color: string;
  /** `drawing.style` (empty object when none). */
  style: DrawingStyle;
  /** A part's color (see `DrawingDefinition.colors`): its own, else the drawing's, else the default. */
  colorOf(key: string): string;
  /** The main line width: the drawing's style, else the tool's default. */
  width(fallback: number): number;
  /** The levels to draw (shown ones, in order), for tools with `DrawingDefinition.levels`. */
  levels(): { value: number; color: string; text: string }[];
  /** A setting (`DrawingDefinition.options`): the drawing's own, else the default. */
  option<T extends DrawingOptionValue = DrawingOptionValue>(key: string): T;
  /** The main line dash pattern for canvas: the drawing's style, else the tool's default. */
  dash(fallback?: readonly number[]): number[];
  /** The chart's bars (oldest first), for tools that measure them (VWAP, volume profile…). */
  bars: readonly Bar[];
  /** Index of the last bar at or before `time` (-1 before the first). */
  barIndexAt(time: number): number;
  /** Adds a price-axis badge (drawn above the axis labels, clamped to the pane). */
  badge(y: number, text: string, bg: string, fg?: string): void;
  /** Adds a date on the time axis at x (a vertical line's, always shown): the chart formats `time` as the crosshair's. */
  timeBadge(x: number, time: number, bg: string, fg?: string): void;
}

/**
 * A drawing tool. Built-ins use the same shape; pass your own in `ChartOptions.drawings` to add
 * tools to the chart and the widget's drawing bar.
 */
export interface DrawingDefinition {
  type: string;
  name: Record<Locale, string>;
  /**
   * Drawing bar icon: SVG markup — either a whole `<svg>`, or just the shapes for a 20×20 viewBox
   * drawn with `stroke="currentColor"` (like the built-in icons).
   */
  icon?: string;
  /** Tools with the same group share one drawing-bar button with a menu. Default: the type. */
  group?: string;
  /**
   * A heading in that menu (피보나치, 갠, 엘리어트 파동…): consecutive tools with the same section
   * are listed under it, with a divider between sections. Default: no heading.
   */
  section?: Record<Locale, string>;
  /** Clicks (or drag ends) needed to place it; with `open`, the fewest it takes. */
  clicks: number;
  /**
   * Placed point by point (a path, a polygon): every click adds one, until a double-click (a
   * click on the last point), a click on the first point, Enter or Esc finishes it.
   */
  open?: boolean;
  /**
   * Turns the placed click points into the stored points, e.g. a position tool that creates
   * entry/target/stop from one click. Called for the live preview too. Default: as placed.
   */
  create?(placed: DrawingPoint[], coords: PaneCoords): DrawingPoint[];
  /** Keeps points consistent after point `index` was dragged (e.g. target and stop share a time). */
  constrain?(points: DrawingPoint[], index: number): DrawingPoint[];
  /** Drag handle positions; dragging handle i moves point i. Default: the points. */
  handles?(geometry: DrawingGeometry): [number, number][];
  /**
   * Drawn by dragging: every pointer move adds a point (a brush); releasing (or clicking again)
   * finishes it. `clicks` is ignored.
   */
  freehand?: boolean;
  /**
   * Has no color, line width or line style of its own (an emoji, a picture): the widget's
   * selection bar leaves those out.
   */
  plain?: boolean;
  /**
   * Listed as a tile in its group's menu — the icon alone, the name as its tooltip — so many
   * tools fit (an emoji picker). Consecutive tiles share a grid.
   */
  tile?: boolean;
  /** Has text (`style.text`): the widget offers a text field for it when selected. */
  text?: boolean;
  /**
   * Tools without their own text can carry a note (`style.text`, the widget's 텍스트 menu):
   * 'line' writes it along the line through the first two points (turned with it), 'box' in the
   * box around the points. Default 'box'.
   */
  note?: 'line' | 'box';
  /** Parts with their own colors: the widget lets each be recolored (read them with `rc.colorOf`). */
  colors?: DrawingColorSlot[];
  /**
   * Levels the user can edit (values, on / off, colors, more of them): the widget's 레벨 설정.
   * Read them with `rc.levels()` (and `drawingLevels` when hit testing).
   */
  levels?: DrawingLevelSpec;
  /** Settings the user can change (the widget's 설정 menu); read them with `rc.option(key)` / `drawingOption`. */
  options?: DrawingOption[];
  /** Distance in px from (x, y) to the shape, for hit testing (`drawing`: the one tested, for its style). */
  distance(geometry: DrawingGeometry, x: number, y: number, drawing?: Drawing): number;
  render(drawing: Drawing, rc: DrawingRenderContext): void;
}

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#8B95A1', '#F04452', '#FF9F0A', '#12B886', '#3182F6', '#7048E8', '#8B95A1'];

const HANDLE_RADIUS = 5;

/** Distance from a point to the segment (x1,y1)–(x2,y2). Handy for `DrawingDefinition.distance`. */
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

type Pts = Pick<DrawingGeometry, 'points'>;

const L = (ko: string, en: string) => ({ ko, en });
const TRENDLINE_OPTIONS: DrawingOption[] = [
  { key: 'extendLeft', label: L('왼쪽으로 연장', 'Extend left'), kind: 'toggle', default: false },
  { key: 'extendRight', label: L('오른쪽으로 연장', 'Extend right'), kind: 'toggle', default: false },
  { key: 'stats', label: L('가격 변화 · 봉 수 표시', 'Show price change and bars'), kind: 'toggle', default: false },
];
const TRENDLINE = { options: TRENDLINE_OPTIONS };
const H_CHOICES = [
  { value: 'left', label: L('왼쪽', 'Left') },
  { value: 'center', label: L('가운데', 'Center') },
  { value: 'right', label: L('오른쪽', 'Right') },
];
const V_CHOICES = [
  { value: 'top', label: L('위', 'Top') },
  { value: 'middle', label: L('가운데', 'Middle') },
  { value: 'bottom', label: L('아래', 'Bottom') },
];
const FIB_OPTIONS: DrawingOption[] = [
  { key: 'trendline', label: L('추세선 (두 점 잇기)', 'Trend line'), kind: 'toggle', default: true },
  { key: 'extendLeft', label: L('왼쪽으로 연장', 'Extend left'), kind: 'toggle', default: false },
  { key: 'extendRight', label: L('오른쪽으로 연장', 'Extend right'), kind: 'toggle', default: false },
  { key: 'background', label: L('배경', 'Background'), kind: 'toggle', default: true },
  { key: 'opacity', label: L('배경 투명도', 'Background opacity'), kind: 'number', default: 7, min: 0, max: 100, step: 1, unit: '%' },
  { key: 'reverse', label: L('뒤집기 (0과 1 바꾸기)', 'Reverse (swap 0 and 1)'), kind: 'toggle', default: false },
  { key: 'prices', label: L('가격 표시', 'Show prices'), kind: 'toggle', default: true },
  {
    key: 'levelFormat',
    label: L('레벨 표시', 'Levels as'),
    kind: 'choice',
    default: 'value',
    choices: [
      { value: 'value', label: L('값 (0.618)', 'Values (0.618)') },
      { value: 'percent', label: L('퍼센트 (61.8%)', 'Percent (61.8%)') },
      { value: 'none', label: L('숨기기', 'Hidden') },
    ],
  },
  { key: 'labelH', label: L('라벨 가로 위치', 'Label: across'), kind: 'choice', default: 'left', choices: H_CHOICES },
  { key: 'labelV', label: L('라벨 세로 위치', 'Label: up / down'), kind: 'choice', default: 'top', choices: V_CHOICES },
  { key: 'textH', label: L('레벨 문자 가로 위치', 'Level text: across'), kind: 'choice', default: 'center', choices: H_CHOICES },
  { key: 'textV', label: L('레벨 문자 세로 위치', 'Level text: up / down'), kind: 'choice', default: 'top', choices: V_CHOICES },
  { key: 'fontSize', label: L('폰트 크기', 'Font size'), kind: 'number', default: 12, min: 8, max: 32, step: 1, unit: 'px' },
  { key: 'log', label: L('로그 스케일 레벨', 'Levels on a log scale'), kind: 'toggle', default: false },
];
/** More retracement levels TradingView offers, off until turned on. */
const FIB_MORE_LEVELS = [1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3, 3.272, 3.414, 3.618, 4, 4.236, 4.272, 4.414, 4.618, 4.764];
const FIB_MORE_COLORS = ['#795548', '#F06595', '#3182F6', '#15AABF', '#795548', '#12B886', '#F04452', '#15AABF', '#8B95A1', '#3182F6', '#7048E8', '#F06595', '#E64980', '#795548', '#7048E8', '#FF9F0A', '#12B886'];

/** A retracement level's price: straight between the two, or (log) on the log of the prices. */
function fibPrice(a: number, b: number, v: number, log: boolean): number {
  if (log && a > 0 && b > 0) return Math.exp(Math.log(b) + (Math.log(a) - Math.log(b)) * v);
  return b + (a - b) * v;
}

/** x of a label along [left, right] and its canvas alignment. */
function along(where: string, left: number, right: number): [number, CanvasTextAlign] {
  if (where === 'center') return [(left + right) / 2, 'center'];
  if (where === 'right') return [right - 4, 'right'];
  return [left + 4, 'left'];
}
/** y of a label at a line's y: above it, on it, or under it. */
function beside(where: string, y: number, size: number): number {
  if (where === 'middle') return y;
  return where === 'bottom' ? y + size * 0.6 + 3 : y - size * 0.6 - 2;
}
const FIB = { options: FIB_OPTIONS, levels: { values: [] as number[] } };

/** a–b, carried on past either end (far enough that the canvas clips it). */
function extendedSegment(a: [number, number], b: [number, number], left: boolean, right: boolean): [[number, number], [number, number]] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const far = 20_000 / len;
  return [left ? [a[0] - dx * far, a[1] - dy * far] : a, right ? [b[0] + dx * far, b[1] + dy * far] : b];
}

/** A label's middle kept inside the pane (a 20 px pill near the top or bottom isn't cut off). */
function clampY(rc: Pick<DrawingRenderContext, 'coords'>, y: number): number {
  return Math.min(rc.coords.height - 12, Math.max(12, y));
}
const p0 = (g: Pts) => g.points[0]!;
const p1 = (g: Pts) => g.points[1] ?? g.points[0]!;

export const BUILTIN_DRAWINGS: readonly DrawingDefinition[] = [
  {
    type: 'trendline',
    name: { ko: '추세선', en: 'Trend line' },
    note: 'line',
    group: 'line',
    clicks: 2,
    options: TRENDLINE_OPTIONS,
    distance: (g, x, y, d) => {
      const [a, b] = d ? extendedSegment(p0(g), p1(g), drawingOption(TRENDLINE, d, 'extendLeft'), drawingOption(TRENDLINE, d, 'extendRight')) : [p0(g), p1(g)];
      return distToSegment(x, y, ...a, ...b);
    },
    render: (d, rc) => {
      const { painter, color } = rc;
      const [a, b] = extendedSegment(p0(rc), p1(rc), rc.option<boolean>('extendLeft'), rc.option<boolean>('extendRight'));
      painter.line(...a, ...b, color, rc.width(2), rc.dash());
      if (rc.option<boolean>('stats') && d.points.length >= 2) {
        const [q0, q1] = d.points as [DrawingPoint, DrawingPoint];
        const diff = q1.price - q0.price;
        const pct = q0.price ? (diff / q0.price) * 100 : 0;
        const bars = Math.round(rc.coords.timeToIndex(q1.time) - rc.coords.timeToIndex(q0.time));
        const sign = (v: number) => (v > 0 ? '+' : '');
        const text = `${sign(diff)}${rc.coords.formatPrice(diff)} (${sign(pct)}${pct.toFixed(2)}%) · ${bars}${rc.coords.locale === 'en' ? ' bars' : '봉'}`;
        const [x, y] = p1(rc);
        const w = Math.ceil(painter.measure(text)) + 16;
        const above = p1(rc)[1] <= p0(rc)[1];
        painter.pill([{ text, bg: color, fg: '#FFFFFF' }], x - w / 2, clampY(rc, y + (above ? -16 : 16)), 20);
      }
    },
  },
  {
    type: 'horizontal',
    name: { ko: '수평선', en: 'Horizontal line' },
    note: 'line',
    group: 'level',
    clicks: 1,
    // The anchor's time doesn't matter; keep the handle inside the plot.
    handles: (g) => [[Math.min(g.coords.plotWidth - 24, Math.max(24, p0(g)[0])), p0(g)[1]]],
    distance: (g, _x, y) => Math.abs(y - p0(g)[1]),
    render: (d, { painter, color, coords, badge, ...g }) => {
      const y = p0(g)[1];
      const dash = g.dash();
      if (g.width(1) === 1 && !dash.length) painter.hLine(y, 0, coords.plotWidth, color);
      else painter.line(0, y, coords.plotWidth, y, color, g.width(1), dash);
      badge(y, coords.formatPrice(d.points[0]!.price), color);
    },
  },
  {
    type: 'fibonacci',
    name: { ko: '피보나치 되돌림', en: 'Fib retracement' },
    group: 'fib',
    section: { ko: '피보나치', en: 'Fibonacci' },
    clicks: 2,
    levels: { values: FIB_LEVELS, colors: [...FIB_COLORS, ...FIB_MORE_COLORS], key: (i) => String(FIB_LEVELS[i]), off: FIB_MORE_LEVELS },
    options: FIB_OPTIONS,
    distance: (g, x, y, d) => {
      // Nearest level line within its horizontal span (or past it, extended), or the diagonal.
      const [x1, y1] = p0(g);
      const [x2, y2] = p1(g);
      let best = distToSegment(x, y, x1, y1, x2, y2);
      const left = d && drawingOption<boolean>(FIB, d, 'extendLeft') ? -Infinity : Math.min(x1, x2);
      const right = d && drawingOption<boolean>(FIB, d, 'extendRight') ? Infinity : Math.max(x1, x2);
      if (x >= left && x <= right && d) {
        const [a, b] = drawingOption<boolean>(FIB, d, 'reverse') ? [d.points[1]!.price, d.points[0]!.price] : [d.points[0]!.price, d.points[1]!.price];
        const log = drawingOption<boolean>(FIB, d, 'log');
        const levels = drawingLevels(BUILTIN_DRAWINGS.find((t) => t.type === 'fibonacci')!, d).filter((l) => l.on);
        for (const { value } of levels) best = Math.min(best, Math.abs(y - g.coords.priceToY(fibPrice(a ?? 0, b ?? 0, value, log))));
      }
      return best;
    },
    render: (d, rc) => {
      const { painter: p, coords: c, palette } = rc;
      // Level 0 at the second point, 1 at the first.
      const [x1, y1] = p0(rc);
      const [x2, y2] = p1(rc);
      const left = rc.option<boolean>('extendLeft') ? 0 : Math.min(x1, x2);
      const right = rc.option<boolean>('extendRight') ? c.plotWidth : Math.max(x1, x2, left + 1);
      // Reversed: 0 at the first point, 1 at the second.
      const [a, b] = rc.option<boolean>('reverse') ? [d.points[1]!.price, d.points[0]!.price] : [d.points[0]!.price, d.points[1]!.price];
      const showPrices = rc.option<boolean>('prices');
      const log = rc.option<boolean>('log');
      const priceOf = (v: number) => fibPrice(a!, b!, v, log);
      const { ctx } = p;
      const levels = rc.levels();
      const width = rc.width(1);
      const dash = rc.dash();
      // Shaded between neighbouring levels (by value, whatever order they were set in).
      const sorted = [...levels].sort((u, v) => u.value - v.value);
      const alpha = rc.option<number>('opacity') / 100;
      if (rc.option<boolean>('background') && alpha > 0)
        sorted.forEach((lv, i) => {
          if (i === 0) return;
          const y = c.priceToY(priceOf(lv.value));
          const prevY = c.priceToY(priceOf(sorted[i - 1]!.value));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = lv.color;
          ctx.fillRect(left, Math.min(y, prevY), right - left, Math.abs(y - prevY));
          ctx.restore();
        });
      const size = rc.option<number>('fontSize');
      const format = rc.option<string>('levelFormat');
      const [labelX, labelAlign] = along(rc.option<string>('labelH'), left, right);
      const [textX, textAlign] = along(rc.option<string>('textH'), left, right);
      ctx.save();
      ctx.font = ctx.font.replace(/\d+(\.\d+)?px/, `${size}px`);
      for (const lv of levels) {
        const price = priceOf(lv.value);
        const y = c.priceToY(price);
        if (width === 1 && !dash.length) p.hLine(y, left, right, lv.color);
        else p.line(left, y, right, y, lv.color, width, dash);
        const level = format === 'percent' ? `${Number((lv.value * 100).toFixed(2))}%` : format === 'none' ? '' : String(Number(lv.value.toFixed(4)));
        const label = [level, showPrices ? `(${c.formatPrice(price)})` : ''].filter(Boolean).join(' ');
        if (label) p.text(label, labelX, beside(rc.option<string>('labelV'), y, size), lv.color, labelAlign, 'middle');
        // The level's own words, where the settings put them (the middle of the line by default).
        if (lv.text) p.text(lv.text, textX, beside(rc.option<string>('textV'), y, size), lv.color, textAlign, 'middle');
      }
      ctx.restore();
      if (rc.option<boolean>('trendline')) p.line(x1, y1, x2, y2, palette.textSecondary, 1, [4, 4]);
    },
  },
];

/** Built-ins plus definitions passed to the chart; later ones replace earlier ones of the same type. */
export function drawingRegistry(extra: readonly DrawingDefinition[] = []): Map<string, DrawingDefinition> {
  const registry = new Map<string, DrawingDefinition>(BUILTIN_DRAWINGS.map((d) => [d.type, d]));
  for (const def of extra) registry.set(def.type, def);
  return registry;
}

/** Where a drawing goes among the others (see `DrawingManager.reorder`). */
export type DrawingOrder = 'front' | 'forward' | 'backward' | 'back';

export type DrawingsChange = 'preview' | 'commit' | 'tool' | 'selection' | 'defaults' | 'hidden' | 'text';

/** The last color and line / text style used per tool type: new drawings of that type start with it. */
export type DrawingDefaults = Record<string, { color?: string; style?: Pick<DrawingStyle, 'width' | 'dash' | 'fontSize'> }>;

/** Within this many px of a placed point, a click on it finishes an `open` tool. */
const CLOSE_PX = 7;

/**
 * Owns drawings: creation (click-click or drag), selection, handle/body dragging,
 * hit testing and rendering. Pure state + canvas; pointer routing lives in Interaction.
 * What each tool looks like comes from its DrawingDefinition.
 */
export class DrawingManager {
  /** The chart's interval now (drawings with 보임 settings show only on theirs). */
  resolution: string | null = null;
  drawings: Drawing[] = [];
  tool: DrawingType | null = null;
  selectedId: string | null = null;
  /** A text drawing that was just placed without text: the widget opens its text field (read once). */
  textEditId: string | null = null;
  /** Every drawing hidden at once (arming a tool shows them again). */
  hiddenAll = false;
  /** The tool stays armed after a drawing is placed (연속 그리기). */
  keepTool = false;
  defaults: DrawingDefaults = {};

  private draft: { drawing: Drawing; placed: DrawingPoint[] } | null = null;
  private freehandLast: [number, number] | null = null;
  private drag: { id: string; part: 'body' | number; x: number; y: number; origin: [number, number][] } | null = null;

  constructor(
    private readonly onChange: (change: DrawingsChange) => void,
    readonly registry: Map<string, DrawingDefinition> = drawingRegistry(),
  ) {}

  get selected(): Drawing | null {
    return this.drawings.find((d) => d.id === this.selectedId) ?? null;
  }

  setTool(tool: DrawingType | null): void {
    if (tool && !this.registry.has(tool)) throw new Error(`funnest-charts: unknown drawing tool "${tool}"`);
    this.tool = tool;
    this.draft = null;
    if (tool) this.selectedId = null;
    // Drawing while everything is hidden would draw blind.
    if (tool && this.hiddenAll) this.setHiddenAll(false);
    this.onChange('tool');
  }

  setHiddenAll(hidden: boolean): void {
    if (hidden === this.hiddenAll) return;
    this.hiddenAll = hidden;
    if (hidden) this.selectedId = null;
    this.onChange('hidden');
  }

  select(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.onChange('selection');
  }

  /** Drawings of unknown types are kept (and saved) but not shown. */
  set(drawings: readonly Drawing[]): void {
    this.drawings = drawings.map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })) }));
    if (!this.selected) this.selectedId = null;
    this.onChange('commit');
  }

  update(id: string, patch: Partial<Omit<Drawing, 'id'>>): void {
    const d = this.drawings.find((x) => x.id === id);
    if (!d) return;
    Object.assign(d, patch);
    // A color or line / text style picked for it: the next drawing of this tool starts with it.
    if ('color' in patch || patch.style) {
      const { width, dash, fontSize } = d.style ?? {};
      const style = Object.fromEntries(Object.entries({ width, dash, fontSize }).filter(([, v]) => v !== undefined));
      this.defaults = { ...this.defaults, [d.type]: { ...(d.color ? { color: d.color } : {}), ...(Object.keys(style).length ? { style } : {}) } };
      this.onChange('defaults');
    }
    this.onChange('commit');
  }

  /**
   * 순서: where a drawing sits among the others — later ones are drawn over earlier ones (and are
   * picked first). 'front' / 'back': to the top / bottom; 'forward' / 'backward': one place.
   * Returns false when it can't go further.
   */
  reorder(id: string, where: DrawingOrder): boolean {
    const i = this.drawings.findIndex((d) => d.id === id);
    if (i < 0) return false;
    const last = this.drawings.length - 1;
    const to = where === 'front' ? last : where === 'back' ? 0 : where === 'forward' ? Math.min(last, i + 1) : Math.max(0, i - 1);
    if (to === i) return false;
    const list = [...this.drawings];
    const [d] = list.splice(i, 1);
    list.splice(to, 0, d!);
    this.drawings = list;
    this.onChange('commit');
    return true;
  }

  /** Whether `reorder(id, where)` would move it. */
  canReorder(id: string, where: DrawingOrder): boolean {
    const i = this.drawings.findIndex((d) => d.id === id);
    if (i < 0) return false;
    return where === 'front' || where === 'forward' ? i < this.drawings.length - 1 : i > 0;
  }

  remove(id: string): void {
    const before = this.drawings.length;
    this.drawings = this.drawings.filter((d) => d.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    if (this.drawings.length !== before) this.onChange('commit');
  }

  clear(): void {
    this.drawings = [];
    this.selectedId = null;
    this.draft = null;
    this.onChange('commit');
  }

  /** Esc: finish a path that has enough points, else abort an in-progress drawing, else drop the tool, else deselect. */
  cancel(): void {
    if (this.finishOpen()) return;
    if (this.draft || this.tool) this.setTool(null);
    else this.select(null);
  }

  /** Finishes an `open` tool's drawing in progress (Enter); false when there is none or too few points. */
  finishOpen(): boolean {
    const draft = this.draft;
    const def = draft && this.registry.get(draft.drawing.type);
    if (!draft || !def?.open || draft.placed.length < Math.max(2, def.clicks)) return false;
    draft.drawing.points = draft.placed.map((p) => ({ ...p }));
    this.finish();
    return true;
  }

  // ── Creation ──────────────────────────────────────────────────────

  private expand(def: DrawingDefinition, placed: DrawingPoint[], c: PaneCoords): DrawingPoint[] {
    // A path: what's placed (and, while drawing, the point under the pointer).
    if (def.open) return placed.map((p) => ({ ...p }));
    // Not-yet-placed clicks follow the last placed one, so the preview has every point.
    const full = Array.from({ length: def.clicks }, (_, i) => ({ ...(placed[i] ?? placed[placed.length - 1]!) }));
    return def.create ? def.create(full, c) : full;
  }

  createAt(c: PaneCoords, x: number, y: number): void {
    const def = this.tool ? this.registry.get(this.tool) : undefined;
    if (!def) return;
    const point = c.pointAt(x, y);
    if (def.freehand) {
      // A brush: the first press starts it, a second click (or the release after a drag) ends it.
      if (this.draft) return this.finish();
      this.draft = { drawing: { id: newId('d'), type: def.type, points: [point] }, placed: [point] };
      this.freehandLast = [x, y];
      this.onChange('preview');
      return;
    }
    if (!this.draft) {
      const placed = [point];
      const last = this.defaults[def.type];
      this.draft = {
        drawing: { id: newId('d'), type: def.type, points: this.expand(def, placed, c), ...(last?.color ? { color: last.color } : {}), ...(last?.style ? { style: { ...last.style } } : {}) },
        placed,
      };
      if (def.clicks <= 1 && !def.open) this.finish();
      else this.onChange('preview');
      return;
    }
    if (def.open) {
      // A click on the last point (a double-click) or the first one finishes the path.
      const near = (p: DrawingPoint) => Math.hypot(c.timeToX(p.time) - x, c.priceToY(p.price) - y) <= CLOSE_PX;
      const placed = this.draft.placed;
      if (placed.length >= Math.max(2, def.clicks) && (near(placed[placed.length - 1]!) || near(placed[0]!))) {
        this.finishOpen();
        return;
      }
      if (near(placed[placed.length - 1]!)) return;
      placed.push(point);
      this.draft.drawing.points = [...placed.map((p) => ({ ...p })), { ...point }];
      this.onChange('preview');
      return;
    }
    this.draft.placed.push(point);
    this.draft.drawing.points = this.expand(def, this.draft.placed, c);
    if (this.draft.placed.length >= def.clicks) this.finish();
  }

  /** Moves the not-yet-placed points (live preview while hovering or dragging). */
  previewAt(c: PaneCoords, x: number, y: number): void {
    const draft = this.draft;
    const def = draft && this.registry.get(draft.drawing.type);
    if (!draft || !def) return;
    if (def.freehand) {
      // A point every few px, up to a few thousand.
      const last = this.freehandLast;
      if (last && Math.hypot(x - last[0], y - last[1]) < 3) return;
      if (draft.drawing.points.length >= 4000) return;
      this.freehandLast = [x, y];
      draft.drawing.points.push(c.pointAt(x, y));
      this.onChange('preview');
      return;
    }
    draft.drawing.points = def.open ? [...draft.placed.map((p) => ({ ...p })), c.pointAt(x, y)] : this.expand(def, [...draft.placed, c.pointAt(x, y)], c);
    this.onChange('preview');
  }

  /** Pointer released: a drag since the first point places the next one (drag-to-draw). */
  releaseAt(c: PaneCoords, x: number, y: number, moved: boolean): void {
    const def = this.draft && this.registry.get(this.draft.drawing.type);
    if (def?.freehand) {
      if (moved && this.draft!.drawing.points.length > 1) this.finish();
      return;
    }
    if (this.draft && moved) this.createAt(c, x, y);
  }

  private finish(): void {
    const drawing = this.draft!.drawing;
    this.draft = null;
    this.drawings.push(drawing);
    if (this.keepTool) {
      // 연속 그리기: the tool stays armed for the next one.
      this.onChange('commit');
    } else {
      this.selectedId = drawing.id;
      this.tool = null;
      this.onChange('tool');
      this.onChange('commit');
    }
    // A text tool placed without text: typing comes next.
    if (this.registry.get(drawing.type)?.text && !drawing.style?.text) {
      this.textEditId = drawing.id;
      this.onChange('text');
    }
  }

  /** Whether a drawing's text can be typed in place (a text tool, not locked). */
  textEditable(id: string): boolean {
    const d = this.drawings.find((x) => x.id === id);
    return !!d && !d.style?.locked && !!this.registry.get(d.type)?.text;
  }

  // ── Editing ───────────────────────────────────────────────────────

  private geometry(c: PaneCoords, d: Drawing): DrawingGeometry {
    return { coords: c, points: d.points.map((p) => [c.timeToX(p.time), c.priceToY(p.price)]) };
  }

  private handles(c: PaneCoords, d: Drawing): [number, number][] {
    const def = this.registry.get(d.type);
    const g = this.geometry(c, d);
    // A brush has thousands of points: it moves as a whole, without handles.
    return def?.handles ? def.handles(g) : def?.freehand ? [] : g.points;
  }

  hitTest(c: PaneCoords, x: number, y: number, tolerance: number): ObjectHit | null {
    const selected = this.selected;
    if (selected && this.registry.has(selected.type)) {
      const handle = this.handles(c, selected).findIndex(([px, py]) => Math.hypot(px - x, py - y) <= HANDLE_RADIUS + tolerance);
      if (handle >= 0) return { kind: 'drawing', id: selected.id, part: handle };
    }
    if (this.hiddenAll) return null;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i]!;
      if (d.style?.hidden || !shownOnInterval(d.style?.intervals, this.resolution)) continue;
      const def = this.registry.get(d.type);
      if (def && def.distance(this.geometry(c, d), x, y, d) <= tolerance) return { kind: 'drawing', id: d.id, part: 'body' };
    }
    return null;
  }

  beginDrag(c: PaneCoords, id: string, part: 'body' | number, x: number, y: number): void {
    const d = this.drawings.find((x) => x.id === id);
    if (!d) return;
    this.select(id);
    if (d.style?.locked) return;
    this.drag = { id, part, x, y, origin: this.geometry(c, d).points };
  }

  dragTo(c: PaneCoords, x: number, y: number): void {
    const drag = this.drag;
    const d = drag && this.drawings.find((x) => x.id === drag.id);
    if (!drag || !d) return;
    if (typeof drag.part === 'number') {
      d.points[drag.part] = c.pointAt(x, y);
      const def = this.registry.get(d.type);
      if (def?.constrain) d.points = def.constrain(d.points, drag.part);
    } else {
      const dx = x - drag.x;
      const dy = y - drag.y;
      d.points = drag.origin.map(([ox, oy]) => c.pointAt(ox + dx, oy + dy));
    }
    this.onChange('preview');
  }

  endDrag(moved: boolean): void {
    if (this.drag && moved) this.onChange('commit');
    this.drag = null;
  }

  // ── Rendering ─────────────────────────────────────────────────────

  render(rc: ObjectRenderContext, badges: AxisBadge[], bars: readonly Bar[] = [], barIndexAt: (time: number) => number = () => -1, timeBadges: TimeAxisBadge[] = []): void {
    const shown = this.hiddenAll ? [] : this.drawings.filter((d) => !d.style?.hidden && shownOnInterval(d.style?.intervals, this.resolution));
    const all = this.draft ? [...shown, this.draft.drawing] : shown;
    const c = rc.coords;
    for (const d of all) {
      const def = this.registry.get(d.type);
      if (!def) continue;
      const color = d.color ?? rc.palette.accent;
      const style = d.style ?? {};
      rc.painter.ctx.save();
      try {
        def.render(d, {
          ...this.geometry(c, d),
          painter: rc.painter,
          palette: rc.palette,
          color,
          style,
          colorOf: (key) => style.colors?.[key] ?? d.color ?? def.colors?.find((c) => c.key === key)?.color ?? color,
          width: (fallback) => Math.min(8, Math.max(0.5, style.width ?? fallback)),
          dash: (fallback = []) => (style.dash ? DASHES[style.dash] : [...fallback]),
          levels: () => drawingLevels(def, d, color).filter((l) => l.on).map(({ value, color: c, text }) => ({ value, color: c, text })),
          option: <T extends DrawingOptionValue>(key: string) => drawingOption<T>(def, d, key),
          bars,
          barIndexAt,
          badge: (y, text, bg, fg = '#FFFFFF') => badges.push({ y, text, bg, fg }),
          timeBadge: (x, time, bg, fg = '#FFFFFF') => timeBadges.push({ x, time, bg, fg }),
        });
      } finally {
        rc.painter.ctx.restore();
      }
      if (!def.text && style.text) {
        rc.painter.ctx.save();
        try {
          const at = this.geometry(c, d).points;
          // A one-point line (수평선) runs across the pane: the note goes along that.
          const pts: [number, number][] = def.note === 'line' && at.length === 1 ? [[0, at[0]![1]], [c.plotWidth, at[0]![1]]] : at;
          drawNote(rc.painter, pts, style, style.textColor ?? color, def.note ?? 'box');
        } finally {
          rc.painter.ctx.restore();
        }
      }
      if ((d.id === this.selectedId && !style.locked) || d === this.draft?.drawing) {
        for (const [px, py] of this.handles(c, d)) rc.painter.circle(px, py, HANDLE_RADIUS, rc.palette.background, color);
      }
    }
  }
}

/**
 * A note on a drawing that isn't a text tool (TradingView's 텍스트 tab): along its line, turned
 * with it and kept upright, or in the box around its points.
 */
export function drawNote(p: Painter, points: [number, number][], style: DrawingStyle, color: string, mode: 'line' | 'box'): void {
  const text = style.text?.trim();
  if (!text || !points.length) return;
  const ctx = p.ctx;
  const size = Math.min(72, Math.max(6, style.fontSize ?? 14));
  // A stand-in canvas (tests) can't write text.
  if (typeof ctx?.fillText !== 'function') return;
  const family = String(ctx.font ?? '').replace(/^.*?\d+(\.\d+)?px\s*/, '') || 'sans-serif';
  ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${family}`;
  ctx.fillStyle = color;
  const lines = text.split('\n');
  const lineHeight = size * 1.25;
  const h = style.textH ?? 'center';
  const v = style.textV ?? (mode === 'line' ? 'top' : 'middle');
  const align: CanvasTextAlign = h;
  const gap = 4;
  const drawLines = (x: number, y: number) => {
    // y is where the block's edge sits: its bottom (top), middle, or top (bottom).
    const total = lines.length * lineHeight;
    const start = v === 'top' ? y - total : v === 'middle' ? y - total / 2 : y;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, x, start + lineHeight * (i + 0.5)));
  };
  if (mode === 'line') {
    let [a, b] = points.length >= 2 ? [points[0]!, points[1]!] : [points[0]!, [points[0]![0] + 1, points[0]![1]] as [number, number]];
    // Read left to right whichever way it was drawn.
    if (b[0] < a[0]) [a, b] = [b, a];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const along = points.length < 2 ? 0 : h === 'left' ? 0 : h === 'right' ? len : len / 2;
    ctx.translate(a[0], a[1]);
    ctx.rotate(angle);
    drawLines(along + (h === 'left' ? gap : h === 'right' ? -gap : 0), v === 'top' ? -gap : v === 'bottom' ? gap : 0);
    return;
  }
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const x = h === 'left' ? x0 + gap : h === 'right' ? x1 - gap : (x0 + x1) / 2;
  // Inside the box: under its top edge, in its middle, over its bottom edge.
  const total = lines.length * lineHeight;
  const y = v === 'top' ? y0 + gap + total : v === 'bottom' ? y1 - gap - total : (y0 + y1) / 2;
  drawLines(x, v === 'top' ? y : v === 'bottom' ? y : y);
}
