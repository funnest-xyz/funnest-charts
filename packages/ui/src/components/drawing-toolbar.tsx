/** @jsxImportSource preact */
import type { DrawingDefinition, DrawingType, Locale } from '@funnest/charts';
import { Fragment, type JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { STRINGS } from '../i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerIcon,
  CursorIcon,
  FibonacciIcon,
  HorizontalLineIcon,
  MagnetIcon,
  SvgIcon,
  TrashIcon,
  TrendLineIcon,
} from '../icons';
import { useStore } from '../store';

const BUILTIN_ICONS: Record<string, () => JSX.Element> = {
  trendline: TrendLineIcon,
  horizontal: HorizontalLineIcon,
  fibonacci: FibonacciIcon,
};

function ToolIcon({ def, locale }: { def: DrawingDefinition; locale: Locale }) {
  const Builtin = BUILTIN_ICONS[def.type];
  if (Builtin) return <Builtin />;
  if (def.icon) return <SvgIcon markup={def.icon} />;
  return <span class="fnc-tool-letter">{def.name[locale].slice(0, 1)}</span>;
}

/** Tools grouped by `DrawingDefinition.group`, in definition order. */
function toolGroups(defs: readonly DrawingDefinition[]): [string, DrawingDefinition[]][] {
  const groups = new Map<string, DrawingDefinition[]>();
  for (const def of defs) {
    const key = def.group ?? def.type;
    groups.set(key, [...(groups.get(key) ?? []), def]);
  }
  return [...groups];
}

/**
 * One drawing-bar button per tool group. It arms the group's last-used tool; groups with more
 * than one tool get a corner button that opens the list (TradingView-style).
 */
function ToolGroup({
  ctx,
  tools,
  open,
  onOpen,
  onPick,
}: {
  ctx: WidgetContext;
  tools: DrawingDefinition[];
  open: boolean;
  onOpen(open: boolean): void;
  onPick(tool: DrawingType): void;
}) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const [chosen, setChosen] = useState(tools[0]!.type);
  const armed = tools.find((d) => d.type === s.drawingTool);
  const current = armed ?? tools.find((d) => d.type === chosen) ?? tools[0]!;
  const name = current.name[s.locale];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOpen(false);
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);

  const pick = (def: DrawingDefinition) => {
    setChosen(def.type);
    onOpen(false);
    onPick(def.type);
  };

  return (
    <div class="fnc-tool-group" ref={ref} data-open={open}>
      <button class="fnc-btn" data-tip={name} aria-label={name} aria-pressed={!!armed} onClick={() => pick(current)}>
        <ToolIcon def={current} locale={s.locale} />
      </button>
      {tools.length > 1 && (
        <button class="fnc-tool-more" aria-label={`${t.moreTools}: ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => onOpen(!open)}>
          <CornerIcon />
        </button>
      )}
      {open && (
        <div class="fnc-menu fnc-tool-menu" role="menu">
          {tools.map((def, i) => {
            const section = def.section?.[s.locale];
            const heading = section && section !== tools[i - 1]?.section?.[s.locale];
            return (
              <Fragment key={def.type}>
                {heading && (
                  <div class={`fnc-tool-section${i > 0 ? ' is-after' : ''}`} role="presentation">
                    {section}
                  </div>
                )}
                <button class="fnc-menu-item" role="menuitemradio" aria-checked={def.type === current.type} onClick={() => pick(def)}>
                  <ToolIcon def={def} locale={s.locale} />
                  <span>{def.name[s.locale]}</span>
                </button>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Left vertical tool bar (TradingView layout). On narrow screens it slides in over the chart. */
export function DrawingToolbar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Every pane gets the same definitions, so the active pane's list is the widget's list.
  const groups = toolGroups(ctx.chart.drawingDefinitions());

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
        <button class="fnc-drawbar-tab" aria-label={t.expandDrawbar} data-tip={t.expandDrawbar} onClick={() => ctx.setDrawbarCollapsed(false)}>
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
      <button class="fnc-btn" data-tip={t.cursor} aria-label={t.cursor} aria-pressed={s.drawingTool === null} onClick={() => pick(null)}>
        <CursorIcon />
      </button>
      {groups.map(([key, tools]) => (
        <ToolGroup
          key={key}
          ctx={ctx}
          tools={tools}
          open={openGroup === key}
          onOpen={(open) => setOpenGroup(open ? key : null)}
          onPick={pick}
        />
      ))}
      <div class="fnc-hsep" />
      <button
        class="fnc-btn"
        data-tip={t.magnet}
        aria-label={t.magnet}
        aria-pressed={s.magnet}
        onClick={() => ctx.chart.setMagnet(!s.magnet)}
      >
        <MagnetIcon />
      </button>
      <button
        class="fnc-btn"
        data-tip={t.removeAll}
        aria-label={t.removeAll}
        disabled={s.drawingCount === 0}
        onClick={() => ctx.chart.clearDrawings()}
      >
        <TrashIcon />
      </button>
      <span class="fnc-spacer" />
      <button
        class="fnc-btn fnc-drawbar-collapse"
        data-tip={t.collapseDrawbar}
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
          data-tip={t.color}
          aria-label={`${t.color} ${color}`}
          aria-pressed={(d.color ?? SWATCHES[0]) === color}
          onClick={() => ctx.chart.updateDrawing(d.id, { color })}
        />
      ))}
      <div class="fnc-sep" />
      <button class="fnc-btn" data-tip={t.remove} aria-label={t.remove} onClick={() => ctx.chart.removeDrawing(d.id)}>
        <TrashIcon />
      </button>
    </div>
  );
}
