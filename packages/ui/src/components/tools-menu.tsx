/** @jsxImportSource preact */
import type { ChartType, PriceScaleMode } from '@funnest/charts';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { LayoutSync, MultiControls, WidgetContext } from '../context';
import { stringsOf, type Strings } from '../i18n';
import {
  AreaChartIcon,
  CameraIcon,
  CandlesIcon,
  ChevronDownIcon,
  CompareIcon,
  LineChartIcon,
  ReplayIcon,
  SettingsIcon,
  ToolsIcon,
} from '../icons';
import { LAYOUT_GROUPS, LAYOUTS, paneCount } from '../layouts';
import { useStore } from '../store';
import { useKeepInView } from './keep-in-view';
import { LayoutGlyph } from './layout-menu';

const TYPES: { type: ChartType; label: keyof Strings; icon: () => JSX.Element }[] = [
  { type: 'candles', label: 'candles', icon: CandlesIcon },
  { type: 'line', label: 'line', icon: LineChartIcon },
  { type: 'area', label: 'area', icon: AreaChartIcon },
];

const SCALES: { mode: PriceScaleMode; label: keyof Strings }[] = [
  { mode: 'normal', label: 'scaleNormal' },
  { mode: 'log', label: 'scaleLog' },
  { mode: 'percent', label: 'scalePercent' },
];

const SYNC_KEYS: { key: keyof LayoutSync; label: 'syncCrosshair' | 'syncTime' | 'syncSymbol' | 'syncInterval' }[] = [
  { key: 'crosshair', label: 'syncCrosshair' },
  { key: 'time', label: 'syncTime' },
  { key: 'symbol', label: 'syncSymbol' },
  { key: 'interval', label: 'syncInterval' },
];

/** 화면 분할 + 칸 동기화 (multi-chart widget only). */
function LayoutSection({ ctx, multi, close }: { ctx: WidgetContext; multi: MultiControls; close(): void }) {
  const s = useStore(ctx.store);
  const m = useStore(multi.store);
  const t = stringsOf(s);
  return (
    <>
      <div class="fnc-tools-section">{t.layout}</div>
      <div class="fnc-tools-layouts">
        {LAYOUT_GROUPS.map((group) => (
          <div class="fnc-layout-row">
            <span class="fnc-layout-count">{group[0]!.split('-')[0]}</span>
            {group.map((id) => (
              <button
                class="fnc-layout-opt"
                role="menuitemradio"
                aria-checked={id === m.layout}
                aria-label={`${t.layout} ${id}`}
                data-layout={id}
                onClick={() => {
                  multi.setLayout(id);
                  close();
                }}
              >
                <LayoutGlyph id={id} />
              </button>
            ))}
          </div>
        ))}
      </div>
      {/* Syncing only means something with two or more panes on screen. */}
      {paneCount(LAYOUTS[m.layout]) > 1 && <div class="fnc-tools-section">{t.sync}</div>}
      {paneCount(LAYOUTS[m.layout]) > 1 &&
        SYNC_KEYS.map(({ key, label }) => (
          <button
            class="fnc-menu-item fnc-sync-item"
            role="menuitemcheckbox"
            aria-checked={m.sync[key]}
            onClick={() => multi.setSync({ [key]: !m.sync[key] })}
          >
            <span>{t[label]}</span>
            <span class="fnc-switch" data-on={m.sync[key] ? 'true' : 'false'} aria-hidden="true" />
          </button>
        ))}
    </>
  );
}

/**
 * One "도구" button for the chart's less frequent tools, so the toolbar keeps symbol, interval,
 * market info and 지표 in view: chart type, split layout (+ sync), compare, replay, price axis,
 * screenshot, the app's own rows (toolsMenuItems) and chart settings.
 */
export function ToolsMenu({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(ctx.chart.settings.priceScale);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useKeepInView<HTMLDivElement>(open);
  const canSearch = typeof ctx.datafeed.searchSymbols === 'function';
  const close = () => setOpen(false);

  useEffect(() => ctx.chart.on('settingsChange', (settings) => setScale(settings.priceScale)), [ctx.chart]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = (cls: string, label: string, icon: JSX.Element, onClick: () => void, opts: { disabled?: boolean; pressed?: boolean } = {}) => (
    <button
      class={`fnc-menu-item fnc-tools-item ${cls}`}
      role="menuitem"
      disabled={opts.disabled}
      aria-pressed={opts.pressed}
      onClick={() => {
        close();
        onClick();
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div class="fnc-menu-wrap fnc-tools-wrap" ref={ref}>
      <button
        class="fnc-btn fnc-btn-wide fnc-btn-label fnc-btn-tools"
        data-tip={t.tools}
        aria-label={t.tools}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={s.replay.active || s.replay.selecting || s.compares.length > 0}
        onClick={() => setOpen(!open)}
      >
        <ToolsIcon />
        <span>{t.tools}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div class="fnc-menu fnc-tools-menu" role="menu" aria-label={t.tools} ref={menuRef}>
          <div class="fnc-tools-section">{t.chartType}</div>
          <div class="fnc-seg fnc-tools-seg" role="radiogroup" aria-label={t.chartType}>
            {TYPES.map(({ type, label, icon: Icon }) => (
              <button
                type="button"
                role="radio"
                aria-checked={s.chartType === type}
                data-type={type}
                onClick={() => {
                  ctx.chart.setChartType(type);
                  ctx.store.set({ chartType: type });
                }}
              >
                <Icon />
                <span>{t[label]}</span>
              </button>
            ))}
          </div>

          {ctx.multi && <LayoutSection ctx={ctx} multi={ctx.multi} close={close} />}

          <div class="fnc-tools-sep" />
          {canSearch &&
            item('fnc-btn-compare', t.compareSymbol, <CompareIcon />, () => ctx.setSearchOpen(true, 'compare'), {
              disabled: s.compares.length >= 5,
            })}
          {item(
            'fnc-btn-replay',
            s.replay.active ? t.replayExit : t.replay,
            <ReplayIcon />,
            () => (s.replay.active ? ctx.chart.stopReplay() : ctx.chart.setReplaySelecting(true)),
            { pressed: s.replay.active || s.replay.selecting },
          )}
          {item('fnc-btn-screenshot', t.screenshot, <CameraIcon />, ctx.screenshot)}

          <div class="fnc-tools-section">{t.settingsScale}</div>
          <div class="fnc-seg fnc-tools-seg" role="radiogroup" aria-label={t.settingsScale}>
            {SCALES.map(({ mode, label }) => (
              <button type="button" role="radio" aria-checked={scale === mode} onClick={() => ctx.chart.setSettings({ priceScale: mode })}>
                <span>{t[label]}</span>
              </button>
            ))}
          </div>

          <div class="fnc-tools-sep" />
          {(ctx.toolsMenuItems?.(ctx.chart) ?? []).map((extra) =>
            item(
              'fnc-tools-app',
              extra.label,
              // The app's own SVG markup (it's the app's string, not user input).
              <span class="fnc-tools-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: extra.icon ?? '' }} />,
              () => extra.onSelect(ctx.chart),
              { disabled: extra.disabled ?? false },
            ),
          )}
          {item('fnc-btn-settings', t.chartSettingsMore, <SettingsIcon />, () => ctx.store.set({ dialog: { kind: 'chartSettings' } }))}
        </div>
      )}
    </div>
  );
}
