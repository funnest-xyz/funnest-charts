import { newId } from '../objects/types.js';
import type { Bar } from '../types.js';
import type { IntervalVisibility } from '../intervals.js';
export { intervalUnit, shownOnInterval, type IntervalUnit, type IntervalVisibility } from '../intervals.js';
import { INDICATORS, maLines, type IndicatorDefinition, type IndicatorOutput, type IndicatorParams, type IndicatorSeries, type IndicatorType, type SeriesStyle } from './definitions.js';

/** How an indicator shows (its 모습 · 보임 settings beyond each line's own style). */
export interface IndicatorDisplay {
  /** Decimals for its values (legend, price scale); omitted: the indicator's own. */
  precision?: number;
  /** Each line's latest value on the price scale. Default true. */
  axisLabels?: boolean;
  /** Its values in the legend (상태 라인 밸류). Default true. */
  statusValues?: boolean;
  /** Its inputs after its name in the legend (상태 표시줄의 입력값): "RSI 14" or "RSI". Default true. */
  statusInputs?: boolean;
  /** Its reference levels (RSI 30 / 70). Default true. */
  levels?: boolean;
  /** One color for all its levels. */
  levelColor?: string;
  /** Its levels' values, in order (RSI 30 / 70 → 20 / 80); a level without one keeps its own. */
  levelValues?: number[];
  /** The band between its lines (Bollinger). Default true. */
  fill?: boolean;
  fillColor?: string;
  /** 보임: which intervals it shows on (omitted: all). */
  intervals?: IntervalVisibility;
}

/**
 * 타임프레임: an indicator computed on another interval's bars, then lined up with the chart's
 * (`index[i]`: the bar of `bars` chart bar i reads, -1 none). Given by the chart, which loads them.
 */
export interface TimeframeInput {
  /** Changes when the bars or the lining up do (part of the cache key). */
  key: string;
  get(): { bars: readonly Bar[]; index: Int32Array };
}

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: IndicatorParams;
  /** Hidden indicators keep their pane and legend but draw nothing. Default true. */
  visible?: boolean;
  /** Per-series color/width/visibility, keyed by series key (MA rows: 'l0', 'l1', …). */
  styles?: Record<string, SeriesStyle>;
  /**
   * 지표 위에 지표: computed from another indicator's series (`key`) instead of the candles, and
   * drawn where that one is (an MA over RSI sits in the RSI pane). Only types whose definition
   * says `onIndicator`; never on another such child. Removing the parent removes it too.
   */
  on?: { id: string; key: string };
  /** 모습 · 보임 beyond each line's style (see IndicatorDisplay). */
  display?: IndicatorDisplay;
  /**
   * 타임프레임: computed on this interval's bars instead of the chart's (a daily RSI on an hourly
   * chart). Used only while it's longer than the chart's interval. On another indicator: that
   * one is worked out on these bars too, for this one.
   */
  timeframe?: string;
  /** 타임프레임 마감 대기: only closed bars of `timeframe` (what's drawn never changes). Default true. */
  waitClose?: boolean;
}

export type IndicatorPatch = Partial<Pick<IndicatorConfig, 'params' | 'visible' | 'styles' | 'display' | 'timeframe' | 'waitClose'>>;

const clone = (c: IndicatorConfig): IndicatorConfig => JSON.parse(JSON.stringify(c)) as IndicatorConfig;

/** Built-ins plus definitions passed to the chart (`ChartOptions.indicators`); later ones replace earlier ones of the same type. */
export function indicatorRegistry(extra: readonly IndicatorDefinition[] = []): Map<string, IndicatorDefinition> {
  const registry = new Map<string, IndicatorDefinition>(Object.entries(INDICATORS));
  for (const def of extra) registry.set(def.type, def);
  return registry;
}

/** Indicator instances plus a cache of computed series keyed by data version + settings. */
export class IndicatorManager {
  list: IndicatorConfig[] = [];
  private readonly cache = new Map<string, { key: string; output: IndicatorOutput }>();

  /** The chart's 타임프레임 bars for a config (null: computed on the chart's own bars). */
  timeframeSource: (cfg: IndicatorConfig) => TimeframeInput | null = () => null;

  constructor(readonly registry: Map<string, IndicatorDefinition> = indicatorRegistry()) {}

