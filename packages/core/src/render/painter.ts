/**
 * Pixel-aligned drawing helpers. Lines are drawn as filled rects snapped to the
 * device-pixel grid so they stay crisp at any devicePixelRatio.
 */
export class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly dpr: number,
  ) {}

  /** Thickness of a "1px" hairline: one whole device pixel (or more on high-DPR screens). */
  get hairline(): number {
    return Math.max(1, Math.floor(this.dpr)) / this.dpr;
  }

  snap(v: number): number {
    return Math.floor(v * this.dpr) / this.dpr;
  }

  hLine(y: number, x1: number, x2: number, color: string, dash?: readonly [number, number]): void {
    const { ctx } = this;
    const y0 = this.snap(y);
    const t = this.hairline;
    ctx.fillStyle = color;
    if (!dash) {
      ctx.fillRect(x1, y0, x2 - x1, t);
      return;
    }
    const [on, off] = dash;
    for (let x = x1; x < x2; x += on + off) ctx.fillRect(this.snap(x), y0, Math.min(on, x2 - x), t);
  }

  vLine(x: number, y1: number, y2: number, color: string, dash?: readonly [number, number]): void {
    const { ctx } = this;
    const x0 = this.snap(x);
    const t = this.hairline;
    ctx.fillStyle = color;
    if (!dash) {
      ctx.fillRect(x0, y1, t, y2 - y1);
      return;
    }
    const [on, off] = dash;
    for (let y = y1; y < y2; y += on + off) ctx.fillRect(x0, this.snap(y), t, Math.min(on, y2 - y));
  }

  text(
    str: string,
    x: number,
    y: number,
    color: string,
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'middle',
  ): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, color: string): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(this.snap(x), this.snap(y), this.snap(w), this.snap(h), r);
    ctx.fill();
  }

  measure(str: string): number {
    return this.ctx.measureText(str).width;
  }

  /** Anti-aliased line for arbitrary angles (trendlines). */
  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1, dash?: readonly number[]): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash as number[]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  circle(x: number, y: number, r: number, fill: string, stroke?: string, strokeWidth = 1.5): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * A row of joined label segments ("pill") centered vertically on `y`.
   * Returns each segment's rect for hit testing (e.g. an order's cancel button).
   */
  pill(segments: readonly PillSegment[], x: number, y: number, height = 20, radius = 4): Rect[] {
    const { ctx } = this;
    const rects: Rect[] = [];
    let cx = x;
    const top = y - height / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    segments.forEach((seg, i) => {
      const w = Math.ceil(this.measure(seg.text)) + (seg.padding ?? 8) * 2;
      const r = [i === 0 ? radius : 0, i === segments.length - 1 ? radius : 0];
      ctx.fillStyle = seg.bg;
      ctx.beginPath();
      ctx.roundRect(cx, top, w, height, [r[0]!, r[1]!, r[1]!, r[0]!]);
      ctx.fill();
      ctx.fillStyle = seg.fg;
      ctx.fillText(seg.text, cx + (seg.padding ?? 8), y);
      rects.push({ x: cx, y: top, w, h: height });
      cx += w;
    });
    return rects;
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PillSegment {
  text: string;
  bg: string;
  fg: string;
  padding?: number;
}

export const inRect = (r: Rect, x: number, y: number, pad = 0) =>
  x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
