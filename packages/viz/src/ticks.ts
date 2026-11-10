const STEPS = [1, 2, 2.5, 5, 10];

/** Strip float noise such as 0.30000000000000004. */
const round = (v: number) => Number.parseFloat(v.toPrecision(12));

/** The "nice" step (1, 2, 2.5 or 5 × 10ⁿ) giving about `count` intervals over [min, max]. */
export function niceStep(min: number, max: number, count = 5): number {
  const span = Math.abs(max - min);
  if (!Number.isFinite(span) || span === 0) return 1;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = STEPS.find((s) => s >= norm - 1e-9) ?? 10;
  return round(step * mag);
}

/** Expand [min, max] outward to multiples of a nice step. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    return [round(min - pad), round(max + pad)];
  }
  const step = niceStep(min, max, count);
  return [round(Math.floor(min / step + 1e-9) * step), round(Math.ceil(max / step - 1e-9) * step)];
}

/** Nice tick values inside [min, max] (inclusive). */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const step = niceStep(lo, hi, count);
  const out: number[] = [];
  const first = Math.ceil(lo / step - 1e-9);
  for (let k = first; k * step <= hi + step * 1e-9; k++) out.push(round(k * step));
  return out;
}

/**
 * Pick at most `max` evenly spread indices out of `count` (for category / time labels),
 * always keeping the first one.
 */
export function sampleIndices(count: number, max: number): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const every = Math.ceil(count / Math.max(1, max));
  const out: number[] = [];
  for (let i = 0; i < count; i += every) out.push(i);
  return out;
}

/**
 * Ticks for a log scale: 1, 2, 5 × 10ⁿ inside [min, max] (min > 0). Falls back to powers
 * of ten alone when that would be too many, and to linear ticks for a narrow range.
 */
export function logTicks(min: number, max: number, count = 5): number[] {
  if (!(min > 0) || !(max > min)) return ticks(min, max, count);
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  if (hi - lo <= 1) return ticks(min, max, count);
  const pick = (mults: number[]) => {
    const out: number[] = [];
    for (let e = lo; e <= hi; e++) for (const m of mults) {
      const v = round(m * 10 ** e);
      if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v);
    }
    return out;
  };
  const dense = pick([1, 2, 5]);
  return dense.length <= count * 2 ? dense : pick([1]);
}
