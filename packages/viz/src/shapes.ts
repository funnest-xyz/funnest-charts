/** Pie/donut and treemap geometry. Pure math, no DOM. */

const TAU = Math.PI * 2;
const f = (n: number) => Math.round(n * 100) / 100;

export interface ArcSegment {
  id: string;
  value: number;
  /** Share of the total, 0–1. */
  fraction: number;
  /** Radians, clockwise from 12 o'clock. */
  startAngle: number;
  endAngle: number;
}

/**
 * Split a full circle into segments by value (negatives count as 0).
 * `padAngle` (radians) is the gap between neighbours; it is taken out of each segment.
 */
export function arcs(items: readonly { id: string; value: number }[], padAngle = 0): ArcSegment[] {
  const total = items.reduce((t, i) => t + Math.max(0, i.value), 0);
  const visible = items.filter((i) => i.value > 0).length;
  const pad = visible > 1 ? padAngle : 0;
  let a = 0;
  return items.map((i) => {
    const fraction = total > 0 ? Math.max(0, i.value) / total : 0;
    const span = fraction * TAU;
    const p = Math.min(pad, span * 0.8);
    const seg = { id: i.id, value: i.value, fraction, startAngle: a + p / 2, endAngle: a + span - p / 2 };
    a += span;
    return seg;
  });
}

const pt = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;

/**
 * SVG path for a ring segment (a pie slice when `innerRadius` is 0).
 * `cornerRadius` softens the four corners.
 */
export function arcPath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number, cornerRadius = 0): string {
  const span = endAngle - startAngle;
  if (span <= 0 || outerRadius <= 0) return '';
  // Full circle: two half arcs.
  if (span >= TAU - 1e-6) {
    const [x0, y0] = pt(cx, cy, outerRadius, 0);
    const [x1, y1] = pt(cx, cy, outerRadius, Math.PI);
    let d = `M${f(x0)},${f(y0)}A${f(outerRadius)},${f(outerRadius)} 0 1 1 ${f(x1)},${f(y1)}A${f(outerRadius)},${f(outerRadius)} 0 1 1 ${f(x0)},${f(y0)}Z`;
    if (innerRadius > 0) {
      const [i0x, i0y] = pt(cx, cy, innerRadius, 0);
      const [i1x, i1y] = pt(cx, cy, innerRadius, Math.PI);
      d += `M${f(i0x)},${f(i0y)}A${f(innerRadius)},${f(innerRadius)} 0 1 0 ${f(i1x)},${f(i1y)}A${f(innerRadius)},${f(innerRadius)} 0 1 0 ${f(i0x)},${f(i0y)}Z`;
    }
    return d;
  }
  const large = span > Math.PI ? 1 : 0;
  const thick = outerRadius - innerRadius;
  // Corner radius limited by ring thickness and by the arc length at the inner edge.
  const cr = Math.max(0, Math.min(cornerRadius, thick / 2, ((innerRadius || outerRadius) * span) / 2 - 0.01));
  if (cr <= 0.01) {
    const [ox0, oy0] = pt(cx, cy, outerRadius, startAngle);
    const [ox1, oy1] = pt(cx, cy, outerRadius, endAngle);
    let d = `M${f(ox0)},${f(oy0)}A${f(outerRadius)},${f(outerRadius)} 0 ${large} 1 ${f(ox1)},${f(oy1)}`;
    if (innerRadius > 0) {
      const [ix1, iy1] = pt(cx, cy, innerRadius, endAngle);
      const [ix0, iy0] = pt(cx, cy, innerRadius, startAngle);
      d += `L${f(ix1)},${f(iy1)}A${f(innerRadius)},${f(innerRadius)} 0 ${large} 0 ${f(ix0)},${f(iy0)}Z`;
    } else d += `L${f(cx)},${f(cy)}Z`;
    return d;
  }
  // Rounded: shrink each edge by the corner's angular size on that radius.
  const ao = cr / (outerRadius - cr);
  const ai = innerRadius > 0 ? cr / (innerRadius + cr) : 0;
  const [a1x, a1y] = pt(cx, cy, outerRadius - cr, startAngle);
  const [b1x, b1y] = pt(cx, cy, outerRadius, startAngle + ao);
  const [b2x, b2y] = pt(cx, cy, outerRadius, endAngle - ao);
  const [a2x, a2y] = pt(cx, cy, outerRadius - cr, endAngle);
  let d = `M${f(a1x)},${f(a1y)}A${f(cr)},${f(cr)} 0 0 1 ${f(b1x)},${f(b1y)}`;
  d += `A${f(outerRadius)},${f(outerRadius)} 0 ${span - 2 * ao > Math.PI ? 1 : 0} 1 ${f(b2x)},${f(b2y)}`;
  d += `A${f(cr)},${f(cr)} 0 0 1 ${f(a2x)},${f(a2y)}`;
  if (innerRadius > 0) {
    const [c2x, c2y] = pt(cx, cy, innerRadius + cr, endAngle);
    const [d2x, d2y] = pt(cx, cy, innerRadius, endAngle - ai);
    const [d1x, d1y] = pt(cx, cy, innerRadius, startAngle + ai);
    const [c1x, c1y] = pt(cx, cy, innerRadius + cr, startAngle);
    d += `L${f(c2x)},${f(c2y)}A${f(cr)},${f(cr)} 0 0 1 ${f(d2x)},${f(d2y)}`;
    d += `A${f(innerRadius)},${f(innerRadius)} 0 ${span - 2 * ai > Math.PI ? 1 : 0} 0 ${f(d1x)},${f(d1y)}`;
    d += `A${f(cr)},${f(cr)} 0 0 1 ${f(c1x)},${f(c1y)}Z`;
  } else d += `L${f(cx)},${f(cy)}Z`;
  return d;
}

