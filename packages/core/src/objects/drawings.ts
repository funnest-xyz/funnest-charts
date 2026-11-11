import type { Locale } from '../model/time-format';
import type { Painter } from '../render/painter';
import type { Palette } from '../render/renderer';
import { newId, type AxisBadge, type ObjectHit, type ObjectRenderContext, type PaneCoords } from './types';

/** Built-in drawing tools. */
export type BuiltinDrawingType = 'trendline' | 'horizontal' | 'fibonacci';
/** A built-in tool, or the `type` of a definition passed in `ChartOptions.drawings`. */
export type DrawingType = BuiltinDrawingType | (string & {});

export interface DrawingPoint {
  /** UTC ms — anchored to time, so drawings survive history loads and resolution changes. */
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color?: string;
}

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
  /** Adds a price-axis badge (drawn above the axis labels, clamped to the pane). */
  badge(y: number, text: string, bg: string, fg?: string): void;
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
  /** Clicks (or drag ends) needed to place it. */
  clicks: number;
  /**
   * Turns the placed click points into the stored points, e.g. a position tool that creates
   * entry/target/stop from one click. Called for the live preview too. Default: as placed.
   */
  create?(placed: DrawingPoint[], coords: PaneCoords): DrawingPoint[];
  /** Keeps points consistent after point `index` was dragged (e.g. target and stop share a time). */
  constrain?(points: DrawingPoint[], index: number): DrawingPoint[];
  /** Drag handle positions; dragging handle i moves point i. Default: the points. */
  handles?(geometry: DrawingGeometry): [number, number][];
  /** Distance in px from (x, y) to the shape, for hit testing. */
  distance(geometry: DrawingGeometry, x: number, y: number): number;
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
const p0 = (g: Pts) => g.points[0]!;
const p1 = (g: Pts) => g.points[1] ?? g.points[0]!;

export const BUILTIN_DRAWINGS: readonly DrawingDefinition[] = [
  {
    type: 'trendline',
    name: { ko: '추세선', en: 'Trend line' },
    group: 'line',
    clicks: 2,
    distance: (g, x, y) => distToSegment(x, y, ...p0(g), ...p1(g)),
    render: (_d, { painter, color, ...g }) => painter.line(...p0(g), ...p1(g), color, 2),
  },
  {
    type: 'horizontal',
    name: { ko: '수평선', en: 'Horizontal line' },
    group: 'level',
    clicks: 1,
    // The anchor's time doesn't matter; keep the handle inside the plot.
    handles: (g) => [[Math.min(g.coords.plotWidth - 24, Math.max(24, p0(g)[0])), p0(g)[1]]],
    distance: (g, _x, y) => Math.abs(y - p0(g)[1]),
    render: (d, { painter, color, coords, badge, ...g }) => {
      const y = p0(g)[1];
      painter.hLine(y, 0, coords.plotWidth, color);
      badge(y, coords.formatPrice(d.points[0]!.price), color);
    },
  },
  {
    type: 'fibonacci',
    name: { ko: '피보나치 되돌림', en: 'Fib retracement' },
    group: 'fib',
    clicks: 2,
    distance: (g, x, y) => {
      // Nearest level line within its horizontal span, or the diagonal.
      const [x1, y1] = p0(g);
      const [x2, y2] = p1(g);
      let best = distToSegment(x, y, x1, y1, x2, y2);
      if (x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) {
        for (const level of FIB_LEVELS) best = Math.min(best, Math.abs(y - (y2 + (y1 - y2) * level)));
      }
      return best;
    },
    render: (d, { painter: p, coords: c, palette, ...g }) => {
      // Level 0 at the second point, 1 at the first.
      const [x1, y1] = p0(g);
      const [x2, y2] = p1(g);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2, left + 1);
      const a = d.points[0]!.price;
      const b = d.points[1]!.price;
      const { ctx } = p;
      FIB_LEVELS.forEach((level, i) => {
        const price = b + (a - b) * level;
        const y = c.priceToY(price);
        const levelColor = d.color ?? FIB_COLORS[i]!;
        if (i > 0) {
          const prevY = c.priceToY(b + (a - b) * FIB_LEVELS[i - 1]!);
          ctx.save();
          ctx.globalAlpha = 0.07;
          ctx.fillStyle = levelColor;
          ctx.fillRect(left, Math.min(y, prevY), right - left, Math.abs(y - prevY));
          ctx.restore();
        }
        p.hLine(y, left, right, levelColor);
        p.text(`${level} (${c.formatPrice(price)})`, left + 4, y - 7, levelColor, 'left', 'middle');
      });
      p.line(x1, y1, x2, y2, palette.textSecondary, 1, [4, 4]);
    },
  },
];

