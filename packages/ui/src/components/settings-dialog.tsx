/** @jsxImportSource preact */
import { CHART_THEMES, DEFAULT_CHART_SETTINGS, matchChartTheme, type ChartSettings, type PriceScaleMode } from '@funnest/charts';
import { useEffect, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { stringsOf, type Strings } from '../i18n';
import { CloseIcon } from '../icons';
import { useStore } from '../store';

/** Any CSS color (incl. var(--x) already resolved by the browser) → #rrggbb for <input type=color>. */
function toHex(color: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  return ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#000000';
}

type Toggle = { [K in keyof ChartSettings]: ChartSettings[K] extends boolean ? K : never }[keyof ChartSettings];

const SECTIONS: { title: keyof Strings; toggles: { key: Toggle; label: keyof Strings }[] }[] = [
  {
    title: 'settingsDisplay',
    toggles: [
      { key: 'highLowMarkers', label: 'settingHighLow' },
      { key: 'lastPriceLine', label: 'settingLastPrice' },
      { key: 'countdown', label: 'settingCountdown' },
      { key: 'volume', label: 'settingVolume' },
      { key: 'navigationButtons', label: 'settingNavButtons' },
    ],
  },
  {
    title: 'settingsGrid',
    toggles: [
      { key: 'gridHorizontal', label: 'settingGridH' },
      { key: 'gridVertical', label: 'settingGridV' },
    ],
  },
];

const SCALES: { mode: PriceScaleMode; label: keyof Strings }[] = [
  { mode: 'normal', label: 'scaleNormal' },
  { mode: 'log', label: 'scaleLog' },
  { mode: 'percent', label: 'scalePercent' },
];

/**
 * Chart settings ("차트 설정"). Changes apply immediately (live preview), like TradingView;
 * "기본값으로" restores DEFAULT_CHART_SETTINGS.
 */
export function SettingsDialog({ ctx }: { ctx: WidgetContext }) {
  const { locale } = useStore(ctx.store);
  const t = stringsOf(ctx.store.get());
  const [settings, setSettings] = useState(ctx.chart.settings);
  useEffect(() => ctx.chart.on('settingsChange', setSettings), [ctx.chart]);

  const close = () => ctx.store.set({ dialog: null });
  const set = (patch: Partial<ChartSettings>) => ctx.chart.setSettings(patch);
  // Show the effective theme colors when no override is set.
  const themeColor = (name: '--fnc-up' | '--fnc-down' | '--fnc-bg' | '--fnc-border') => toHex(getComputedStyle(ctx.root).getPropertyValue(name).trim());
  const currentTheme = matchChartTheme(settings);

  return (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="fnc-dialog" role="dialog" aria-modal="true" aria-label={t.chartSettings} onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div class="fnc-dialog-head">
          <b>{t.chartSettings}</b>
          <button class="fnc-btn" aria-label={t.close} onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <form class="fnc-form" onSubmit={(e) => (e.preventDefault(), close())}>
          <div class="fnc-section">{t.settingsTheme}</div>
          <div class="fnc-themes" role="radiogroup" aria-label={t.settingsTheme}>
            {CHART_THEMES.map((theme) => {
              const c = theme.colors;
              const bg = c.background ?? themeColor('--fnc-bg');
              const grid = c.gridColor ?? themeColor('--fnc-border');
              const up = c.upColor ?? themeColor('--fnc-up');
              const down = c.downColor ?? themeColor('--fnc-down');
              return (
                <button
                  type="button"
                  role="radio"
                  class="fnc-theme"
                  aria-checked={currentTheme?.id === theme.id}
                  onClick={() => set({ ...c })}
                >
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
              <input
                type="color"
                class="fnc-color"
                value={settings[key] ?? themeColor(key === 'upColor' ? '--fnc-up' : '--fnc-down')}
                onInput={(e) => set({ [key]: e.currentTarget.value })}
              />
              {settings[key] && (
                <button type="button" class="fnc-link" onClick={() => set({ [key]: null })}>
                  {t.followTheme}
                </button>
              )}
            </label>
          ))}
          <div class="fnc-section">{t.settingsScale}</div>
          <div class="fnc-row">
            <div class="fnc-seg" role="radiogroup" aria-label={t.settingsScale}>
              {SCALES.map(({ mode, label }) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.priceScale === mode}
                  onClick={() => set({ priceScale: mode })}
                >
                  {t[label]}
                </button>
              ))}
            </div>
          </div>
          {SECTIONS.map((section) => (
            <>
              <div class="fnc-section">{t[section.title]}</div>
              {section.toggles.map(({ key, label }) => (
                <label class="fnc-row fnc-toggle-row">
                  <span>{t[label]}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    class="fnc-switch"
                    checked={settings[key]}
                    onChange={(e) => set({ [key]: e.currentTarget.checked })}
                  />
                </label>
              ))}
            </>
          ))}
          <div class="fnc-form-actions">
            <button type="button" class="fnc-action fnc-action-danger" onClick={() => ctx.chart.setSettings(DEFAULT_CHART_SETTINGS)}>
              {t.resetDefaults}
            </button>
            <button type="submit" class="fnc-action fnc-action-primary">
              {t.done}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