/** Point at the middle of a segment, `r` from the center (labels, hover offsets). */
export function arcCentroid(cx: number, cy: number, r: number, startAngle: number, endAngle: number): { x: number; y: number } {
  const [x, y] = pt(cx, cy, r, (startAngle + endAngle) / 2);
  return { x, y };
}

export interface TreemapRect {
  id: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): rectangles with areas proportional to
 * value and aspect ratios close to 1. Items are laid out largest first; non-positive
 * values are dropped.
 */
export function treemap(items: readonly { id: string; value: number }[], width: number, height: number, gap = 0): TreemapRect[] {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((t, i) => t + i.value, 0);
  if (!total || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const out: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let i = 0;
  const worst = (row: number[], side: number) => {
    const s = row.reduce((t, v) => t + v, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  while (i < list.length) {
    const side = Math.min(w, h);
    const row: number[] = [list[i]!.value * scale];
    let j = i + 1;
    while (j < list.length) {
      const next = [...row, list[j]!.value * scale];
      if (worst(next, side) > worst(row, side)) break;
      row.push(list[j]!.value * scale);
      j++;
    }
    const sum = row.reduce((t, v) => t + v, 0);
    const thick = sum / side;
    let off = 0;
    row.forEach((area, k) => {
      const len = area / thick;
      const item = list[i + k]!;
      const r = w >= h ? { x, y: y + off, width: thick, height: len } : { x: x + off, y, width: len, height: thick };
      out.push({ id: item.id, value: item.value, ...r });
      off += len;
    });
    if (w >= h) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
    i = j;
  }
  if (gap <= 0) return out;
  const g = gap / 2;
  return out.map((r) => ({
    ...r,
    x: r.x + (r.x > 0.5 ? g : 0),
    y: r.y + (r.y > 0.5 ? g : 0),
    width: Math.max(0, r.width - (r.x > 0.5 ? g : 0) - (r.x + r.width < width - 0.5 ? g : 0)),
    height: Math.max(0, r.height - (r.y > 0.5 ? g : 0) - (r.y + r.height < height - 0.5 ? g : 0)),
  }));
}
