/** @jsxImportSource preact */
import {
  CHART_THEMES,
  DEFAULT_CHART_SETTINGS,
  matchChartTheme,
  resolutionToMs,
  type Bar,
  type Chart,
  type ChartSettings,
  type Datafeed,
  type PriceScaleMode,
  type Resolution,
  type SymbolInfo,
} from '@funnest/charts';
import { createPortal } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf, type Strings } from '../i18n.js';
import { CloseIcon } from '../icons.js';
import { useStore } from '../store.js';
import { createTradingChart } from '../trading-chart.js';

/** Any CSS color (incl. var(--x) already resolved by the browser) → #rrggbb for <input type=color>. */
function toHex(color: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  return ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#000000';
}

type Toggle = { [K in keyof ChartSettings]: ChartSettings[K] extends boolean ? K : never }[keyof ChartSettings];
type ToggleRow = { key: Toggle; label: keyof Strings; hint?: keyof Strings };
type Tab = 'look' | 'scale' | 'view' | 'motion' | 'symbol';

const GRID: ToggleRow[] = [
  { key: 'gridHorizontal', label: 'settingGridH' },
  { key: 'gridVertical', label: 'settingGridV' },
];
const SCALE_ROWS: ToggleRow[] = [
  { key: 'lastPriceLine', label: 'settingLastPrice' },
  { key: 'countdown', label: 'settingCountdown' },
  { key: 'extendedPriceLine', label: 'settingExtendedPrice' },
  { key: 'highLowMarkers', label: 'settingHighLow' },
  { key: 'lockRatio', label: 'lockRatio' },
];
const VIEW_ROWS: ToggleRow[] = [
  { key: 'volume', label: 'settingVolume' },
  { key: 'navigationButtons', label: 'settingNavButtons' },
  { key: 'lockView', label: 'lockView' },
];
const WATERMARK_ROWS: ToggleRow[] = [
  { key: 'symbolWatermark', label: 'settingSymbolWatermark', hint: 'hintSymbolWatermark' },
  { key: 'replayWatermark', label: 'settingReplayWatermark', hint: 'hintReplayWatermark' },
];
const MOTION_ROWS: ToggleRow[] = [
  { key: 'zoomAnimation', label: 'settingZoomAnimation', hint: 'hintZoomAnimation' },
  { key: 'scrollInertia', label: 'settingScrollInertia', hint: 'hintScrollInertia' },
  { key: 'priceAxisAnimation', label: 'settingAxisAnimation', hint: 'hintAxisAnimation' },
  { key: 'priceAnimation', label: 'settingPriceAnimation', hint: 'hintPriceAnimation' },
  { key: 'drawOnLoad', label: 'settingDrawOnLoad', hint: 'hintDrawOnLoad' },
];

const SCALES: { mode: PriceScaleMode; label: keyof Strings }[] = [
  { mode: 'normal', label: 'scaleNormal' },
  { mode: 'percent', label: 'scalePercentLong' },
  { mode: 'indexed', label: 'scaleIndexed' },
  { mode: 'log', label: 'scaleLog' },
];

/**
 * Chart settings ("차트 설정"), in tabs, with a live demo chart beside them (above them on a
 * phone) drawn with the settings as they are now. Changes apply to the chart immediately, like
 * TradingView; "기본값으로" restores DEFAULT_CHART_SETTINGS.
 */
