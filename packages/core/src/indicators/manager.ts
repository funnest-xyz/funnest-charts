import { newId } from '../objects/types';
import type { Bar } from '../types';
import { INDICATORS, maLines, type IndicatorDefinition, type IndicatorOutput, type IndicatorParams, type IndicatorType, type SeriesStyle } from './definitions';

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
    return { id: c.id || newId(c.type), type: c.type, params, visible: c.visible ?? true, styles: c.styles ?? {} };
  }

  add(type: IndicatorType, params?: IndicatorParams): string {
    const config = this.normalize({ id: newId(type), type, params: params ?? {} });
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

  /** Unknown types (e.g. a plugin this chart wasn't given) are dropped. */
  set(configs: readonly IndicatorConfig[]): void {
    this.list = configs.filter((c) => this.registry.has(c.type)).map((c) => this.normalize(clone(c)));
    this.cache.clear();
  }

  snapshot(): IndicatorConfig[] {
    return this.list.map(clone);
  }

  get overlays(): IndicatorConfig[] {
    return this.list.filter((c) => this.def(c.type).overlay);
  }

  get panes(): IndicatorConfig[] {
    return this.list.filter((c) => !this.def(c.type).overlay);
  }

  /** Computed series with user styles applied; recomputed only when data or settings change. */
  output(cfg: IndicatorConfig, bars: readonly Bar[], dataVersion: number): IndicatorOutput {
    const key = `${dataVersion}|${JSON.stringify(cfg.params)}|${JSON.stringify(cfg.styles)}`;
    const hit = this.cache.get(cfg.id);
    if (hit?.key === key) return hit.output;
    const raw = this.def(cfg.type).compute(bars, cfg.params);
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
