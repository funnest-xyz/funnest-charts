/** @jsxImportSource preact */
import type { WidgetContext } from '../context';
import { STRINGS } from '../i18n';
import { ChevronDownIcon, CollapseIcon, ExpandIcon, IndicatorIcon, PencilIcon, SearchIcon } from '../icons';
import { useStore } from '../store';
import { Dialogs } from './indicator-dialogs';
import { IntervalPicker } from './interval-picker';
import { Slot } from './slot';
import { SymbolAvatar } from './symbol-avatar';
import { SymbolSearch } from './symbol-search';
import { ToolsMenu } from './tools-menu';

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
        onClick={() => ctx.setSearchOpen(true, 'symbol')}
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

      {/* Right side: 지표 (used most) and one 도구 menu for the rest — chart type, split, compare,
          replay, price axis, screenshot, settings — leaving the left for symbol, interval and market info. */}
      <div class="fnc-tools">
        <button
          class="fnc-btn fnc-btn-wide fnc-btn-label fnc-btn-indicators"
          data-tip={t.addIndicator}
          aria-label={t.addIndicator}
          aria-haspopup="dialog"
          onClick={() => ctx.store.set({ dialog: { kind: 'indicators' } })}
        >
          <IndicatorIcon />
          <span>{t.indicators}</span>
        </button>
        <ToolsMenu ctx={ctx} />
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
        class="fnc-btn fnc-btn-fullscreen"
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
