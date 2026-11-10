/** @jsxImportSource preact */
import type { DrawingType } from '@funnest/charts';
import type { JSX } from 'preact';
import type { WidgetContext } from '../context';
import { STRINGS, type Strings } from '../i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CursorIcon,
  FibonacciIcon,
  HorizontalLineIcon,
  MagnetIcon,
  TrashIcon,
  TrendLineIcon,
} from '../icons';
import { useStore } from '../store';

const TOOLS: { tool: DrawingType | null; label: keyof Strings; icon: () => JSX.Element }[] = [
  { tool: null, label: 'cursor', icon: CursorIcon },
  { tool: 'trendline', label: 'trendline', icon: TrendLineIcon },
  { tool: 'horizontal', label: 'horizontal', icon: HorizontalLineIcon },
  { tool: 'fibonacci', label: 'fibonacci', icon: FibonacciIcon },
];

/** Left vertical tool bar (TradingView layout). On narrow screens it slides in over the chart. */
export function DrawingToolbar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];

  const pick = (tool: DrawingType | null) => {
    ctx.chart.setDrawingTool(tool);
    // On mobile, hide the bar once a tool is armed so the whole chart is free to draw on.
    if (tool && ctx.store.get().drawbarOpen) ctx.store.set({ drawbarOpen: false });
  };

  // Folding is a desktop affordance; on mobile the toolbar pencil slides the bar in instead,
  // so the bar stays rendered and CSS decides (data-collapsed is ignored on narrow screens).
  return (
    <>
      {s.drawbarCollapsed && (
        <button class="fnc-drawbar-tab" aria-label={t.expandDrawbar} title={t.expandDrawbar} onClick={() => ctx.setDrawbarCollapsed(false)}>
          <ChevronRightIcon />
        </button>
      )}
    <div
      class="fnc-drawbar"
      role="toolbar"
      aria-label={t.drawingTools}
      aria-orientation="vertical"
      data-open={s.drawbarOpen}
      data-collapsed={s.drawbarCollapsed}
    >
      {TOOLS.map(({ tool, label, icon: Icon }) => (
        <button
          class="fnc-btn"
          title={t[label]}
          aria-label={t[label]}
          aria-pressed={s.drawingTool === tool}
          onClick={() => pick(tool)}
        >
          <Icon />
        </button>
      ))}
      <div class="fnc-hsep" />
      <button
        class="fnc-btn"
        title={t.magnet}
        aria-label={t.magnet}
        aria-pressed={s.magnet}
        onClick={() => ctx.chart.setMagnet(!s.magnet)}
      >
        <MagnetIcon />
      </button>
      <button
        class="fnc-btn"
        title={t.removeAll}
        aria-label={t.removeAll}
        disabled={s.drawingCount === 0}
        onClick={() => ctx.chart.clearDrawings()}
      >
        <TrashIcon />
      </button>
      <span class="fnc-spacer" />
      <button
        class="fnc-btn fnc-drawbar-collapse"
        title={t.collapseDrawbar}
        aria-label={t.collapseDrawbar}
        onClick={() => ctx.setDrawbarCollapsed(true)}
      >
        <ChevronLeftIcon />
      </button>
    </div>
    </>
  );
}

const SWATCHES = ['#3182F6', '#F04452', '#12B886', '#FF9F0A', '#7048E8'];

/** Floating bar for the selected drawing: color + delete (also the only way to delete on touch). */
export function SelectionBar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const d = s.selection;
  if (!d || s.layout.plotWidth <= 0) return null;

  return (
    <div class="fnc-selbar" role="toolbar" style={{ left: `${s.layout.plotWidth / 2}px` }}>
      {SWATCHES.map((color) => (
        <button
          class="fnc-swatch"
          style={{ background: color }}
          title={t.color}
          aria-label={`${t.color} ${color}`}
          aria-pressed={(d.color ?? SWATCHES[0]) === color}
          onClick={() => ctx.chart.updateDrawing(d.id, { color })}
        />
      ))}
      <div class="fnc-sep" />
      <button class="fnc-btn" title={t.remove} aria-label={t.remove} onClick={() => ctx.chart.removeDrawing(d.id)}>
        <TrashIcon />
      </button>
    </div>
  );
}
