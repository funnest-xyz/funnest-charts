/** A continuous scale mapping a numeric domain onto a pixel range. */
export interface LinearScale {
  readonly kind: 'linear';
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  (value: number): number;
  invert(pixel: number): number;
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  // A flat domain (all values equal) maps everything onto the middle of the range.
  const scale = ((v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0))) as LinearScale;
  scale.invert = (p: number) => (r1 === r0 ? d0 : d0 + ((p - r0) / (r1 - r0)) * span);
  Object.assign(scale, { kind: 'linear', domain: [d0, d1], range: [r0, r1] });
  return scale;
}

/** A categorical scale: `count` equal bands across the range, each with inner padding. */
export interface BandScale {
  readonly kind: 'band';
  readonly count: number;
  readonly range: readonly [number, number];
  /** Width of one bar (band minus padding). */
  readonly bandwidth: number;
  /** Distance between band starts. */
  readonly step: number;
  /** Left edge of the bar for band `i`. */
  (index: number): number;
  /** Center of band `i`. */
  center(index: number): number;
  /** Band index under a pixel, clamped to [0, count-1]. */
  invert(pixel: number): number;
}

export function bandScale(count: number, range: readonly [number, number], padding = 0.2): BandScale {
  const [r0, r1] = range;
  const n = Math.max(1, count);
  const step = (r1 - r0) / n;
  const pad = clamp(padding, 0, 0.95);
  const bandwidth = step * (1 - pad);
  const scale = ((i: number) => r0 + i * step + (step - bandwidth) / 2) as BandScale;
  scale.center = (i: number) => r0 + i * step + step / 2;
  scale.invert = (p: number) => clamp(Math.floor((p - r0) / step), 0, n - 1);
  Object.assign(scale, { kind: 'band', count: n, range: [r0, r1], bandwidth, step });
  return scale;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
