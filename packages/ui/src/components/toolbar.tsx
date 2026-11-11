/** @jsxImportSource preact */
import type { WidgetContext } from '../context';
import { STRINGS } from '../i18n';
import { CameraIcon, ChevronDownIcon, CollapseIcon, ExpandIcon, IndicatorIcon, PencilIcon, SearchIcon, SettingsIcon } from '../icons';
import { useStore } from '../store';
import { ChartTypeMenu } from './chart-type-menu';
import { Dialogs } from './indicator-dialogs';
import { IntervalPicker } from './interval-picker';
import { LayoutMenu } from './layout-menu';
import { Slot } from './slot';
import { SymbolAvatar } from './symbol-avatar';
import { SymbolSearch } from './symbol-search';

export function Toolbar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const canSearch = typeof ctx.datafeed.searchSymbols === 'function';

  return (
    <div class="fnc-toolbar" role="toolbar">
      <button
        class="fnc-symbol"
        disabled={!canSearch}
        data-tip={canSearch ? t.searchSymbol : undefined}
        aria-haspopup="dialog"
        onClick={() => ctx.setSearchOpen(true)}
      >
        {ctx.showLogo && s.symbol ? (
          <SymbolAvatar info={s.symbol} size={24} />
        ) : (
          canSearch && (
            <span class="fnc-icon">
              <SearchIcon />
            </span>
          )
        )}
        <span class="fnc-symbol-name">{s.symbol?.name ?? '—'}</span>
        {canSearch && ctx.showLogo && (
          <span class="fnc-icon">
            <ChevronDownIcon />
          </span>
        )}
      </button>

      <div class="fnc-sep" />

      <IntervalPicker ctx={ctx} />

      <Slot el={ctx.slots.toolbar} />

      <div class="fnc-spacer" />

      {/* Chart tools sit on the right, next to settings, leaving the left for symbol, interval and market info. */}
      <div class="fnc-tools">
        <ChartTypeMenu ctx={ctx} />
        <button
          class="fnc-btn fnc-btn-wide fnc-btn-label"
          data-tip={t.addIndicator}
          aria-label={t.addIndicator}
          aria-haspopup="dialog"
          onClick={() => ctx.store.set({ dialog: { kind: 'indicators' } })}
        >
          <IndicatorIcon />
          <span>{t.indicators}</span>
        </button>
        {ctx.multi && <LayoutMenu ctx={ctx} multi={ctx.multi} />}
      </div>
      <div class="fnc-sep" />

      {ctx.drawingToolbar && (
        <button
          class="fnc-btn fnc-btn-drawbar"
          data-tip={t.drawingTools}
          aria-label={t.drawingTools}
          aria-pressed={s.drawbarOpen || s.drawingTool !== null}
          onClick={() => ctx.store.set({ drawbarOpen: !s.drawbarOpen })}
        >
          <PencilIcon />
        </button>
      )}
      <Slot el={ctx.slots.toolbarEnd} fixed />
      <button
        class="fnc-btn"
        data-tip={t.chartSettings}
        aria-label={t.chartSettings}
        aria-haspopup="dialog"
        onClick={() => ctx.store.set({ dialog: { kind: 'chartSettings' } })}
      >
        <SettingsIcon />
      </button>
      <button class="fnc-btn fnc-btn-screenshot" data-tip={t.screenshot} aria-label={t.screenshot} onClick={ctx.screenshot}>
        <CameraIcon />
      </button>
      <button
        class="fnc-btn"
        data-tip={s.fullscreen ? t.exitFullscreen : t.fullscreen}
        aria-label={s.fullscreen ? t.exitFullscreen : t.fullscreen}
        onClick={ctx.toggleFullscreen}
      >
        {s.fullscreen ? <CollapseIcon /> : <ExpandIcon />}
      </button>

      {s.searchOpen && canSearch && <SymbolSearch ctx={ctx} />}
      <Dialogs ctx={ctx} />
    </div>
  );
}