  def(type: IndicatorType): IndicatorDefinition {
    const def = this.registry.get(type);
    if (!def) throw new Error(`funnest-charts: unknown indicator "${type}"`);
    return def;
  }

  private normalize(c: IndicatorConfig): IndicatorConfig {
    const def = this.def(c.type);
    const params = { ...def.defaults, ...c.params };
    // Migrate the legacy `periods: number[]` MA shape.
    if ((c.type === 'ma' || c.type === 'ema') && !Array.isArray(c.params.lines) && Array.isArray(c.params.periods)) {
      params.lines = maLines({ periods: c.params.periods });
    }
    delete params.periods;
    return {
      id: c.id || newId(c.type),
      type: c.type,
      params,
      visible: c.visible ?? true,
      styles: c.styles ?? {},
      ...(c.on ? { on: { id: String(c.on.id), key: String(c.on.key) } } : {}),
      ...(c.display && typeof c.display === 'object' ? { display: c.display } : {}),
      ...(typeof c.timeframe === 'string' && c.timeframe ? { timeframe: c.timeframe, ...(c.waitClose === false ? { waitClose: false } : {}) } : {}),
    };
  }

  add(type: IndicatorType, params?: IndicatorParams): string {
    const config = this.normalize({ id: newId(type), type, params: params ?? {} });
    this.list.push(config);
    return config.id;
  }

  /**
   * Adds an indicator over another one's series (see IndicatorConfig.on). Returns its id, or null
   * when it can't go there (a type that doesn't read a single series, no such indicator or
   * series, or that one is itself on an indicator).
   */
  addOn(type: IndicatorType, params: IndicatorParams | undefined, on: { id: string; key?: string }): string | null {
    const host = this.list.find((c) => c.id === on.id);
    if (!this.def(type).onIndicator || !host || host.on) return null;
    const key = on.key ?? this.firstSeriesKey(host);
    if (!key) return null;
    const config = this.normalize({ id: newId(type), type, params: params ?? {}, on: { id: host.id, key } });
    this.list.push(config);
    return config.id;
  }

  /** The series an indicator put on this one reads by default: its first line (MACD: the MACD line). */
  firstSeriesKey(host: IndicatorConfig): string | null {
    try {
      const out = this.def(host.type).compute([], host.params);
      return (out.series.find((x) => x.kind === 'line') ?? out.series[0])?.key ?? null;
    } catch {
      return null;
    }
  }

  /** Removes it, and whatever sits on it. */
  remove(id: string): boolean {
    const before = this.list.length;
    const gone = new Set([id, ...this.list.filter((c) => c.on?.id === id).map((c) => c.id)]);
    this.list = this.list.filter((c) => !gone.has(c.id));
    for (const g of gone) this.cache.delete(g);
    return this.list.length !== before;
  }

  /** The indicator this one sits on, if any. */
  parentOf(cfg: IndicatorConfig): IndicatorConfig | undefined {
    return cfg.on ? this.list.find((c) => c.id === cfg.on!.id) : undefined;
  }

  /** Indicators sitting on this one (drawn with it). */
  childrenOf(id: string): IndicatorConfig[] {
    return this.list.filter((c) => c.on?.id === id);
  }

  /** Over the candles: an overlay type on its own, or anything on an overlay. */
  isOverlay(cfg: IndicatorConfig): boolean {
    const parent = this.parentOf(cfg);
    return parent ? !!this.def(parent.type).overlay : !!this.def(cfg.type).overlay;
  }

  /** The neighbour of the same kind (overlay or pane) `by` places away, as an index into the list. */
  private neighbour(id: string, by: -1 | 1): [number, number] | null {
    const i = this.list.findIndex((c) => c.id === id);
    if (i < 0) return null;
    const me = this.list[i]!;
    // Those drawn inside a pane (on an indicator there) don't move on their own.
    if (me.on && !this.isOverlay(me)) return null;
    const overlay = this.isOverlay(me);
    for (let j = i + by; j >= 0 && j < this.list.length; j += by) {
      const other = this.list[j]!;
      if (other.on && !this.isOverlay(other)) continue;
      if (this.isOverlay(other) === overlay) return [i, j];
    }
    return null;
  }

