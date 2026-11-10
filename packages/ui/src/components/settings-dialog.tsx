/** @jsxImportSource preact */
import { DEFAULT_CHART_SETTINGS, type ChartSettings } from '@funnest/charts';
import { useEffect, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { STRINGS, type Strings } from '../i18n';
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

/**
 * Chart settings ("차트 설정"). Changes apply immediately (live preview), like TradingView;
 * "기본값으로" restores DEFAULT_CHART_SETTINGS.
 */
export function SettingsDialog({ ctx }: { ctx: WidgetContext }) {
  const { locale } = useStore(ctx.store);
  const t = STRINGS[locale];
  const [settings, setSettings] = useState(ctx.chart.settings);
  useEffect(() => ctx.chart.on('settingsChange', setSettings), [ctx.chart]);

  const close = () => ctx.store.set({ dialog: null });
  const set = (patch: Partial<ChartSettings>) => ctx.chart.setSettings(patch);
  // Show the effective theme colors when no override is set.
  const themeColor = (name: '--fnc-up' | '--fnc-down') => toHex(getComputedStyle(ctx.root).getPropertyValue(name).trim());

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
