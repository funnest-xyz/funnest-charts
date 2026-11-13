/** @jsxImportSource preact */
import { formatCompact, formatPrice, type Bar, type IndicatorLegendItem, type LegendItem } from '@funnest/charts';
import type { JSX } from 'preact';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { MultiControls, WidgetContext } from '../context';
import { resolutionLabel, stringsOf } from '../i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  FunnestMark,
  GearIcon,
  MaximizeIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ReplayIcon,
  ResetIcon,
  RestoreIcon,
  SmallCloseIcon,
  StepIcon,
  ToRealtimeIcon,
} from '../icons';
import { useStore } from '../store';
import { ContextMenu } from './context-menu';
import { SelectionBar } from './drawing-toolbar';
import { SymbolAvatar } from './symbol-avatar';

const ZOOM_STEP = 1.25;
const CONTROL_OFFSET = 52; // px above the time axis

const dirClass = (v: number) => (v > 0 ? 'fnc-up' : v < 0 ? 'fnc-down' : 'fnc-flat');

function IndicatorItem({ ctx, item }: { ctx: WidgetContext; item: IndicatorLegendItem }) {
  const t = stringsOf(ctx.store.get());
  return (
    <div
      class={item.visible ? 'fnc-ind' : 'fnc-ind fnc-ind-hidden'}
      role="button"
      tabIndex={0}
      aria-label={`${item.title} ${t.indicatorSettings}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.fnc-ind-actions')) return;
        ctx.store.set({ dialog: { kind: 'indicatorSettings', id: item.id } });
      }}
      onKeyDown={(e) => e.key === 'Enter' && ctx.store.set({ dialog: { kind: 'indicatorSettings', id: item.id } })}
    >
      <button
        class="fnc-ind-btn fnc-ind-eye"
        data-tip={item.visible ? t.hide : t.show}
        aria-label={`${item.title} ${item.visible ? t.hide : t.show}`}
        aria-pressed={!item.visible}
        onClick={(e) => {
          e.stopPropagation();
          ctx.chart.setIndicatorVisible(item.id, !item.visible);
        }}
      >
        {item.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      <span class="fnc-ind-title">{item.title}</span>
      {item.visible && item.values.map((v) => (
        <b style={{ color: v.color }} data-tip={v.label}>
          {v.value}
        </b>
      ))}
      <span class="fnc-ind-actions">
        <button
          class="fnc-ind-btn"
          data-tip={t.indicatorSettings}
          aria-label={`${item.title} ${t.indicatorSettings}`}
          onClick={() => ctx.store.set({ dialog: { kind: 'indicatorSettings', id: item.id } })}
        >
          <GearIcon />
        </button>
        <button
          class="fnc-ind-btn"
          data-tip={t.removeIndicator}
          aria-label={`${item.title} ${t.removeIndicator}`}
          onClick={() => ctx.chart.removeIndicator(item.id)}
        >
          <SmallCloseIcon />
        </button>
      </span>
    </div>
  );
}

/** An app's row (chart.addLegendItem): 👁 if it can hide, its name, ⚙ and × if it offers them. */
function AppItem({ ctx, item }: { ctx: WidgetContext; item: LegendItem }) {
  const t = stringsOf(ctx.store.get());
  return (
    <div class={item.visible ? 'fnc-ind' : 'fnc-ind fnc-ind-hidden'}>
      {item.onToggle && (
        <button
          class="fnc-ind-btn fnc-ind-eye"
          data-tip={item.visible ? t.hide : t.show}
          aria-label={`${item.name} ${item.visible ? t.hide : t.show}`}
          aria-pressed={!item.visible}
          onClick={() => ctx.chart.setLegendItemVisible(item.id, !item.visible)}
        >
          {item.visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      )}
      <span class="fnc-ind-title">{item.name}</span>
      <span class="fnc-ind-actions">
        {item.onSettings && (
          <button class="fnc-ind-btn" data-tip={t.indicatorSettings} aria-label={`${item.name} ${t.indicatorSettings}`} onClick={() => item.onSettings?.()}>
            <GearIcon />
          </button>
        )}
        {item.onRemove && (
          <button class="fnc-ind-btn" data-tip={t.removeIndicator} aria-label={`${item.name} ${t.removeIndicator}`} onClick={() => item.onRemove?.()}>
            <SmallCloseIcon />
          </button>
        )}
      </span>
    </div>
  );
}

/** The volume pane's row: its name and the bar's volume, ⚙ (chart settings) and × (hide the pane). */
function VolumeItem({ ctx, value }: { ctx: WidgetContext; value: string | null }) {
  const t = stringsOf(ctx.store.get());
  return (
    <div class="fnc-ind fnc-volume-item">
      <span class="fnc-ind-title">{t.settingVolume}</span>
      {value !== null && <b class="fnc-flat">{value}</b>}
      <span class="fnc-ind-actions">
        <button
          class="fnc-ind-btn"
          data-tip={t.chartSettings}
          aria-label={`${t.settingVolume} ${t.chartSettings}`}
          onClick={() => ctx.store.set({ dialog: { kind: 'chartSettings' } })}
        >
          <GearIcon />
        </button>
        <button class="fnc-ind-btn" data-tip={t.hideVolume} aria-label={t.hideVolume} onClick={() => ctx.chart.setVolumeVisible(false)}>
          <SmallCloseIcon />
        </button>
      </span>
    </div>
  );
}

function Legend({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [hover, setHover] = useState<{ bar: Bar; prev: Bar | undefined; index: number } | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const offs = [
      ctx.chart.on('crosshairMove', (info) =>
        setHover(info ? { bar: info.bar, prev: ctx.chart.bars[info.index - 1], index: info.index } : null),
      ),
      ctx.chart.on('dataChange', () => refresh(undefined)),
      // Compare values are % from the first visible bar, so they change while scrolling.
      ctx.chart.on('visibleRangeChange', () => ctx.store.get().compares.length > 0 && refresh(undefined)),
    ];
    return () => offs.forEach((off) => off());
  }, [ctx.chart]);

  // Reserve the legend's height at the top of the price pane so it never covers candles
  // (it wraps to more lines on narrow screens).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => ctx.chart.setTopInset(el.offsetTop + el.offsetHeight + 4);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ctx.chart]);

  if (!s.symbol) return <div class="fnc-legend" ref={ref} />;
  const bars = ctx.chart.bars;
  const bar = hover?.bar ?? bars[bars.length - 1];
  const prev = hover ? hover.prev : bars[bars.length - 2];
  const fmt = (p: number) => formatPrice(p, s.symbol!.pricePrecision);

  let values = null;
  if (bar) {
    const cls = dirClass(bar.close - bar.open);
    const change = prev ? bar.close - prev.close : 0;
    const pct = prev && prev.close ? (change / prev.close) * 100 : 0;
    const sign = change > 0 ? '+' : '';
    values = (
      <div class="fnc-legend-values">
        <span>
          {t.open} <b class={cls}>{fmt(bar.open)}</b>
        </span>
        <span>
          {t.high} <b class={cls}>{fmt(bar.high)}</b>
        </span>
        <span>
          {t.low} <b class={cls}>{fmt(bar.low)}</b>
        </span>
        <span>
          {t.close_} <b class={cls}>{fmt(bar.close)}</b>
        </span>
        <b class={dirClass(change)}>
          {sign}
          {fmt(change)} ({sign}
          {pct.toFixed(2)}%)
        </b>
        {bar.volume !== undefined && (
          <span>
            {t.volume} <b class="fnc-flat">{formatCompact(bar.volume, s.locale)}</b>
          </span>
        )}
      </div>
    );
  }

  // Indicator values follow the crosshair, else the latest bar.
  const items = s.indicators.length ? ctx.chart.indicatorLegend(hover?.index) : [];
  const overlayItems = items.filter((i) => i.overlay);
  const paneLegends = s.layout.panes
    .filter((p) => p.kind === 'indicator')
    .map((pane) => ({ pane, item: items.find((i) => i.id === pane.id) }));
  const volumePane = s.layout.panes.find((p) => p.kind === 'volume');

  return (
    <>
      <div class="fnc-legend" ref={ref}>
        <div class="fnc-legend-title">
          {ctx.showLogo && <SymbolAvatar info={s.symbol} size={18} />}
          <b>{s.symbol.name}</b>
          <span>·</span>
          <span>{resolutionLabel(s.resolution, s.locale)}</span>
          <span>·</span>
          <span>{s.symbol.exchange}</span>
          {s.loading && <span class="fnc-spinner" role="status" />}
        </div>
        {values}
        {s.compares.length > 0 &&
          ctx.chart.compareLegend(hover?.index).map((c) => (
            <div class="fnc-cmp">
              <i class="fnc-cmp-dot" style={{ background: c.color }} />
              <span class="fnc-cmp-name">{c.name}</span>
              <b>{c.value}</b>
              <button
                class="fnc-ind-btn"
                data-tip={t.removeCompare}
                aria-label={`${c.name} ${t.removeCompare}`}
                onClick={() => ctx.chart.removeCompare(c.symbol)}
              >
                <SmallCloseIcon />
              </button>
            </div>
          ))}
        {!collapsed && overlayItems.map((item) => <IndicatorItem ctx={ctx} item={item} />)}
        {!collapsed && s.legendItems.map((item) => <AppItem ctx={ctx} item={item} />)}
        {/* Collapse (an up arrow) at the end of the list; collapsed, a small bar brings it back. */}
        {overlayItems.length + s.legendItems.length > 0 &&
          (collapsed ? (
            <button class="fnc-ind-handle" aria-expanded="false" aria-label={t.expand} data-tip={t.expand} onClick={() => setCollapsed(false)}>
              <span />
            </button>
          ) : (
            <button class="fnc-ind-collapse" aria-expanded="true" aria-label={t.collapse} data-tip={t.collapse} onClick={() => setCollapsed(true)}>
              <ChevronUpIcon />
            </button>
          ))}
      </div>
      {volumePane && (
        <div class="fnc-legend fnc-pane-legend" style={{ top: `${volumePane.top + 4}px` }}>
          <VolumeItem ctx={ctx} value={bar?.volume !== undefined ? formatCompact(bar.volume, s.locale) : null} />
        </div>
      )}
      {paneLegends.map(
        ({ pane, item }) =>
          item && (
            <div class="fnc-legend fnc-pane-legend" style={{ top: `${pane.top + 4}px` }}>
              <IndicatorItem ctx={ctx} item={item} />
            </div>
          ),
      )}
    </>
  );
}

function NavControls({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  // Chart settings → "확대·이동 버튼" hides the zoom/scroll group (the jump-to-latest button stays).
  const [showButtons, setShowButtons] = useState(ctx.chart.settings.navigationButtons);
  useEffect(() => ctx.chart.on('settingsChange', (settings) => setShowButtons(settings.navigationButtons)), [ctx.chart]);
  const { plotWidth, panesHeight } = s.layout;
  if (plotWidth <= 0) return null;
  const top = panesHeight - CONTROL_OFFSET;
  const page = () => Math.max(1, Math.round(plotWidth / ctx.chart.timeScale.barSpacing / 3));

  const button = (label: string, onClick: () => void, icon: JSX.Element) => (
    <button class="fnc-btn" data-tip={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );

  const replaying = s.replay.active || s.replay.selecting;
  return (
    <>
      {showButtons && !replaying && (
      <div class="fnc-nav" style={{ left: `${plotWidth / 2}px`, top: `${top}px` }}>
        {button(t.zoomOut, () => ctx.chart.zoom(1 / ZOOM_STEP), <MinusIcon />)}
        {button(t.zoomIn, () => ctx.chart.zoom(ZOOM_STEP), <PlusIcon />)}
        {button(t.scrollBack, () => ctx.chart.scrollBars(-page()), <ChevronLeftIcon />)}
        {button(t.scrollForward, () => ctx.chart.scrollBars(page()), <ChevronRightIcon />)}
        {button(t.resetView, () => ctx.chart.resetView(), <ResetIcon />)}
      </div>
      )}
      {!s.atRealtime && (
        <button
          class="fnc-realtime"
          style={{ left: `${plotWidth - 44}px`, top: `${top}px` }}
          data-tip={t.toRealtime}
          aria-label={t.toRealtime}
          onClick={() => ctx.chart.scrollToRealtime()}
        >
          <ToRealtimeIcon />
        </button>
      )}
    </>
  );
}

const ATTRIBUTION_URL = 'https://charts.funnest.xyz/?utm_source=chart&utm_medium=attribution';

/** Bottom-left logo badge (like the TradingView mark): "Charts by Funnest". */
function Attribution({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const { panesHeight, plotWidth } = s.layout;
  if (!ctx.attribution || plotWidth <= 0) return null;
  const label = s.locale === 'ko' ? 'Funnest 차트' : 'Charts by Funnest';
  return (
    <a
      class="fnc-attribution"
      href={ATTRIBUTION_URL}
      target="_blank"
      rel="noopener"
      data-tip={label}
      aria-label={label}
      style={{ top: `${panesHeight - 36}px` }}
    >
      <FunnestMark />
      <span>funnest</span>
    </a>
  );
}

/** Multi-chart: maximize/restore button at the pane's top-right corner (left of the price axis). */
function PaneTools({ ctx }: { ctx: WidgetContext }) {
  return ctx.multi ? <PaneMaximize ctx={ctx} multi={ctx.multi} /> : null;
}

function PaneMaximize({ ctx, multi }: { ctx: WidgetContext; multi: MultiControls }) {
  const s = useStore(ctx.store);
  const m = useStore(multi.store);
  if (s.layout.plotWidth <= 0 || m.narrow || (m.layout === '1' && m.maximized === null)) return null;
  const t = stringsOf(s);
  const maximized = m.maximized !== null;
  const label = maximized ? t.restorePane : t.maximizePane;
  return (
    <button
      class="fnc-btn fnc-pane-max"
      style={{ left: `${s.layout.plotWidth - 36}px` }}
      data-tip={`${label} (Alt+Enter)`}
      aria-label={label}
      aria-pressed={maximized}
      onClick={() => {
        const index = multi.store.get().active;
        multi.toggleMaximize(index);
      }}
    >
      {maximized ? <RestoreIcon /> : <MaximizeIcon />}
    </button>
  );
}

/** Bars per second ↔ ms per bar. */
const REPLAY_SPEEDS = [
  { label: '1x', interval: 1000 },
  { label: '3x', interval: 333 },
  { label: '10x', interval: 100 },
];

/** Bottom-center bar while replaying (or a hint while picking the start bar). */
function ReplayBar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const r = s.replay;
  const { plotWidth, panesHeight } = s.layout;
  if (plotWidth <= 0 || (!r.active && !r.selecting)) return null;
  const style = { left: `${plotWidth / 2}px`, top: `${panesHeight - CONTROL_OFFSET}px` };

  if (!r.active) {
    return (
      <div class="fnc-replay fnc-replay-hint" style={style} role="status">
        <ReplayIcon />
        <span>{t.replayPick}</span>
        <button class="fnc-ind-btn" aria-label={t.cancel} data-tip={`${t.cancel} (Esc)`} onClick={() => ctx.chart.setReplaySelecting(false)}>
          <SmallCloseIcon />
        </button>
      </div>
    );
  }
  const done = r.remaining === 0;
  const button = (label: string, onClick: () => void, icon: JSX.Element, disabled = false) => (
    <button class="fnc-btn" data-tip={label} aria-label={label} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
  return (
    <div class="fnc-replay" style={style} role="toolbar" aria-label={t.replay}>
      {r.playing
        ? button(t.replayPause, () => ctx.chart.replayPause(), <PauseIcon />)
        : button(t.replayPlay, () => ctx.chart.replayPlay(), <PlayIcon />, done)}
      {button(t.replayStep, () => ctx.chart.replayStep(), <StepIcon />, done)}
      <div class="fnc-seg fnc-seg-sm" role="radiogroup" aria-label={t.replaySpeed}>
        {REPLAY_SPEEDS.map((speed) => (
          <button
            type="button"
            role="radio"
            aria-checked={r.interval === speed.interval}
            onClick={() => ctx.chart.setReplayInterval(speed.interval)}
          >
            {speed.label}
          </button>
        ))}
      </div>
      {done && <span class="fnc-replay-note">{t.replayDone}</span>}
      <div class="fnc-sep" />
      {button(t.replayRestart, () => ctx.chart.setReplaySelecting(true), <ReplayIcon />)}
      {button(t.replayExit, () => ctx.chart.stopReplay(), <SmallCloseIcon />)}
    </div>
  );
}

export function Overlay({ ctx }: { ctx: WidgetContext }) {
  return (
    <>
      <Attribution ctx={ctx} />
      <Legend ctx={ctx} />
      <NavControls ctx={ctx} />
      <ReplayBar ctx={ctx} />
      <SelectionBar ctx={ctx} />
      <PaneTools ctx={ctx} />
      <ContextMenu ctx={ctx} />
    </>
  );
}
