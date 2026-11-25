/** @jsxImportSource preact */
import {
  maLines,
  PRICE_SOURCES,
  SERIES_COLORS,
  type IndicatorDefinition,
  type IndicatorParams,
  type IndicatorType,
  type Locale,
  type PriceSource,
  type SeriesStyle,
} from '@funnest/charts';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf, type Strings } from '../i18n.js';
import { CloseIcon, SmallCloseIcon } from '../icons.js';
import { useStore } from '../store.js';
import { GoToDateDialog } from './go-to-date.js';
import { IndicatorSettings } from './indicator-settings.js';
import { SettingsDialog } from './settings-dialog.js';

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

/** A search box appears once there are more than this many indicators (custom ones added). */
const SEARCH_THRESHOLD = 8;

/**
 * What goes on another indicator first (지표 위에 지표): one line, not the price chart's set —
 * an MA 14 over RSI like TradingView's, an EMA 9; bands as they come.
 */
function paramsOnIndicator(def: IndicatorDefinition): IndicatorParams | undefined {
  if (!Array.isArray(def.defaults.lines)) return undefined;
  return { lines: [{ period: def.type === 'ema' ? 9 : 14, source: 'close' }] };
}

/** 지표 위에 지표: the types that can go on indicator `on`. */
function IndicatorOnPicker({ ctx, on }: { ctx: WidgetContext; on: string }) {
  const { locale } = useStore(ctx.store);
  const t = stringsOf(ctx.store.get());
  const close = () => ctx.store.set({ dialog: null });
  const host = ctx.chart.indicatorLegend().find((i) => i.id === on);
  if (!host) return null;
  const defs = ctx.chart.indicatorsOnIndicator();
  return (
    <Dialog title={t.addIndicatorOn} onClose={close}>
      <div class="fnc-sr-list fnc-scroll">
        <div class="fnc-sr-section">{t.onIndicatorSection.replace('{name}', host.title)}</div>
        {defs.map((def) => (
          <button
            class="fnc-sr-row"
            onClick={() => {
              ctx.chart.addIndicatorOn(on, def.type, paramsOnIndicator(def));
              close();
            }}
          >
            <span class="fnc-sr-main">
              <span class="fnc-sr-name">{def.name[locale]}</span>
              <span class="fnc-sr-meta">{def.description[locale]}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function IndicatorPicker({ ctx }: { ctx: WidgetContext }) {
  const { locale } = useStore(ctx.store);
  const t = stringsOf(ctx.store.get());
  const [query, setQuery] = useState('');
  const close = () => ctx.store.set({ dialog: null });
  const add = (type: IndicatorType) => {
    ctx.chart.addIndicator(type);
    close();
  };
  const all = ctx.chart.indicatorDefinitions().filter((d) => !d.hidden);
  const q = query.trim().toLowerCase();
  const matches = (d: IndicatorDefinition) =>
    !q || [d.type, d.name.ko, d.name.en, d.description[locale]].some((s) => s.toLowerCase().includes(q));
  // Volume is a chart setting, not an indicator: once hidden (× on its pane), it comes back from
  // here, first under 아래 영역에 표시.
  const volumeHidden = !ctx.chart.settings.volume && (!q || [t.settingVolume, t.volume, 'volume'].some((s) => s.toLowerCase().includes(q)));
  const showVolume = () => {
    ctx.chart.setVolumeVisible(true);
    close();
  };
  const groups: { label: string; defs: IndicatorDefinition[]; volume: boolean }[] = [
    { label: locale === 'ko' ? '가격 차트에 표시' : 'On price', defs: all.filter((d) => d.overlay && matches(d)), volume: false },
    { label: locale === 'ko' ? '아래 영역에 표시' : 'Separate pane', defs: all.filter((d) => !d.overlay && matches(d)), volume: volumeHidden },
  ].filter((g) => g.defs.length > 0 || g.volume);
  const first = groups.find((g) => g.defs.length)?.defs[0];

  return (
    <Dialog title={t.addIndicator} onClose={close}>
      {all.length > SEARCH_THRESHOLD && (
        <div class="fnc-search fnc-ind-search">
          <input
            value={query}
            placeholder={t.searchIndicators}
            aria-label={t.searchIndicators}
            autocomplete="off"
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && first && add(first.type)}
          />
        </div>
      )}
      <div class="fnc-sr-list fnc-scroll">
        {groups.length === 0 && <div class="fnc-empty">{t.noResults}</div>}
        {groups.map(({ label, defs, volume }) => (
          <>
            <div class="fnc-sr-section">{label}</div>
            {volume && (
              <button class="fnc-sr-row" onClick={showVolume}>
                <span class="fnc-sr-main">
                  <span class="fnc-sr-name">{t.settingVolume}</span>
                  <span class="fnc-sr-meta">{t.volumeDesc}</span>
                </span>
              </button>
            )}
            {defs.map((def) => {
              const type = def.type;
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

export function Dialogs({ ctx }: { ctx: WidgetContext }) {
  const { dialog } = useStore(ctx.store);
  if (dialog?.kind === 'indicators') return dialog.on ? <IndicatorOnPicker ctx={ctx} on={dialog.on} /> : <IndicatorPicker ctx={ctx} />;
  if (dialog?.kind === 'indicatorSettings') return <IndicatorSettings ctx={ctx} id={dialog.id} Dialog={Dialog} key={dialog.id} />;
  if (dialog?.kind === 'chartSettings') return <SettingsDialog ctx={ctx} />;
  if (dialog?.kind === 'goToDate') return <GoToDateDialog ctx={ctx} />;
  return null;
}