/** Built-ins plus definitions passed to the chart; later ones replace earlier ones of the same type. */
export function drawingRegistry(extra: readonly DrawingDefinition[] = []): Map<string, DrawingDefinition> {
  const registry = new Map<string, DrawingDefinition>(BUILTIN_DRAWINGS.map((d) => [d.type, d]));
  for (const def of extra) registry.set(def.type, def);
  return registry;
}

export type DrawingsChange = 'preview' | 'commit' | 'tool' | 'selection';

/**
 * Owns drawings: creation (click-click or drag), selection, handle/body dragging,
 * hit testing and rendering. Pure state + canvas; pointer routing lives in Interaction.
 * What each tool looks like comes from its DrawingDefinition.
 */
export class DrawingManager {
  drawings: Drawing[] = [];
  tool: DrawingType | null = null;
  selectedId: string | null = null;

  private draft: { drawing: Drawing; placed: DrawingPoint[] } | null = null;
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
    this.onChange('tool');
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
    this.onChange('commit');
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

  /** Esc: abort an in-progress drawing, else drop the tool, else deselect. */
  cancel(): void {
    if (this.draft || this.tool) this.setTool(null);
    else this.select(null);
  }

  // ── Creation ──────────────────────────────────────────────────────

  private expand(def: DrawingDefinition, placed: DrawingPoint[], c: PaneCoords): DrawingPoint[] {
    // Not-yet-placed clicks follow the last placed one, so the preview has every point.
    const full = Array.from({ length: def.clicks }, (_, i) => ({ ...(placed[i] ?? placed[placed.length - 1]!) }));
    return def.create ? def.create(full, c) : full;
  }

  createAt(c: PaneCoords, x: number, y: number): void {
    const def = this.tool ? this.registry.get(this.tool) : undefined;
    if (!def) return;
    const point = c.pointAt(x, y);
    if (!this.draft) {
      const placed = [point];
      this.draft = { drawing: { id: newId('d'), type: def.type, points: this.expand(def, placed, c) }, placed };
      if (def.clicks <= 1) this.finish();
      else this.onChange('preview');
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
    draft.drawing.points = this.expand(def, [...draft.placed, c.pointAt(x, y)], c);
    this.onChange('preview');
  }

  /** Pointer released: a drag since the first point places the next one (drag-to-draw). */
  releaseAt(c: PaneCoords, x: number, y: number, moved: boolean): void {
    if (this.draft && moved) this.createAt(c, x, y);
  }

  private finish(): void {
    const drawing = this.draft!.drawing;
    this.draft = null;
    this.drawings.push(drawing);
    this.selectedId = drawing.id;
    this.tool = null;
    this.onChange('tool');
    this.onChange('commit');
  }

  // ── Editing ───────────────────────────────────────────────────────

  private geometry(c: PaneCoords, d: Drawing): DrawingGeometry {
    return { coords: c, points: d.points.map((p) => [c.timeToX(p.time), c.priceToY(p.price)]) };
  }

  private handles(c: PaneCoords, d: Drawing): [number, number][] {
    const def = this.registry.get(d.type);
    const g = this.geometry(c, d);
    return def?.handles ? def.handles(g) : g.points;
  }

  hitTest(c: PaneCoords, x: number, y: number, tolerance: number): ObjectHit | null {
    const selected = this.selected;
    if (selected && this.registry.has(selected.type)) {
      const handle = this.handles(c, selected).findIndex(([px, py]) => Math.hypot(px - x, py - y) <= HANDLE_RADIUS + tolerance);
      if (handle >= 0) return { kind: 'drawing', id: selected.id, part: handle };
    }
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i]!;
      const def = this.registry.get(d.type);
      if (def && def.distance(this.geometry(c, d), x, y) <= tolerance) return { kind: 'drawing', id: d.id, part: 'body' };
    }
    return null;
  }

  beginDrag(c: PaneCoords, id: string, part: 'body' | number, x: number, y: number): void {
    const d = this.drawings.find((x) => x.id === id);
    if (!d) return;
    this.select(id);
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

  render(rc: ObjectRenderContext, badges: AxisBadge[]): void {
    const all = this.draft ? [...this.drawings, this.draft.drawing] : this.drawings;
    const c = rc.coords;
    for (const d of all) {
      const def = this.registry.get(d.type);
      if (!def) continue;
      const color = d.color ?? rc.palette.accent;
      def.render(d, {
        ...this.geometry(c, d),
        painter: rc.painter,
        palette: rc.palette,
        color,
        badge: (y, text, bg, fg = '#FFFFFF') => badges.push({ y, text, bg, fg }),
      });
      if (d.id === this.selectedId || d === this.draft?.drawing) {
        for (const [px, py] of this.handles(c, d)) rc.painter.circle(px, py, HANDLE_RADIUS, rc.palette.background, color);
      }
    }
  }
}