  canMove(id: string, by: -1 | 1): boolean {
    return this.neighbour(id, by) !== null;
  }

  /** Swaps the indicator with its neighbour of the same kind. */
  move(id: string, by: -1 | 1): boolean {
    const pair = this.neighbour(id, by);
    if (!pair) return false;
    const [i, j] = pair;
    const list = [...this.list];
    [list[i], list[j]] = [list[j]!, list[i]!];
    this.list = list;
    return true;
  }

  update(id: string, patch: IndicatorPatch): boolean {
    const cfg = this.list.find((c) => c.id === id);
    if (!cfg) return false;
    if (patch.params) cfg.params = { ...cfg.params, ...patch.params };
    // Styles are replaced, not merged: removing an MA row re-keys the remaining rows.
    if (patch.styles) cfg.styles = { ...patch.styles };
    if (patch.visible !== undefined) cfg.visible = patch.visible;
    if ('display' in patch) {
      if (patch.display) cfg.display = { ...patch.display };
      else delete cfg.display;
    }
    if ('timeframe' in patch) {
      if (patch.timeframe) cfg.timeframe = patch.timeframe;
      else delete cfg.timeframe;
    }
    if ('waitClose' in patch) {
      if (patch.waitClose === false) cfg.waitClose = false;
      else delete cfg.waitClose;
    }
    return true;
  }

  /** Unknown types (e.g. a plugin this chart wasn't given) are dropped, and what sat on them. */
  set(configs: readonly IndicatorConfig[]): void {
    const known = configs.filter((c) => this.registry.has(c.type)).map((c) => this.normalize(clone(c)));
    const top = new Set(known.filter((c) => !c.on).map((c) => c.id));
    this.list = known.filter((c) => !c.on || (top.has(c.on.id) && !!this.def(c.type).onIndicator));
    this.cache.clear();
  }

  snapshot(): IndicatorConfig[] {
    return this.list.map(clone);
  }

  /** Drawn over the candles (overlay types, and what sits on them). */
  get overlays(): IndicatorConfig[] {
    return this.list.filter((c) => this.isOverlay(c));
  }

  /** Each gets a pane (what sits on one is drawn in it: `childrenOf`). */
  get panes(): IndicatorConfig[] {
    return this.list.filter((c) => !c.on && !this.def(c.type).overlay);
  }

  /** Computed series with user styles applied; recomputed only when data or settings change. */
  output(cfg: IndicatorConfig, bars: readonly Bar[], dataVersion: number): IndicatorOutput {
    const parent = this.parentOf(cfg);
    const timeframe = this.timeframeSource(cfg);
    const parentKey = parent ? `${cfg.on!.key}:${JSON.stringify(parent.params)}:${parent.timeframe ?? ''}:${this.timeframeSource(parent)?.key ?? ''}` : '';
    const key = `${dataVersion}|${JSON.stringify(cfg.params)}|${JSON.stringify(cfg.styles)}|${JSON.stringify(cfg.display ?? null)}|${parentKey}|${timeframe?.key ?? ''}`;
    const hit = this.cache.get(cfg.id);
    if (hit?.key === key) return hit.output;
    const raw = timeframe
      ? this.computeOnTimeframe(cfg, parent, bars.length, timeframe)
      : parent
        ? this.computeOn(cfg, parent, bars, dataVersion)
        : this.def(cfg.type).compute(bars, cfg.params);
    const d = cfg.display ?? {};
    const output: IndicatorOutput = {
      ...raw,
      series: raw.series.map((s) => {
        const style = cfg.styles?.[s.key];
        return {
          ...s,
          color: style?.color ?? s.color,
          width: style?.width ?? s.width,
          visible: style?.visible ?? s.visible,
          ...(style?.lineStyle ? { lineStyle: style.lineStyle } : {}),
          ...(style?.kind ? { kind: style.kind } : {}),
        };
      }),
      ...(d.precision !== undefined && Number.isInteger(d.precision) ? { precision: Math.max(0, Math.min(10, d.precision)) } : {}),
    };
    if (d.levels === false) delete output.levels;
    else if (output.levels && (d.levelColor || d.levelValues?.length)) {
      const color = d.levelColor;
      const values = d.levelValues ?? [];
      output.levels = output.levels.map((l, i) => {
        const own = typeof l === 'number' ? { value: l } : l;
        const v = values[i];
        return { ...own, ...(v !== undefined && Number.isFinite(v) ? { value: v } : {}), ...(color ? { color } : {}) };
      });
    }
    if (d.fill === false) {
      delete output.fill;
      delete output.fills;
    } else if (d.fillColor) {
      if (output.fill) output.fill = { ...output.fill, color: d.fillColor, ...(output.fill.downColor ? { downColor: d.fillColor } : {}) };
      if (output.fills) output.fills = output.fills.map((f) => ({ ...f, color: d.fillColor! }));
    }
    this.cache.set(cfg.id, { key, output });
    return output;
  }

