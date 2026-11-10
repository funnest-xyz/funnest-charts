export interface TimeScaleOptions {
  /** Pixels per bar. */
  barSpacing: number;
  minBarSpacing: number;
  maxBarSpacing: number;
  /** Empty space right of the last bar, in bars. */
  rightOffset: number;
}

export const DEFAULT_TIME_SCALE_OPTIONS: TimeScaleOptions = {
  barSpacing: 8,
  minBarSpacing: 0.5,
  maxBarSpacing: 60,
  rightOffset: 5,
};

export interface IndexRange {
  from: number;
  to: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Index-based horizontal scale: bars are evenly spaced regardless of time gaps
 * (closed market hours collapse). `rightOffset` is stored relative to the last
 * bar so appending keeps the realtime edge pinned and prepending history keeps
 * the view still.
 */
export class TimeScale {
  width = 0;
  barCount = 0;
  barSpacing: number;
  rightOffset: number;

  constructor(readonly options: TimeScaleOptions = DEFAULT_TIME_SCALE_OPTIONS) {
    this.barSpacing = options.barSpacing;
    this.rightOffset = options.rightOffset;
  }

  /** Logical (fractional) bar index at the right edge. */
  get rightIndex(): number {
    return this.barCount - 1 + this.rightOffset;
  }

  /** Center x of bar `index`. */
  indexToX(index: number): number {
    return this.width - (this.rightIndex - index + 0.5) * this.barSpacing;
  }

  xToIndexFloat(x: number): number {
    return this.rightIndex - (this.width - x) / this.barSpacing + 0.5;
  }

  xToIndex(x: number): number {
    return Math.round(this.xToIndexFloat(x));
  }

  /** Visible bar indices clamped to existing data. `to < from` when nothing is visible. */
  visibleRange(): IndexRange {
    if (this.barCount === 0 || this.width <= 0) return { from: 0, to: -1 };
    return {
      from: Math.max(0, Math.round(this.xToIndexFloat(0))),
      to: Math.min(this.barCount - 1, Math.round(this.xToIndexFloat(this.width))),
    };
  }

  pan(dx: number): void {
    this.rightOffset -= dx / this.barSpacing;
    this.clamp();
  }

  /** Zooms by `factor` keeping the bar under `anchorX` fixed. */
  zoom(anchorX: number, factor: number): void {
    const anchorIndex = this.xToIndexFloat(anchorX);
    this.barSpacing = clamp(this.barSpacing * factor, this.options.minBarSpacing, this.options.maxBarSpacing);
    const rightIndex = anchorIndex + (this.width - anchorX) / this.barSpacing - 0.5;
    this.rightOffset = rightIndex - (this.barCount - 1);
    this.clamp();
  }

  reset(): void {
    this.barSpacing = this.options.barSpacing;
    this.rightOffset = this.options.rightOffset;
    this.clamp();
  }

  fitContent(): void {
    if (this.barCount === 0 || this.width <= 0) return;
    this.barSpacing = clamp(
      this.width / (this.barCount + this.options.rightOffset),
      this.options.minBarSpacing,
      this.options.maxBarSpacing,
    );
    this.rightOffset = this.options.rightOffset;
    this.clamp();
  }

  /** Keeps at least a couple of bars on screen. */
  clamp(): void {
    this.barSpacing = clamp(this.barSpacing, this.options.minBarSpacing, this.options.maxBarSpacing);
    if (this.barCount === 0 || this.width <= 0) return;
    const minBars = Math.min(this.barCount, 2);
    const minOffset = minBars - this.barCount;
    const maxOffset = Math.max(minOffset, this.width / this.barSpacing - minBars);
    this.rightOffset = clamp(this.rightOffset, minOffset, maxOffset);
  }
}
