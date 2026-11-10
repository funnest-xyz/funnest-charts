/** @jsxImportSource preact */
import { formatCompact, formatPrice, type Bar, type IndicatorLegendItem } from '@funnest/charts';
import type { JSX } from 'preact';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { resolutionLabel, STRINGS } from '../i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CollapseLeftIcon,
  EyeIcon,
  EyeOffIcon,
  FunnestMark,
  GearIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
  SmallCloseIcon,
  ToRealtimeIcon,
} from '../icons';
import { useStore } from '../store';
import { SelectionBar } from './drawing-toolbar';
import { SymbolAvatar } from './symbol-avatar';

const ZOOM_STEP = 1.25;
const CONTROL_OFFSET = 52; // px above the time axis

const dirClass = (v: number) => (v > 0 ? 'fnc-up' : v < 0 ? 'fnc-down' : 'fnc-flat');

function IndicatorItem({ ctx, item }: { ctx: WidgetContext; item: IndicatorLegendItem }) {
  const t = STRINGS[ctx.store.get().locale];
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
        title={item.visible ? t.hide : t.show}
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
        <b style={{ color: v.color }} title={v.label}>
          {v.value}
        </b>
      ))}
      <span class="fnc-ind-actions">
        <button
          class="fnc-ind-btn"
          title={t.indicatorSettings}
          aria-label={`${item.title} ${t.indicatorSettings}`}
          onClick={() => ctx.store.set({ dialog: { kind: 'indicatorSettings', id: item.id } })}
        >
          <GearIcon />
        </button>
        <button
          class="fnc-ind-btn"
          title={t.removeIndicator}
          aria-label={`${item.title} ${t.removeIndicator}`}
          onClick={() => ctx.chart.removeIndicator(item.id)}
        >
          <SmallCloseIcon />
        </button>
      </span>
    </div>
  );
}

function Legend({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const [hover, setHover] = useState<{ bar: Bar; prev: Bar | undefined; index: number } | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const offs = [
      ctx.chart.on('crosshairMove', (info) =>
        setHover(info ? { bar: info.bar, prev: ctx.chart.bars[info.index - 1], index: info.index } : null),
      ),
      ctx.chart.on('dataChange', () => refresh(undefined)),
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
        {!collapsed && overlayItems.map((item) => <IndicatorItem ctx={ctx} item={item} />)}
        {/* Collapse to the left at the end of the list; collapsed, a small bar brings it back. */}
        {overlayItems.length > 0 &&
          (collapsed ? (
            <button class="fnc-ind-handle" aria-expanded="false" aria-label={t.expand} title={t.expand} onClick={() => setCollapsed(false)}>
              <span />
            </button>
          ) : (
            <button class="fnc-ind-collapse" aria-expanded="true" aria-label={t.collapse} title={t.collapse} onClick={() => setCollapsed(true)}>
              <CollapseLeftIcon />
            </button>
          ))}
      </div>
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
  const t = STRINGS[s.locale];
  const { plotWidth, panesHeight } = s.layout;
  if (plotWidth <= 0) return null;
  const top = panesHeight - CONTROL_OFFSET;
  const page = () => Math.max(1, Math.round(plotWidth / ctx.chart.timeScale.barSpacing / 3));

  const button = (label: string, onClick: () => void, icon: JSX.Element) => (
    <button class="fnc-btn" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );

  return (
    <>
      <div class="fnc-nav" style={{ left: `${plotWidth / 2}px`, top: `${top}px` }}>
        {button(t.zoomOut, () => ctx.chart.zoom(1 / ZOOM_STEP), <MinusIcon />)}
        {button(t.zoomIn, () => ctx.chart.zoom(ZOOM_STEP), <PlusIcon />)}
        {button(t.scrollBack, () => ctx.chart.scrollBars(-page()), <ChevronLeftIcon />)}
        {button(t.scrollForward, () => ctx.chart.scrollBars(page()), <ChevronRightIcon />)}
        {button(t.resetView, () => ctx.chart.resetView(), <ResetIcon />)}
      </div>
      {!s.atRealtime && (
        <button
          class="fnc-realtime"
          style={{ left: `${plotWidth - 44}px`, top: `${top}px` }}
          title={t.toRealtime}
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
      title={label}
      aria-label={label}
      style={{ top: `${panesHeight - 36}px` }}
    >
      <FunnestMark />
      <span>funnest</span>
    </a>
  );
}

export function Overlay({ ctx }: { ctx: WidgetContext }) {
  return (
    <>
      <Attribution ctx={ctx} />
      <Legend ctx={ctx} />
      <NavControls ctx={ctx} />
      <SelectionBar ctx={ctx} />
    </>
  );
}