  /**
   * 타임프레임: computed on the longer interval's bars, then each chart bar takes the value of the
   * bar it reads (its lines and bands only: candle colors and marks belong to the chart's bars).
   */
  private computeOnTimeframe(cfg: IndicatorConfig, parent: IndicatorConfig | undefined, length: number, timeframe: TimeframeInput): IndicatorOutput {
    const { bars, index } = timeframe.get();
    let out: IndicatorOutput;
    if (parent) {
      // On another indicator: that one on these bars, then this one on its series.
      const source = this.def(parent.type).compute(bars, parent.params).series.find((x) => x.key === cfg.on!.key);
      out = this.computeOnValues(cfg, source?.values ?? new Float64Array(bars.length).fill(Number.NaN), bars);
    } else out = this.def(cfg.type).compute(bars, cfg.params);
    const spread = (s: IndicatorSeries): IndicatorSeries => {
      const values = new Float64Array(length).fill(Number.NaN);
      for (let i = 0; i < length; i++) {
        const j = index[i] ?? -1;
        if (j >= 0) values[i] = s.values[j] ?? Number.NaN;
      }
      // Colors per bar and shifts are in the other interval's bars: dropped.
      const { colors: _colors, shift: _shift, ...rest } = s;
      return { ...rest, values };
    };
    return {
      series: out.series.map(spread),
      ...(out.fill && !out.fill.colors ? { fill: out.fill } : {}),
      ...(out.fills ? { fills: out.fills.filter((f) => !f.colors) } : {}),
      ...(out.levels ? { levels: out.levels } : {}),
      ...(out.range ? { range: out.range } : {}),
      precision: out.precision,
    };
  }

  /**
   * An indicator over another's series: that series stands in for every price of each bar, and
   * the bars before its first value are left out (an RSI has none for its first 14) — then the
   * answer is lined up with the chart's bars again.
   */
  private computeOn(cfg: IndicatorConfig, parent: IndicatorConfig, bars: readonly Bar[], dataVersion: number): IndicatorOutput {
    const source = this.output(parent, bars, dataVersion).series.find((x) => x.key === cfg.on!.key);
    return this.computeOnValues(cfg, source?.values ?? new Float64Array(bars.length).fill(Number.NaN), bars);
  }

  /** `cfg` computed with `values` (lined up with `bars`) as every price of each bar. */
  private computeOnValues(cfg: IndicatorConfig, values: Float64Array, bars: readonly Bar[]): IndicatorOutput {
    const def = this.def(cfg.type);
    let first = 0;
    while (first < values.length && !Number.isFinite(values[first]!)) first++;
    const own: Bar[] = [];
    for (let i = first; i < bars.length; i++) {
      const v = values[i]!;
      // A gap inside (rare) carries the last value on, so averages don't break.
      const x = Number.isFinite(v) ? v : (own[own.length - 1]?.close ?? Number.NaN);
      own.push({ time: bars[i]!.time, open: x, high: x, low: x, close: x, volume: 0 });
    }
    const out = def.compute(own, cfg.params);
    const pad = (a: Float64Array) => {
      const full = new Float64Array(bars.length).fill(Number.NaN);
      full.set(a.subarray(0, bars.length - first), first);
      return full;
    };
    // Only its lines and bands: candle colors, marks and a fixed range belong to the candles' pane.
    return {
      series: out.series.map((x) => ({ ...x, values: pad(x.values) })),
      ...(out.fill ? { fill: out.fill } : {}),
      ...(out.fills ? { fills: out.fills } : {}),
      precision: out.precision,
    };
  }
}
