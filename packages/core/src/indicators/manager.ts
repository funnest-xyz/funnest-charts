import { newId } from '../objects/types';
import type { Bar } from '../types';
import { INDICATORS, maLines, type IndicatorOutput, type IndicatorParams, type IndicatorType, type SeriesStyle } from './definitions';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  params: IndicatorParams;
  /** Hidden indicators keep their pane and legend but draw nothing. Default true. */
  visible?: boolean;
  /** Per-series color/width/visibility, keyed by series key (MA rows: 'l0', 'l1', …). */
  styles?: Record<string, SeriesStyle>;
}

export type IndicatorPatch = Partial<Pick<IndicatorConfig, 'params' | 'visible' | 'styles'>>;

const clone = (c: IndicatorConfig): IndicatorConfig => JSON.parse(JSON.stringify(c)) as IndicatorConfig;

function normalize(c: IndicatorConfig): IndicatorConfig {
  const def = INDICATORS[c.type];
  const params = { ...def.defaults, ...c.params };
  // Migrate the legacy `periods: number[]` MA shape.
  if ((c.type === 'ma' || c.type === 'ema') && !Array.isArray(c.params.lines) && Array.isArray(c.params.periods)) {
    params.lines = maLines({ periods: c.params.periods });
  }
  delete params.periods;
  return { id: c.id || newId(c.type), type: c.type, params, visible: c.visible ?? true, styles: c.styles ?? {} };
}

/** Indicator instances plus a cache of computed series keyed by data version + settings. */
export class IndicatorManager {
  list: IndicatorConfig[] = [];
  private readonly cache = new Map<string, { key: string; output: IndicatorOutput }>();

  add(type: IndicatorType, params?: IndicatorParams): string {
    if (!INDICATORS[type]) throw new Error(`funnest-charts: unknown indicator "${type}"`);
    const config = normalize({ id: newId(type), type, params: params ?? {} });
    this.list.push(config);
    return config.id;
  }

  remove(id: string): boolean {
    const before = this.list.length;
    this.list = this.list.filter((c) => c.id !== id);
    this.cache.delete(id);
    return this.list.length !== before;
  }

  update(id: string, patch: IndicatorPatch): boolean {
    const cfg = this.list.find((c) => c.id === id);
    if (!cfg) return false;
    if (patch.params) cfg.params = { ...cfg.params, ...patch.params };
    // Styles are replaced, not merged: removing an MA row re-keys the remaining rows.
    if (patch.styles) cfg.styles = { ...patch.styles };
    if (patch.visible !== undefined) cfg.visible = patch.visible;
    return true;
  }

  set(configs: readonly IndicatorConfig[]): void {
    this.list = configs.filter((c) => INDICATORS[c.type]).map((c) => normalize(clone(c)));
    this.cache.clear();
  }

  snapshot(): IndicatorConfig[] {
    return this.list.map(clone);
  }

  get overlays(): IndicatorConfig[] {
    return this.list.filter((c) => INDICATORS[c.type].overlay);
  }

  get panes(): IndicatorConfig[] {
    return this.list.filter((c) => !INDICATORS[c.type].overlay);
  }

  /** Computed series with user styles applied; recomputed only when data or settings change. */
  output(cfg: IndicatorConfig, bars: readonly Bar[], dataVersion: number): IndicatorOutput {
    const key = `${dataVersion}|${JSON.stringify(cfg.params)}|${JSON.stringify(cfg.styles)}`;
    const hit = this.cache.get(cfg.id);
    if (hit?.key === key) return hit.output;
    const raw = INDICATORS[cfg.type].compute(bars, cfg.params);
    const output: IndicatorOutput = {
      ...raw,
      series: raw.series.map((s) => {
        const style = cfg.styles?.[s.key];
        return {
          ...s,
          color: style?.color ?? s.color,
          width: style?.width ?? s.width,
          visible: style?.visible ?? s.visible,
        };
      }),
    };
    this.cache.set(cfg.id, { key, output });
    return output;
  }
}
