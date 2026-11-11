import { decimalsOf } from '../price';

export interface PriceScaleMargins {
  /** Fraction of pane height kept empty above the max price. */
  top: number;
  /** Fraction of pane height kept empty below the min price. */
  bottom: number;
}

/**
 * 'normal': linear prices. 'log': equal distances are equal ratios. 'percent': linear, but labels
 * show the change from a base price (the first visible bar's close).
 */
export type PriceScaleMode = 'normal' | 'log' | 'percent';

/** Vertical scale for one pane. y is relative to the pane's top. */
export class PriceScale {
  height = 0;
  mode: PriceScaleMode = 'normal';
  /** Pixels reserved at the top for overlays (e.g. a legend); margins apply below it. */
  insetTop = 0;
  autoScale = true;
  private lo = 0;
  private hi = 1;

  constructor(readonly margins: PriceScaleMargins) {}

  get min(): number {
    return this.lo;
  }

  get max(): number {
    return this.hi;
  }

  setRange(min: number, max: number): void {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    if (max < min) [min, max] = [max, min];
    // Log axes can't show zero or negatives; keep at least 3 decades under the max.
    if (this.mode === 'log' && min <= 0) min = max > 0 ? max / 1000 : LOG_FLOOR;
    if (max - min < 1e-12) {
      const pad = Math.abs(max) * 0.01 || 1;
      min -= pad;
      max += pad;
    }
    this.lo = min;
    this.hi = max;
  }

  /** Height left after the inset (never less than half the pane, so tiny panes still show data). */
  private get available(): number {
    return Math.max(this.height / 2, this.height - this.insetTop);
  }

  private get innerTop(): number {
    return this.height - this.available + this.available * this.margins.top;
  }

  private get innerHeight(): number {
    return Math.max(1, this.available * (1 - this.margins.top - this.margins.bottom));
  }

  /** Price → the space the axis is linear in (log prices in log mode). */
  private toAxis(price: number): number {
    return this.mode === 'log' ? Math.log(Math.max(price, LOG_FLOOR)) : price;
  }

  private fromAxis(v: number): number {
    return this.mode === 'log' ? Math.exp(v) : v;
  }

  priceToY(price: number): number {
    const lo = this.toAxis(this.lo);
    const hi = this.toAxis(this.hi);
    return this.innerTop + ((hi - this.toAxis(price)) / (hi - lo)) * this.innerHeight;
  }

  yToPrice(y: number): number {
    const lo = this.toAxis(this.lo);
    const hi = this.toAxis(this.hi);
    return this.fromAxis(hi - ((y - this.innerTop) / this.innerHeight) * (hi - lo));
  }

  /** Sets the range in axis space (log prices in log mode). */
  private setAxisRange(lo: number, hi: number): void {
    this.setRange(this.fromAxis(lo), this.fromAxis(hi));
  }

  /** Scales around the center. factor > 1 shows a wider price range. Disables auto-scale. */
  zoom(factor: number): void {
    const lo = this.toAxis(this.lo);
    const hi = this.toAxis(this.hi);
    const center = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * factor;
    this.setAxisRange(center - half, center + half);
    this.autoScale = false;
  }

  /** Moves the content by `dy` pixels (positive = content moves down). Disables auto-scale. */
  pan(dy: number): void {
    const lo = this.toAxis(this.lo);
    const hi = this.toAxis(this.hi);
    const delta = (dy / this.innerHeight) * (hi - lo);
    this.setAxisRange(lo + delta, hi + delta);
    this.autoScale = false;
  }
}

const LOG_FLOOR = 1e-12;
const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10];

/**
 * Tick values for a log axis: roughly one per `spacing` px, each rounded to a nice step for the
 * price distance at that height (1/2/2.5/5 × 10ⁿ, at least `minStep`). Spacing in price grows upward.
 */
export function logTicks(scale: PriceScale, spacing: number, minStep = 0): number[] {
  const ticks: number[] = [];
  for (let y = scale.height - spacing / 2; y > 0; y -= spacing) {
    const raw = scale.yToPrice(y);
    if (!(raw > 0)) continue;
    const local = scale.yToPrice(y - spacing) - raw;
    const mag = 10 ** Math.floor(Math.log10(local));
    let step = NICE_MULTIPLIERS.map((m) => m * mag).find((s) => s >= local * 0.75) ?? 10 * mag;
    if (minStep > 0) step = Math.max(minStep, Math.round(step / minStep) * minStep);
    const best = Number((Math.round(raw / step) * step).toPrecision(12));
    if (!(best > 0)) continue;
    // Rounding can pull neighbours onto the same value near the bottom; keep labels apart.
    const prev = ticks[ticks.length - 1];
    if (prev === undefined || Math.abs(scale.priceToY(best) - scale.priceToY(prev)) >= spacing * 0.6) ticks.push(best);
  }
  return ticks;
}

/**
 * "Nice" tick values (1/2/2.5/5 × 10ⁿ) covering [min, max] with at most ~maxCount ticks.
 * `minStep` (e.g. the instrument's tick size) prevents sub-tick grid lines.
 */
export function niceTicks(min: number, max: number, maxCount: number, minStep = 0): number[] {
  if (!(max > min) || maxCount < 1) return [];
  const rough = (max - min) / maxCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  // With a tick size, only steps that are whole multiples of it qualify — otherwise labels
  // land on untradeable prices (e.g. 71,750 when KRX trades in 100s).
  const fits = (step: number) => minStep <= 0 || Math.abs(step / minStep - Math.round(step / minStep)) < 1e-6;
  let step = Number.NaN;
  for (let mag = magnitude; Number.isNaN(step); mag *= 10) {
    for (const m of NICE_MULTIPLIERS) {
      const candidate = m * mag;
      if (candidate >= rough && candidate >= minStep && fits(candidate)) {
        step = candidate;
        break;
      }
    }
  }
  // If skipping an untradeable step forced a big jump (250 → 500), a slightly-denser
  // tradeable step (200) is closer to the requested spacing.
  if (step > rough * 1.6) {
    for (const m of [...NICE_MULTIPLIERS].reverse()) {
      const candidate = m * magnitude;
      if (candidate < step && candidate >= rough * 0.75 && candidate >= minStep && fits(candidate)) {
        step = candidate;
        break;
      }
    }
  }
  step = Number(step.toPrecision(12));
  const decimals = decimalsOf(step);

  const ticks: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last && ticks.length < 1000; k++) {
    ticks.push(Number((k * step).toFixed(decimals)));
  }
  return ticks;
}
