/** @jsxImportSource preact */
import {
  INDICATORS,
  maLines,
  PRICE_SOURCES,
  SERIES_COLORS,
  type IndicatorParams,
  type IndicatorType,
  type Locale,
  type PriceSource,
  type SeriesStyle,
} from '@funnest/charts';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { STRINGS, type Strings } from '../i18n';
import { CloseIcon, SmallCloseIcon } from '../icons';
import { useStore } from '../store';
import { SettingsDialog } from './settings-dialog';

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button.fnc-sr-row')?.focus();
  }, []);
  return (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        class={wide ? 'fnc-dialog fnc-dialog-wide' : 'fnc-dialog'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div class="fnc-dialog-head">
          <b>{title}</b>
          <button class="fnc-btn" aria-label="close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IndicatorPicker({ ctx }: { ctx: WidgetContext }) {
  const { locale } = useStore(ctx.store);
  const t = STRINGS[locale];
  const close = () => ctx.store.set({ dialog: null });
  const add = (type: IndicatorType) => {
    ctx.chart.addIndicator(type);
    close();
  };
  const groups: [string, IndicatorType[]][] = [
    [locale === 'ko' ? '가격 차트에 표시' : 'On price', ['ma', 'ema', 'bb']],
    [locale === 'ko' ? '아래 영역에 표시' : 'Separate pane', ['rsi', 'macd']],
  ];

  return (
    <Dialog title={t.addIndicator} onClose={close}>
      <div class="fnc-sr-list fnc-scroll">
        {groups.map(([label, types]) => (
          <>
            <div class="fnc-sr-section">{label}</div>
            {types.map((type) => {
              const def = INDICATORS[type];
              return (
                <button class="fnc-sr-row" onClick={() => add(type)}>
                  <span class="fnc-sr-main">
                    <span class="fnc-sr-name">{def.name[locale]}</span>
                    <span class="fnc-sr-meta">{def.description[locale]}</span>
                  </span>
                </button>
              );
            })}
          </>
        ))}
      </div>
    </Dialog>
  );
}

/** Rows for MA/EMA: one per line, each with its own visibility, color, width, source and period. */
interface LineRow {
  period: string;
  source: PriceSource;
  color: string;
  width: number;
  visible: boolean;
}

/** Style row for a fixed series (BB upper/basis/lower, RSI, MACD lines). */
interface StyleRow {
  key: string;
  label: string;
  color: string;
  width: number;
  visible: boolean;
}

const WIDTHS = [1, 2, 3, 4];

function defaultSeries(type: IndicatorType, params: IndicatorParams) {
  // Computing over zero bars is cheap and yields each series' key, label and default style.
  return INDICATORS[type].compute([], params).series.filter((s) => s.kind === 'line');
}

function StyleControls({
  t,
  row,
  onChange,
}: {
  t: Strings;
  row: { color: string; width: number; visible: boolean };
  onChange: (patch: Partial<{ color: string; width: number; visible: boolean }>) => void;
}) {
  return (
    <>
      <input
        type="checkbox"
        class="fnc-check"
        checked={row.visible}
        aria-label={row.visible ? t.hide : t.show}
        onChange={(e) => onChange({ visible: e.currentTarget.checked })}
      />
      <input
        type="color"
        class="fnc-color"
        value={row.color}
        aria-label={t.color}
        onInput={(e) => onChange({ color: e.currentTarget.value })}
      />
      <select class="fnc-select fnc-select-width" value={row.width} aria-label={t.lineWidth} onChange={(e) => onChange({ width: Number(e.currentTarget.value) })}>
        {WIDTHS.map((w) => (
          <option value={w}>{w}px</option>
        ))}
      </select>
    </>
  );
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

function IndicatorSettings({ ctx, id }: { ctx: WidgetContext; id: string }) {
  const { locale, indicators } = useStore(ctx.store);
  const t = STRINGS[locale];
  const config = indicators.find((c) => c.id === id);
  const def = config ? INDICATORS[config.type] : null;
  const hasLines = !!def?.params.some((p) => p.kind === 'lines');

  const [lines, setLines] = useState<LineRow[]>(() => {
    if (!config || !hasLines) return [];
    const defaults = defaultSeries(config.type, config.params);
    return maLines(config.params).map((l, i) => {
      const style = config.styles?.[`l${i}`];
      return {
        period: String(l.period),
        source: l.source,
        color: style?.color ?? defaults[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!,
        width: style?.width ?? defaults[i]?.width ?? 1,
        visible: style?.visible ?? true,
      };
    });
  });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(config?.params ?? {}).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => [k, String(v)])),
  );
  const [styles, setStyles] = useState<StyleRow[]>(() => {
    if (!config || hasLines) return [];
    return defaultSeries(config.type, config.params).map((s) => {
      const style = config.styles?.[s.key];
      return { key: s.key, label: s.label, color: style?.color ?? s.color, width: style?.width ?? s.width, visible: style?.visible ?? true };
    });
  });

  const close = () => ctx.store.set({ dialog: null });
  if (!config || !def) return null;

  const updateLine = (i: number, patch: Partial<LineRow>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => {
    const i = lines.length;
    const last = lines[i - 1];
    setLines([
      ...lines,
      {
        period: String(last ? Number(last.period) * 2 || 10 : 5),
        source: 'close',
        color: SERIES_COLORS[i % SERIES_COLORS.length]!,
        width: 1,
        visible: true,
      },
    ]);
  };

  const apply = (e: Event) => {
    e.preventDefault();
    const params: IndicatorParams = {};
    const nextStyles: Record<string, SeriesStyle> = {};
    for (const spec of def.params) {
      const clamp = (n: number) => Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, n));
      if (spec.kind === 'lines') {
        const valid = lines.filter((l) => Number(l.period) > 0);
        params[spec.key] = valid.map((l) => ({ period: clamp(Math.round(Number(l.period))), source: l.source }));
        valid.forEach((l, i) => (nextStyles[`l${i}`] = { color: l.color, width: l.width, visible: l.visible }));
      } else if (spec.kind === 'source') {
        params[spec.key] = values[spec.key] ?? 'close';
      } else {
        const n = Number(values[spec.key]);
        if (Number.isFinite(n)) params[spec.key] = clamp(n);
      }
    }
    for (const s of styles) nextStyles[s.key] = { color: s.color, width: s.width, visible: s.visible };
    ctx.chart.updateIndicator(id, { params, styles: nextStyles });
    close();
  };

  return (
    <Dialog title={`${def.name[locale]} · ${t.indicatorSettings}`} onClose={close} wide>
      <form class="fnc-form" onSubmit={apply}>
        {hasLines ? (
          <div class="fnc-rows">
            {lines.map((l, i) => (
              <div class="fnc-row">
                <span class="fnc-row-label">
                  {t.period}
                  {i + 1}
                </span>
                <StyleControls t={t} row={l} onChange={(p) => updateLine(i, p)} />
                <SourceSelect value={l.source} locale={locale} label={t.source} onChange={(source) => updateLine(i, { source })} />
                <input
                  class="fnc-input fnc-input-period"
                  inputMode="numeric"
                  value={l.period}
                  aria-label={`${t.period}${i + 1}`}
                  onInput={(e) => updateLine(i, { period: e.currentTarget.value.replace(/\D/g, '') })}
                />
                <button type="button" class="fnc-ind-btn" aria-label={t.removePeriod} data-tip={t.removePeriod} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <SmallCloseIcon />
                </button>
              </div>
            ))}
            <button type="button" class="fnc-add-row" onClick={addLine}>
              + {t.addPeriod}
            </button>
          </div>
        ) : (
          <>
            <div class="fnc-section">{t.inputs}</div>
            {def.params.map((spec) => (
              <div class="fnc-row">
                <span class="fnc-row-label fnc-row-label-wide">{spec.label[locale]}</span>
                {spec.kind === 'source' ? (
                  <SourceSelect
                    value={(values[spec.key] as PriceSource) ?? 'close'}
                    locale={locale}
                    label={spec.label[locale]}
                    onChange={(v) => setValues({ ...values, [spec.key]: v })}
                  />
                ) : (
                  <input
                    class="fnc-input"
                    inputMode="decimal"
                    value={values[spec.key] ?? ''}
                    aria-label={spec.label[locale]}
                    onInput={(e) => setValues({ ...values, [spec.key]: e.currentTarget.value })}
                  />
                )}
              </div>
            ))}
            {styles.length > 0 && <div class="fnc-section">{t.style}</div>}
            {styles.map((row, i) => (
              <div class="fnc-row">
                <span class="fnc-row-label fnc-row-label-wide">{row.label}</span>
                <StyleControls t={t} row={row} onChange={(p) => setStyles(styles.map((s, j) => (j === i ? { ...s, ...p } : s)))} />
              </div>
            ))}
          </>
        )}
        <div class="fnc-form-actions">
          <button
            type="button"
            class="fnc-action fnc-action-danger"
            onClick={() => {
              ctx.chart.removeIndicator(id);
              close();
            }}
          >
            {t.remove}
          </button>
          <button type="button" class="fnc-action" onClick={close}>
            {t.cancel}
          </button>
          <button type="submit" class="fnc-action fnc-action-primary">
            {t.apply}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function Dialogs({ ctx }: { ctx: WidgetContext }) {
  const { dialog } = useStore(ctx.store);
  if (dialog?.kind === 'indicators') return <IndicatorPicker ctx={ctx} />;
  if (dialog?.kind === 'indicatorSettings') return <IndicatorSettings ctx={ctx} id={dialog.id} />;
  if (dialog?.kind === 'chartSettings') return <SettingsDialog ctx={ctx} />;
  return null;
}
