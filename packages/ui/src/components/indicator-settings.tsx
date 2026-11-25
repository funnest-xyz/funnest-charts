/** @jsxImportSource preact */
import {
  maLines,
  PRICE_SOURCES,
  resolutionLabel,
  resolutionToMs,
  SERIES_COLORS,
  type IndicatorConfig,
  type IndicatorDefinition,
  type IndicatorDisplay,
  type IndicatorParams,
  type IntervalVisibility,
  type Locale,
  type PriceSource,
  type SeriesStyle,
} from '@funnest/charts';
import { useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf, type Strings } from '../i18n.js';
import { SmallCloseIcon } from '../icons.js';
import { useStore } from '../store.js';
import { cleanIntervals, IntervalVisibilityEditor } from './interval-visibility.js';

/**
 * 지표 설정, in TradingView's three tabs: 인풋 (its inputs, and 타임프레임 — computed on a longer
 * interval), 모습 (each line's look, levels, band, and what the price scale and legend show) and
 * 보임 (which intervals it shows on). 기본설정 resets it, or keeps it as what new ones start with.
 */

type SeriesKind = NonNullable<SeriesStyle['kind']>;
type LineStyle = NonNullable<SeriesStyle['lineStyle']>;

interface StyleRow {
  key: string;
  label: string;
  color: string;
  width: number;
  visible: boolean;
  lineStyle: LineStyle;
  kind: SeriesKind;
  /** The indicator's own way of drawing it (what "기본" means for the plot type). */
  ownKind: SeriesKind;
}

interface LineRow {
  period: string;
  source: PriceSource;
}

