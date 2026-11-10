export interface XY {
  x: number;
  y: number;
}

export type Curve = 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter';

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * SVG path data through the points. Works for web <path d> and react-native-svg alike.
 * 'monotone' is the Fritsch–Carlson cubic: smooth, but never overshoots the data
 * (no fake highs/lows between samples — important for price charts).
 */
export function linePath(points: readonly XY[], curve: Curve = 'linear'): string {
  const n = points.length;
  if (n === 0) return '';
  const p0 = points[0]!;
  let d = `M${f(p0.x)},${f(p0.y)}`;
  if (n === 1) return d;
  switch (curve) {
    case 'monotone':
      return d + monotoneSegments(points);
    case 'step':
      for (let i = 1; i < n; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        d += `H${f((a.x + b.x) / 2)}V${f(b.y)}H${f(b.x)}`;
      }
      return d;
    case 'stepAfter':
      for (let i = 1; i < n; i++) d += `H${f(points[i]!.x)}V${f(points[i]!.y)}`;
      return d;
    case 'stepBefore':
      for (let i = 1; i < n; i++) d += `V${f(points[i]!.y)}H${f(points[i]!.x)}`;
      return d;
    default:
      for (let i = 1; i < n; i++) d += `L${f(points[i]!.x)},${f(points[i]!.y)}`;
      return d;
  }
}

/**
 * Closed area between the `top` line and either a flat `baseline` y or a `bottom` line
 * (same length as `top`, used for stacked areas / bands).
 */
export function areaPath(top: readonly XY[], baseline: number | readonly XY[], curve: Curve = 'linear'): string {
  if (top.length === 0) return '';
  const upper = linePath(top, curve);
  if (typeof baseline === 'number') {
    const last = top[top.length - 1]!;
    const first = top[0]!;
    return `${upper}L${f(last.x)},${f(baseline)}L${f(first.x)},${f(baseline)}Z`;
  }
  const lower = linePath([...baseline].reverse(), curve).replace(/^M/, 'L');
  return `${upper}${lower}Z`;
}

/** Split a series with gaps (null / NaN) into continuous runs. */
export function segments<T>(values: readonly (T | null | undefined)[]): { start: number; values: T[] }[] {
  const out: { start: number; values: T[] }[] = [];
  let cur: { start: number; values: T[] } | null = null;
  values.forEach((v, i) => {
    if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) {
      cur = null;
      return;
    }
    if (!cur) {
      cur = { start: i, values: [] };
      out.push(cur);
    }
    cur.values.push(v);
  });
  return out;
}

/**
 * Bar from `baseY` to `valueY` (pixels), `radius` rounding only the end away from the
 * baseline — so negative bars round at the bottom.
 */
export function barPath(x: number, width: number, baseY: number, valueY: number, radius = 0): string {
  const top = Math.min(baseY, valueY);
  const h = Math.abs(valueY - baseY);
  const r = Math.max(0, Math.min(radius, width / 2, h));
  const x1 = x + width;
  if (r === 0) return `M${f(x)},${f(top)}H${f(x1)}V${f(top + h)}H${f(x)}Z`;
  if (valueY <= baseY) {
    // Grows upward: round the top corners.
    return (
      `M${f(x)},${f(baseY)}V${f(top + r)}Q${f(x)},${f(top)} ${f(x + r)},${f(top)}` +
      `H${f(x1 - r)}Q${f(x1)},${f(top)} ${f(x1)},${f(top + r)}V${f(baseY)}Z`
    );
  }
  const bottom = top + h;
  return (
    `M${f(x)},${f(baseY)}V${f(bottom - r)}Q${f(x)},${f(bottom)} ${f(x + r)},${f(bottom)}` +
    `H${f(x1 - r)}Q${f(x1)},${f(bottom)} ${f(x1)},${f(bottom - r)}V${f(baseY)}Z`
  );
}

function monotoneSegments(p: readonly XY[]): string {
  const n = p.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = p[i + 1]!.x - p[i]!.x;
    dx.push(h);
    slope.push(h === 0 ? 0 : (p[i + 1]!.y - p[i]!.y) / h);
  }
  const t: number[] = new Array<number>(n).fill(0);
  t[0] = slope[0]!;
  t[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1]!;
    const s1 = slope[i]!;
    if (s0 * s1 <= 0) continue; // local extremum: flat tangent, no overshoot
    const h0 = dx[i - 1]!;
    const h1 = dx[i]!;
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    t[i] = (w1 + w2) / (w1 / s0 + w2 / s1);
  }
  let d = '';
  for (let i = 0; i < n - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${f(a.x + h)},${f(a.y + t[i]! * h)} ${f(b.x - h)},${f(b.y - t[i + 1]! * h)} ${f(b.x)},${f(b.y)}`;
  }
  return d;
}
