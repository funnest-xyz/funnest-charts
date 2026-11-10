import { newId, type AxisBadge, type ObjectHit, type ObjectRenderContext, type PaneCoords } from './types';

export type DrawingType = 'trendline' | 'horizontal' | 'fibonacci';

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

export const DRAWING_POINTS: Record<DrawingType, number> = { trendline: 2, horizontal: 1, fibonacci: 2 };
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#8B95A1', '#F04452', '#FF9F0A', '#12B886', '#3182F6', '#7048E8', '#8B95A1'];

const HANDLE_RADIUS = 5;

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export type DrawingsChange = 'preview' | 'commit' | 'tool' | 'selection';

/**
 * Owns drawings: creation (click-click or drag), selection, handle/body dragging,
 * hit testing and rendering. Pure state + canvas; pointer routing lives in Interaction.
 */
export class DrawingManager {
  drawings: Drawing[] = [];
  tool: DrawingType | null = null;
  selectedId: string | null = null;

  private draft: { drawing: Drawing; placed: number } | null = null;
  private drag: { id: string; part: 'body' | number; x: number; y: number; origin: [number, number][] } | null = null;

  constructor(private readonly onChange: (change: DrawingsChange) => void) {}

  get selected(): Drawing | null {
    return this.drawings.find((d) => d.id === this.selectedId) ?? null;
  }

  setTool(tool: DrawingType | null): void {
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

  createAt(c: PaneCoords, x: number, y: number): void {
    if (!this.tool) return;
    const point = c.pointAt(x, y);
    if (!this.draft) {
      const count = DRAWING_POINTS[this.tool];
      const drawing: Drawing = { id: newId('d'), type: this.tool, points: Array.from({ length: count }, () => ({ ...point })) };
      this.draft = { drawing, placed: 1 };
      if (count === 1) this.finish();
      else this.onChange('preview');
      return;
    }
    this.draft.drawing.points[this.draft.placed] = point;
    this.draft.placed++;
    if (this.draft.placed >= this.draft.drawing.points.length) this.finish();
  }

  /** Moves the not-yet-placed points (live preview while hovering or dragging). */
  previewAt(c: PaneCoords, x: number, y: number): void {
    if (!this.draft) return;
    const point = c.pointAt(x, y);
    for (let i = this.draft.placed; i < this.draft.drawing.points.length; i++) this.draft.drawing.points[i] = { ...point };
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

  hitTest(c: PaneCoords, x: number, y: number, tolerance: number): ObjectHit | null {
    const selected = this.selected;
    if (selected) {
      const handle = this.screenPoints(c, selected).findIndex(
        ([px, py]) => Math.hypot(px - x, py - y) <= HANDLE_RADIUS + tolerance,
      );
      if (handle >= 0) return { kind: 'drawing', id: selected.id, part: handle };
    }
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i]!;
      if (this.distance(c, d, x, y) <= tolerance) return { kind: 'drawing', id: d.id, part: 'body' };
    }
    return null;
  }

  beginDrag(c: PaneCoords, id: string, part: 'body' | number, x: number, y: number): void {
    const d = this.drawings.find((x) => x.id === id);
    if (!d) return;
    this.select(id);
    this.drag = { id, part, x, y, origin: this.screenPoints(c, d) };
  }

  dragTo(c: PaneCoords, x: number, y: number): void {
    const drag = this.drag;
    const d = drag && this.drawings.find((x) => x.id === drag.id);
    if (!drag || !d) return;
    if (typeof drag.part === 'number') {
      d.points[drag.part] = c.pointAt(x, y);
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

  private screenPoints(c: PaneCoords, d: Drawing): [number, number][] {
    return d.points.map((p) => [d.type === 'horizontal' ? Math.min(c.plotWidth - 24, Math.max(24, c.timeToX(p.time))) : c.timeToX(p.time), c.priceToY(p.price)]);
  }

  private distance(c: PaneCoords, d: Drawing, x: number, y: number): number {
    const pts = this.screenPoints(c, d);
    const [x1, y1] = pts[0]!;
    if (d.type === 'horizontal') return Math.abs(y - y1);
    const [x2, y2] = pts[1]!;
    if (d.type === 'trendline') return distToSegment(x, y, x1, y1, x2, y2);
    // Fibonacci: nearest level line within its horizontal span, or the diagonal.
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    let best = distToSegment(x, y, x1, y1, x2, y2);
    if (x >= left && x <= right) {
      for (const level of FIB_LEVELS) best = Math.min(best, Math.abs(y - (y2 + (y1 - y2) * level)));
    }
    return best;
  }

  // ── Rendering ─────────────────────────────────────────────────────

  render(rc: ObjectRenderContext, badges: AxisBadge[]): void {
    const all = this.draft ? [...this.drawings, this.draft.drawing] : this.drawings;
    for (const d of all) {
      const isDraft = d === this.draft?.drawing;
      this.renderOne(rc, d, badges);
      if (d.id === this.selectedId || isDraft) {
        const color = d.color ?? rc.palette.accent;
        for (const [px, py] of this.screenPoints(rc.coords, d)) rc.painter.circle(px, py, HANDLE_RADIUS, rc.palette.background, color);
      }
    }
  }

  private renderOne({ painter: p, coords: c, palette }: ObjectRenderContext, d: Drawing, badges: AxisBadge[]): void {
    const color = d.color ?? palette.accent;
    const pts = this.screenPoints(c, d);
    const [x1, y1] = pts[0]!;

    if (d.type === 'horizontal') {
      p.hLine(y1, 0, c.plotWidth, color);
      badges.push({ y: y1, text: c.formatPrice(d.points[0]!.price), bg: color, fg: '#FFFFFF' });
      return;
    }
    const [x2, y2] = pts[1]!;
    if (d.type === 'trendline') {
      p.line(x1, y1, x2, y2, color, 2);
      return;
    }

    // Fibonacci retracement: level 0 at the second point, 1 at the first.
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2, left + 1);
    const p0 = d.points[0]!.price;
    const p1 = d.points[1]!.price;
    const { ctx } = p;
    FIB_LEVELS.forEach((level, i) => {
      const price = p1 + (p0 - p1) * level;
      const y = c.priceToY(price);
      const levelColor = d.color ?? FIB_COLORS[i]!;
      if (i > 0) {
        const prevY = c.priceToY(p1 + (p0 - p1) * FIB_LEVELS[i - 1]!);
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
  }
}