export function SettingsDialog({ ctx }: { ctx: WidgetContext }) {
  const { locale } = useStore(ctx.store);
  const t = stringsOf(ctx.store.get());
  const [settings, setSettings] = useState(ctx.chart.settings);
  const [tab, setTab] = useState<Tab>('look');
  // The app's switches (asked again after each change, so they show what they did).
  const [, bump] = useState(0);
  const appToggles = ctx.settingsToggles?.(ctx.chart) ?? [];
  useEffect(() => ctx.chart.on('settingsChange', setSettings), [ctx.chart]);

  const close = () => ctx.store.set({ dialog: null });
  const set = (patch: Partial<ChartSettings>) => ctx.chart.setSettings(patch);
  // Show the effective theme colors when no override is set.
  const themeColor = (name: '--fnc-up' | '--fnc-down' | '--fnc-bg' | '--fnc-border') => toHex(getComputedStyle(ctx.root).getPropertyValue(name).trim());
  const currentTheme = matchChartTheme(settings);

  const tabs: [Tab, string][] = [
    ['look', t.settingsTabLook],
    ['scale', t.settingsScale],
    ['view', t.settingsDisplay],
    ['motion', t.settingsTabMotion],
    ...(appToggles.length > 0 ? [['symbol', t.settingsSymbol] as [Tab, string]] : []),
  ];
  const shown: Tab = tabs.some(([k]) => k === tab) ? tab : 'look';

  const toggles = (rows: ToggleRow[]) =>
    rows.map(({ key, label, hint }) => (
      <label class="fnc-row fnc-toggle-row">
        <span class="fnc-toggle-label">{t[label]}</span>
        {hint && <Info text={t[hint]} />}
        <input type="checkbox" role="switch" class="fnc-switch" checked={settings[key]} onChange={(e) => set({ [key]: e.currentTarget.checked })} />
      </label>
    ));

  const anchor = useRef<HTMLSpanElement>(null);
  const layer = usePageLayer(anchor, settings);

  const dialog = (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="fnc-dialog fnc-settings-dialog" role="dialog" aria-modal="true" aria-label={t.chartSettings} onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div class="fnc-dialog-head">
          <b>{t.chartSettings}</b>
          <button class="fnc-btn" aria-label={t.close} onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <div class="fnc-settings-body">
          <div class="fnc-settings-side">
            <div class="fnc-tabs fnc-settings-tabs" role="tablist" aria-label={t.chartSettings}>
              {tabs.map(([k, label]) => (
                <button type="button" class="fnc-tab" role="tab" aria-selected={shown === k} onClick={() => setTab(k)}>
                  {label}
                </button>
              ))}
            </div>
            <form class="fnc-form fnc-settings-form" onSubmit={(e) => (e.preventDefault(), close())}>
              {shown === 'look' && (
                <>
                  <div class="fnc-section">{t.settingsTheme}</div>
                  <div class="fnc-themes" role="radiogroup" aria-label={t.settingsTheme}>
                    {CHART_THEMES.map((theme) => {
                      const c = theme.colors;
                      const bg = c.background ?? themeColor('--fnc-bg');
                      const grid = c.gridColor ?? themeColor('--fnc-border');
                      const up = c.upColor ?? themeColor('--fnc-up');
                      const down = c.downColor ?? themeColor('--fnc-down');
                      return (
                        <button type="button" role="radio" class="fnc-theme" aria-checked={currentTheme?.id === theme.id} onClick={() => set({ ...c })}>
                          {/* Two candles on the theme's canvas. */}
                          <svg class="fnc-theme-swatch" viewBox="0 0 56 36" aria-hidden="true">
                            <rect x="0.5" y="0.5" width="55" height="35" rx="5" fill={bg} stroke={grid} />
                            <path d="M4 12h48M4 24h48" stroke={grid} />
                            <path d="M21 6v24" stroke={up} stroke-width="1.5" />
                            <rect x="17" y="11" width="8" height="13" rx="1" fill={up} />
                            <path d="M35 8v22" stroke={down} stroke-width="1.5" />
                            <rect x="31" y="13" width="8" height="11" rx="1" fill={down} />
                          </svg>
                          <span>{theme.name[locale === 'en' ? 'en' : 'ko']}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div class="fnc-section">{t.settingsCandles}</div>
                  {(['upColor', 'downColor'] as const).map((key) => (
                    <label class="fnc-row">
                      <span class="fnc-row-label fnc-row-label-wide">{key === 'upColor' ? t.settingUpColor : t.settingDownColor}</span>
                      <input type="color" class="fnc-color" value={settings[key] ?? themeColor(key === 'upColor' ? '--fnc-up' : '--fnc-down')} onInput={(e) => set({ [key]: e.currentTarget.value })} />
                      {settings[key] && (
                        <button type="button" class="fnc-link" onClick={() => set({ [key]: null })}>
                          {t.followTheme}
                        </button>
                      )}
                    </label>
                  ))}
                  <div class="fnc-section">{t.settingsGrid}</div>
                  {toggles(GRID)}
                </>
              )}
              {shown === 'scale' && (
                <>
                  <div class="fnc-section">{t.settingsScale}</div>
                  <div class="fnc-seg fnc-settings-seg" role="radiogroup" aria-label={t.settingsScale}>
                    {SCALES.map(({ mode, label }) => (
                      <button type="button" role="radio" aria-checked={settings.priceScale === mode} onClick={() => set({ priceScale: mode })}>
                        {t[label]}
                      </button>
                    ))}
                  </div>
                  <div class="fnc-section">{t.settingsDisplay}</div>
                  {toggles(SCALE_ROWS)}
                </>
              )}
              {shown === 'view' && (
                <>
                  <div class="fnc-section">{t.settingsDisplay}</div>
                  {toggles(VIEW_ROWS)}
                  <div class="fnc-section">{t.settingsWatermark}</div>
                  {toggles(WATERMARK_ROWS)}
                </>
              )}
              {shown === 'motion' && (
                <>
                  <div class="fnc-section">{t.settingsTabMotion}</div>
                  {toggles(MOTION_ROWS)}
                </>
              )}
              {shown === 'symbol' &&
                appToggles.map((item) => (
                  <label class="fnc-row fnc-toggle-row">
                    <span class="fnc-toggle-label">
                      {item.label}
                      {item.hint && <small class="fnc-toggle-hint">{item.hint}</small>}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      class="fnc-switch"
                      checked={item.checked}
                      onChange={(e) => {
                        item.onChange(e.currentTarget.checked);
                        bump((n) => n + 1);
                      }}
                    />
                  </label>
                ))}
            </form>
          </div>
          <Preview ctx={ctx} settings={settings} t={t} />
        </div>
        <div class="fnc-form-actions fnc-settings-actions">
          <button type="button" class="fnc-action fnc-action-danger" onClick={() => ctx.chart.setSettings(DEFAULT_CHART_SETTINGS)}>
            {t.resetDefaults}
          </button>
          <button type="button" class="fnc-action fnc-action-primary" onClick={close}>
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
  // Over the whole page (the middle of the screen, not of this chart), in a layer of its own;
  // the marker stays where the dialog was asked for, to read the chart's colors from.
  return (
    <>
      <span ref={anchor} hidden />
      {layer && createPortal(dialog, layer)}
    </>
  );
}

/** The CSS variables the widget's look is made of (copied onto the page layer). */
const LOOK_VARS = ['--fnc-accent', '--fnc-bg', '--fnc-border', '--fnc-danger', '--fnc-down', '--fnc-font', '--fnc-radius', '--fnc-shadow', '--fnc-surface', '--fnc-text', '--fnc-text-2', '--fnc-text-3', '--fnc-tip-bg', '--fnc-tip-text', '--fnc-up'];

/**
 * A layer over the whole page (or over the fullscreen element, when the chart is fullscreen) that
 * looks like the chart it came from: its color scheme, direction and CSS variables (a chart theme's
 * colors too), copied again whenever the settings change.
 */
function usePageLayer(anchor: { current: HTMLElement | null }, settings: ChartSettings): HTMLElement | null {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const at = anchor.current;
    if (!at) return;
    const doc = at.ownerDocument;
    const el = doc.createElement('div');
    el.className = 'fnc-root fnc-layer';
    (doc.fullscreenElement ?? doc.body).appendChild(el);
    setLayer(el);
    return () => el.remove();
  }, []);
  useLayoutEffect(() => {
    const at = anchor.current;
    if (!at || !layer) return;
    const copy = () => {
      const widget = at.closest<HTMLElement>('.fnc-root');
      const from = at.closest<HTMLElement>('.fnc-stage') ?? widget ?? at;
      if (widget?.dataset.colorScheme) layer.dataset.colorScheme = widget.dataset.colorScheme;
      const dir = widget?.closest('[dir]')?.getAttribute('dir');
      if (dir) layer.setAttribute('dir', dir);
      const cs = getComputedStyle(from);
      for (const name of LOOK_VARS) {
        const value = cs.getPropertyValue(name).trim();
        if (value) layer.style.setProperty(name, value);
        else layer.style.removeProperty(name);
      }
    };
    copy();
    // The chart repaints its colors after this setting change: copy those too.
    const frame = requestAnimationFrame(copy);
    return () => cancelAnimationFrame(frame);
  }, [layer, settings]);
  return layer;
}

/** ⓘ beside a setting: what it does, on hover or focus (a press doesn't flip the switch). */
function Info({ text }: { text: string }) {
  return (
    <span class="fnc-info" tabIndex={0} role="img" aria-label={text} onClick={(e) => e.preventDefault()}>
      i<span class="fnc-info-tip" aria-hidden="true">{text}</span>
    </span>
  );
}

/**
 * The demo chart: the real chart widget (legend, volume, buttons, axes) as the chart behind the
 * dialog has it, without indicators, on a made-up market (펀네스트, the Funnest mark, made-up prices) at its
 * interval — a new price every
 * few hundred ms (a new bar every few) so the animations show. Only the toolbar and the drawing bar
 * are left out. It takes every setting as it changes; turning 로드 시 그리기 효과 on loads it again.
 * Nothing of it is stored (storageKey: null), so the real chart's saved layout stays as it is.
 */
function Preview({ ctx, settings, t }: { ctx: WidgetContext; settings: ChartSettings; t: Strings }) {
  const host = useRef<HTMLDivElement>(null);
  const demo = useRef<Chart | null>(null);
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const real = ctx.chart;
    const locale = ctx.store.get().locale;
    const resolution: Resolution = real.currentResolution ?? '1D';
    const interval = Math.min(resolutionToMs(resolution), 7 * 86_400_000);
    // A made-up market of its own (not the real symbol, not its prices): 펀네스트, with the Funnest mark.
    const symbol: SymbolInfo = {
      symbol: PREVIEW_SYMBOL,
      name: locale === 'en' ? 'Funnest' : '펀네스트',
      exchange: locale === 'en' ? 'Demo' : '데모',
      timezone: real.symbolInfo?.timezone ?? 'Asia/Seoul',
      session: '24x7',
      pricePrecision: 0,
      tickSize: 1,
      logoUrl: FUNNEST_LOGO,
      supportedResolutions: [resolution],
    };
    // Enough history for long indicators (MA 120…) to draw across the screen.
    const volume = 1_200_000;
    const bars = demoBars(PREVIEW_PRICE, interval, 400, volume);
    let timer: ReturnType<typeof setInterval> | null = null;
    const feed: Datafeed = {
      resolveSymbol: async () => symbol,
      getBars: async () => ({ bars: bars.slice(), noMoreData: true }),
      subscribeBars: (_s, _r, onBar) => {
        let ticks = 0;
        timer = setInterval(() => {
          const last = bars[bars.length - 1]!;
          const close = Math.round(last.close + last.close * 0.0025 * (Math.random() - 0.48));
          if (++ticks % 8 === 0) {
            bars.push({ time: last.time + interval, open: last.close, high: Math.max(last.close, close), low: Math.min(last.close, close), close, volume: volume * 0.05 * Math.random() });
          } else {
            bars[bars.length - 1] = { ...last, close, high: Math.max(last.high, close), low: Math.min(last.low, close), volume: (last.volume ?? 0) + volume * 0.04 * Math.random() };
          }
          onBar(bars[bars.length - 1]!);
        }, 450);
        return () => {
          if (timer) clearInterval(timer);
          timer = null;
        };
      },
    };
    const scheme = (ctx.root.closest('[data-color-scheme]') as HTMLElement | null)?.dataset.colorScheme === 'dark' ? 'dark' : 'light';
    const widget = createTradingChart(el, {
      datafeed: feed,
      symbol: PREVIEW_SYMBOL,
      resolution,
      storageKey: null,
      searchHotkey: false,
      drawingToolbar: false,
      attribution: false,
      chartType: real.type,
      colorScheme: scheme,
      theme: real.themeTokens,
      locale,
      settings: real.settings,
      pauseWhenHidden: false,
    });
    demo.current = widget.chart;
    // The real chart's layout: chart type, settings and zoom. Not its indicators (their lines,
    // legends and axis labels would cover the few candles a preview has room for), drawings or
    // comparisons (they belong to real prices).
    const state = { ...real.save(), symbol: PREVIEW_SYMBOL, resolution, indicators: [], drawings: {}, compares: [], paneWeights: {} };
    const load = () => void widget.load(state).catch(() => {});
    reload.current = load;
    load();
    return () => {
      demo.current = null;
      widget.destroy();
    };
  }, [ctx.chart]);

  // Every change on the real chart, on the demo too; 로드 시 그리기 효과 turned on shows itself.
  const drawOnLoad = useRef(settings.drawOnLoad);
  useEffect(() => {
    demo.current?.setSettings(settings);
    if (settings.drawOnLoad && !drawOnLoad.current) reload.current();
    drawOnLoad.current = settings.drawOnLoad;
  }, [settings]);

  return (
    <div class="fnc-settings-preview">
      <div class="fnc-section">{t.settingsPreview}</div>
      <div class="fnc-settings-preview-chart" ref={host} />
      <small class="fnc-toggle-hint">{t.settingsPreviewHint}</small>
    </div>
  );
}

const PREVIEW_SYMBOL = '__fnc_preview';
/** Where the made-up prices end. */
const PREVIEW_PRICE = 12_500;
/** The Funnest mark (as in @internal/brand's LogoMark). */
const FUNNEST_LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B6CFF"/><stop offset="1" stop-color="#5A3BF0"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><path d="M7 13.5C9.5 21.5 17 23.5 23.4 11.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="24.6" cy="8.6" r="2.9" fill="#FFD43B"/></svg>',
)}`;

/** A made-up random walk of `count` bars ending now at about `price`, volumes around `volume`. */
function demoBars(price: number, interval: number, count: number, volume: number): Bar[] {
  const bars: Bar[] = [];
  const end = Math.floor(Date.now() / interval) * interval;
  let close = price * (1 + (Math.random() - 0.5) * 0.04);
  for (let i = count - 1; i >= 0; i--) {
    const open = close;
    close = open * (1 + (Math.random() - 0.49) * 0.012);
    const high = Math.max(open, close) * (1 + Math.random() * 0.004);
    const low = Math.min(open, close) * (1 - Math.random() * 0.004);
    bars.push({ time: end - i * interval, open, high, low, close, volume: volume * (0.3 + Math.random() * 1.4) });
  }
  // End at `price`, in whole won (the preview's tick).
  const shift = price - close;
  const won = (v: number) => Math.round(v + shift);
  return bars.map((b) => ({ ...b, open: won(b.open), high: won(b.high), low: won(b.low), close: won(b.close) }));
}