const WIDTHS = [1, 2, 3, 4];
const KINDS: SeriesKind[] = ['line', 'step', 'area', 'histogram', 'columns', 'circles', 'cross'];
const STYLES: LineStyle[] = ['solid', 'dashed', 'dotted'];
const PRECISIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** Longer intervals offered for 타임프레임 (those longer than the chart's). */
const TIMEFRAMES = ['3', '5', '15', '30', '60', '120', '240', '1D', '1W', '1M'];

/** A color the color input can show (#rrggbb); the indicator's own tokens ('up', CSS variables) as a stand-in. */
const hex6 = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#3182f6');
/** Opacity of a color in % (#rrggbbaa; anything else: 100). */
const alphaOf = (c: string) => (/^#[0-9a-f]{8}$/i.test(c) ? Math.round((parseInt(c.slice(7, 9), 16) / 255) * 100) : 100);
/** #rrggbb with an opacity (100: no alpha part). */
const withAlpha = (hex: string, pct: number) => {
  const base = hex6(hex);
  return pct >= 100 ? base : `${base}${Math.round((Math.max(0, pct) / 100) * 255).toString(16).padStart(2, '0')}`;
};

/** A color swatch and its opacity (TradingView's color + 불투명도). */
function ColorField({ value, label, onChange }: { value: string; label: string; onChange: (c: string) => void }) {
  const pct = alphaOf(value);
  return (
    <span class="fnc-color-field">
      <input type="color" class="fnc-color" value={hex6(value)} aria-label={label} onInput={(e) => onChange(withAlpha(e.currentTarget.value, pct))} />
      <input
        type="range"
        class="fnc-opacity"
        min={0}
        max={100}
        step={5}
        value={pct}
        aria-label={`${label} %`}
        title={`${pct}%`}
        onInput={(e) => onChange(withAlpha(value, Number(e.currentTarget.value)))}
      />
    </span>
  );
}

function seriesRows(def: IndicatorDefinition, params: IndicatorParams, styles: Record<string, SeriesStyle> | undefined, lines: LineRow[] | null): StyleRow[] {
  // Computing over zero bars is cheap and gives each series' key, label and default look.
  const own = def.compute([], params).series;
  if (lines) {
    return lines.map((l, i) => {
      const key = `l${i}`;
      const s = own[i];
      const st = styles?.[key];
      const color = st?.color ?? s?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!;
      return { key, label: `${l.period || '?'}`, color, width: st?.width ?? s?.width ?? 1, visible: st?.visible ?? true, lineStyle: st?.lineStyle ?? s?.lineStyle ?? 'solid', kind: st?.kind ?? 'line', ownKind: 'line' };
    });
  }
  return own.map((s) => {
    const st = styles?.[s.key];
    return {
      key: s.key,
      label: s.label,
      color: st?.color ?? s.color,
      width: st?.width ?? s.width,
      visible: st?.visible ?? s.visible,
      lineStyle: st?.lineStyle ?? s.lineStyle ?? 'solid',
      kind: st?.kind ?? s.kind,
      ownKind: s.kind,
    };
  });
}

function SourceSelect({ value, locale, label, onChange }: { value: PriceSource; locale: Locale; label: string; onChange: (s: PriceSource) => void }) {
  return (
    <select class="fnc-select fnc-select-source" value={value} aria-label={label} onChange={(e) => onChange(e.currentTarget.value as PriceSource)}>
      {PRICE_SOURCES.map((s) => (
        <option value={s.value}>{s.label[locale]}</option>
      ))}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="fnc-row fnc-check-row">
      <input type="checkbox" class="fnc-check" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function IndicatorSettings({ ctx, id, Dialog }: { ctx: WidgetContext; id: string; Dialog: (p: { title: string; onClose: () => void; wide?: boolean; children: preact.ComponentChildren }) => preact.JSX.Element }) {
  const { locale, indicators, resolution, customIntervals, symbol } = useStore(ctx.store);
  const t = stringsOf(ctx.store.get());
  const config = indicators.find((c) => c.id === id);
  const def = config ? (ctx.chart.indicatorDefinition(config.type) ?? null) : null;
  const hasLines = !!def?.params.some((p) => p.kind === 'lines');
  // On another indicator: its prices are that one's values (no 가격 기준), on that one's bars (no 타임프레임).
  const onIndicator = !!config?.on;

  const initLines = (c: IndicatorConfig | undefined, params = c?.params): LineRow[] => (params && hasLines ? maLines(params).map((l) => ({ period: String(l.period), source: l.source })) : []);
  const [tab, setTab] = useState<'inputs' | 'style' | 'visibility'>('inputs');
  const [lines, setLines] = useState<LineRow[]>(() => initLines(config));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(config?.params ?? {}).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => [k, String(v)])),
  );
  const [rows, setRows] = useState<StyleRow[]>(() => (config && def ? seriesRows(def, config.params, config.styles, hasLines ? initLines(config) : null) : []));
  const [display, setDisplay] = useState<IndicatorDisplay>(() => ({ ...(config?.display ?? {}) }));
  const [timeframe, setTimeframe] = useState(config?.timeframe ?? '');
  const [waitClose, setWaitClose] = useState(config?.waitClose !== false);
  const [menu, setMenu] = useState(false);

  const close = () => ctx.store.set({ dialog: null });
  if (!config || !def) return null;

  const probe = def.compute([], config.params);
  const hasLevels = !!probe.levels?.length;
  const hasFill = !!probe.fill || !!probe.fills?.length;
  const chartMs = (() => {
    try {
      return resolutionToMs(resolution);
    } catch {
      return 0;
    }
  })();
  const supported = symbol?.supportedResolutions;
  const timeframes = [...new Set([...TIMEFRAMES, ...customIntervals])]
    .filter((r) => {
      try {
        return resolutionToMs(r) > chartMs && (!supported?.length || supported.includes(r));
      } catch {
        return false;
      }
    })
    .sort((a, b) => resolutionToMs(a) - resolutionToMs(b));
  if (timeframe && !timeframes.includes(timeframe)) timeframes.push(timeframe);

  const patchRow = (i: number, p: Partial<StyleRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setLinesAndRows = (next: LineRow[]) => {
    setLines(next);
    // Rows follow the lines (a new line gets the next color).
    setRows(
      next.map((l, i) => {
        const r = rows[i];
        return r ? { ...r, label: l.period || '?' } : { key: `l${i}`, label: l.period || '?', color: SERIES_COLORS[i % SERIES_COLORS.length]!, width: 1, visible: true, lineStyle: 'solid', kind: 'line', ownKind: 'line' };
      }),
    );
  };

  /** The form as settings: params, styles, display, timeframe. */
  const collect = () => {
    const params: IndicatorParams = {};
    for (const spec of def.params) {
      const clamp = (n: number) => Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, n));
      if (spec.kind === 'lines') params[spec.key] = lines.filter((l) => Number(l.period) > 0).map((l) => ({ period: clamp(Math.round(Number(l.period))), source: l.source }));
      else if (spec.kind === 'source') params[spec.key] = values[spec.key] ?? 'close';
      else {
        const n = Number(values[spec.key]);
        if (Number.isFinite(n)) params[spec.key] = clamp(n);
      }
    }
    const kept = hasLines ? rows.filter((_, i) => Number(lines[i]?.period) > 0) : rows;
    const styles: Record<string, SeriesStyle> = {};
    kept.forEach((r, i) => {
      const key = hasLines ? `l${i}` : r.key;
      styles[key] = { color: r.color, width: r.width, visible: r.visible, ...(r.lineStyle !== 'solid' ? { lineStyle: r.lineStyle } : {}), ...(r.kind !== r.ownKind ? { kind: r.kind } : {}) };
    });
    const d: IndicatorDisplay = { ...display };
    const intervals = cleanIntervals(d.intervals);
    if (intervals) d.intervals = intervals;
    else delete d.intervals;
    for (const k of Object.keys(d) as (keyof IndicatorDisplay)[]) if (d[k] === undefined) delete d[k];
    return { params, styles, display: d, timeframe, waitClose };
  };

  const apply = (e: Event) => {
    e.preventDefault();
    const c = collect();
    ctx.chart.updateIndicator(id, { params: c.params, styles: c.styles, display: c.display, timeframe: c.timeframe, waitClose: c.waitClose });
    close();
  };

  /** 기본값으로 재설정: the indicator's own settings (in the form; 확인 applies them). */
  const reset = () => {
    const params = { ...def.defaults };
    const l = hasLines ? maLines(params).map((x) => ({ period: String(x.period), source: x.source })) : [];
    setLines(l);
    setValues(Object.fromEntries(Object.entries(params).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => [k, String(v)])));
    setRows(seriesRows(def, params, undefined, hasLines ? l : null));
    setDisplay({});
    setTimeframe('');
    setWaitClose(true);
    setMenu(false);
  };
  /** 기본값으로 저장: new ones of this type start like the form. */
  const saveDefaults = () => {
    const c = collect();
    ctx.chart.saveIndicatorDefaults(config.type, { params: c.params, styles: c.styles, display: c.display, ...(c.timeframe ? { timeframe: c.timeframe } : {}), ...(c.waitClose ? {} : { waitClose: false }) });
    setMenu(false);
  };
  const hasSaved = !!ctx.chart.indicatorDefaults(config.type);
  const forgetDefaults = () => {
    ctx.chart.saveIndicatorDefaults(config.type, null);
    setMenu(false);
  };

  /** Changes the display settings; undefined drops one (back to its default). */
  const setD = (p: { [K in keyof IndicatorDisplay]?: IndicatorDisplay[K] | undefined }) => {
    const next: Record<string, unknown> = { ...display, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    setDisplay(next as IndicatorDisplay);
  };
  const kindLabel = (k: SeriesKind) =>
    ({ line: t.kindLine, step: t.kindStep, area: t.kindArea, histogram: t.kindHistogram, columns: t.kindColumns, circles: t.kindCircles, cross: t.kindCross })[k];
  const styleLabel = (s: LineStyle) => ({ solid: t.lineSolid, dashed: t.lineDashed, dotted: t.lineDotted })[s];

  return (
    <Dialog title={def.name[locale]} onClose={close} wide>
      <div class="fnc-tabs fnc-settings-tabs" role="tablist">
        {(
          [
            ['inputs', t.tabInputs],
            ['style', t.tabStyle],
            ['visibility', t.tabVisibility],
          ] as const
        ).map(([k, label]) => (
          <button type="button" class="fnc-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <form class="fnc-form" onSubmit={apply}>
        {tab === 'inputs' && (
          <>
            {hasLines ? (
              <div class="fnc-rows">
                {lines.map((l, i) => (
                  <div class="fnc-row">
                    <span class="fnc-row-label">
                      {t.period}
                      {i + 1}
                    </span>
                    <input
                      class="fnc-input fnc-input-period"
                      inputMode="numeric"
                      value={l.period}
                      aria-label={`${t.period}${i + 1}`}
                      onInput={(e) => setLinesAndRows(lines.map((x, j) => (j === i ? { ...x, period: e.currentTarget.value.replace(/\D/g, '') } : x)))}
                    />
                    {!onIndicator && <SourceSelect value={l.source} locale={locale} label={t.source} onChange={(source) => setLines(lines.map((x, j) => (j === i ? { ...x, source } : x)))} />}
                    <button
                      type="button"
                      class="fnc-ind-btn"
                      aria-label={t.removePeriod}
                      data-tip={t.removePeriod}
                      onClick={() => {
                        setLines(lines.filter((_, j) => j !== i));
                        setRows(rows.filter((_, j) => j !== i));
                      }}
                    >
                      <SmallCloseIcon />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="fnc-add-row"
                  onClick={() => {
                    const last = lines[lines.length - 1];
                    setLinesAndRows([...lines, { period: String(last ? Number(last.period) * 2 || 10 : 5), source: 'close' }]);
                  }}
                >
                  + {t.addPeriod}
                </button>
              </div>
            ) : (
              def.params
                .filter((spec) => !(onIndicator && spec.kind === 'source'))
                .map((spec) => (
                  <div class="fnc-row">
                    <span class="fnc-row-label fnc-row-label-wide">{spec.label[locale]}</span>
                    {spec.kind === 'source' ? (
                      <SourceSelect value={(values[spec.key] as PriceSource) ?? 'close'} locale={locale} label={spec.label[locale]} onChange={(v) => setValues({ ...values, [spec.key]: v })} />
                    ) : (
                      <input class="fnc-input" inputMode="decimal" value={values[spec.key] ?? ''} aria-label={spec.label[locale]} onInput={(e) => setValues({ ...values, [spec.key]: e.currentTarget.value })} />
                    )}
                  </div>
                ))
            )}
            {(
              <>
                <div class="fnc-section">{t.calculation}</div>
                <div class="fnc-row">
                  <span class="fnc-row-label fnc-row-label-wide">{t.timeframe}</span>
                  <select class="fnc-select fnc-select-source" value={timeframe} aria-label={t.timeframe} onChange={(e) => setTimeframe(e.currentTarget.value)}>
                    <option value="">{t.timeframeChart}</option>
                    {timeframes.map((r) => (
                      <option value={r}>{resolutionLabel(r, locale, 'long')}</option>
                    ))}
                  </select>
                </div>
                <Check label={t.waitClose} checked={waitClose} onChange={setWaitClose} />
                {timeframe && <p class="fnc-hint">{t.timeframeHint}</p>}
              </>
            )}
          </>
        )}

        {tab === 'style' && (
          <>
            <div class="fnc-rows">
              {rows.map((r, i) => (
                <div class="fnc-row fnc-style-row">
                  <input type="checkbox" class="fnc-check" checked={r.visible} aria-label={r.visible ? t.hide : t.show} onChange={(e) => patchRow(i, { visible: e.currentTarget.checked })} />
                  <span class="fnc-row-label fnc-row-label-wide" title={r.label}>
                    {r.label}
                  </span>
                  <ColorField value={/^#[0-9a-f]{6}/i.test(r.color) ? r.color : hex6(r.color)} label={t.color} onChange={(color) => patchRow(i, { color })} />
                  <select class="fnc-select fnc-select-width" value={r.width} aria-label={t.lineWidth} onChange={(e) => patchRow(i, { width: Number(e.currentTarget.value) })}>
                    {WIDTHS.map((w) => (
                      <option value={w}>{w}px</option>
                    ))}
                  </select>
                  <select class="fnc-select fnc-select-style" value={r.lineStyle} aria-label={t.lineStyle} onChange={(e) => patchRow(i, { lineStyle: e.currentTarget.value as LineStyle })}>
                    {STYLES.map((s) => (
                      <option value={s}>{styleLabel(s)}</option>
                    ))}
                  </select>
                  <select class="fnc-select fnc-select-kind" value={r.kind} aria-label={t.plotType} onChange={(e) => patchRow(i, { kind: e.currentTarget.value as SeriesKind })}>
                    {KINDS.map((k) => (
                      <option value={k}>{kindLabel(k)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {(hasLevels || hasFill) && (
              <>
                {hasLevels && (
                  <div class="fnc-row">
                    <input type="checkbox" class="fnc-check" checked={display.levels !== false} aria-label={t.indLevels} onChange={(e) => setD({ levels: e.currentTarget.checked ? undefined : false })} />
                    <span class="fnc-row-label fnc-row-label-wide">{t.indLevels}</span>
                    <ColorField value={display.levelColor ?? '#8b95a1'} label={t.color} onChange={(levelColor) => setD({ levelColor })} />
                  </div>
                )}
                {hasLevels && display.levels !== false && (
                  <div class="fnc-row fnc-level-values">
                    <span class="fnc-row-label fnc-row-label-wide">{t.levelValuesLabel}</span>
                    {probe.levels!.map((l, i) => {
                      const own = typeof l === 'number' ? l : l.value;
                      const v = display.levelValues?.[i];
                      return (
                        <input
                          class="fnc-input fnc-input-num"
                          inputMode="decimal"
                          key={`${i}:${v ?? own}`}
                          defaultValue={String(v ?? own)}
                          aria-label={`${t.levelValuesLabel} ${i + 1}`}
                          onChange={(e) => {
                            const n = Number(e.currentTarget.value);
                            const next = probe.levels!.map((x, j) => display.levelValues?.[j] ?? (typeof x === 'number' ? x : x.value));
                            next[i] = Number.isFinite(n) ? n : own;
                            const same = next.every((x, j) => x === (typeof probe.levels![j] === 'number' ? probe.levels![j] : (probe.levels![j] as { value: number }).value));
                            setD({ levelValues: same ? undefined : next });
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                {hasFill && (
                  <div class="fnc-row">
                    <input type="checkbox" class="fnc-check" checked={display.fill !== false} aria-label={t.fillBand} onChange={(e) => setD({ fill: e.currentTarget.checked ? undefined : false })} />
                    <span class="fnc-row-label fnc-row-label-wide">{t.fillBand}</span>
                    <ColorField value={display.fillColor ?? (/^#[0-9a-f]{6}$/i.test(probe.fill?.color ?? '') ? `${probe.fill!.color}26` : '#3182f626')} label={t.color} onChange={(fillColor) => setD({ fillColor })} />
                  </div>
                )}
              </>
            )}
            <div class="fnc-section">{t.outputValues}</div>
            <div class="fnc-row">
              <span class="fnc-row-label fnc-row-label-wide">{t.precision}</span>
              <select
                class="fnc-select fnc-select-source"
                value={display.precision === undefined ? '' : String(display.precision)}
                aria-label={t.precision}
                onChange={(e) => setD({ precision: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value) })}
              >
                <option value="">{t.precisionDefault}</option>
                {PRECISIONS.map((n) => (
                  <option value={String(n)}>{n === 0 ? '1' : `0.${'0'.repeat(n - 1)}1`}</option>
                ))}
              </select>
            </div>
            <Check label={t.axisLabels} checked={display.axisLabels !== false} onChange={(v) => setD({ axisLabels: v ? undefined : false })} />
            <Check label={t.statusValues} checked={display.statusValues !== false} onChange={(v) => setD({ statusValues: v ? undefined : false })} />
            <div class="fnc-section">{t.inputValues}</div>
            <Check label={t.statusInputs} checked={display.statusInputs !== false} onChange={(v) => setD({ statusInputs: v ? undefined : false })} />
          </>
        )}

        {tab === 'visibility' && (
          <>
            <p class="fnc-hint">{t.visibilityHint}</p>
            <IntervalVisibilityEditor t={t} value={display.intervals as IntervalVisibility | undefined} onChange={(intervals) => setD({ intervals })} />
          </>
        )}

        <div class="fnc-form-actions fnc-form-actions-split">
          <div class="fnc-defaults">
            <button type="button" class="fnc-action fnc-action-menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              {t.defaults} ▾
            </button>
            {menu && (
              <div class="fnc-defaults-menu" role="menu">
                <button type="button" role="menuitem" onClick={reset}>
                  {t.resetIndicator}
                </button>
                <button type="button" role="menuitem" onClick={saveDefaults}>
                  {t.saveDefaults}
                </button>
                {hasSaved && (
                  <button type="button" role="menuitem" onClick={forgetDefaults}>
                    {t.forgetDefaults}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  class="fnc-danger"
                  onClick={() => {
                    ctx.chart.removeIndicator(id);
                    close();
                  }}
                >
                  {t.remove}
                </button>
              </div>
            )}
          </div>
          <button type="button" class="fnc-action" onClick={close}>
            {t.cancel}
          </button>
          <button type="submit" class="fnc-action fnc-action-primary">
            {t.ok}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export type { Strings };
