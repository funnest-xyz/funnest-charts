/** @jsxImportSource preact */
import { drawingLevels, drawingOption, timeZoneOffset, type CursorMode, type Drawing, type DrawingDefinition, type DrawingLevel, type DrawingStyle, type DrawingType, type Locale } from '@funnest/charts';
import { Fragment, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf, type Strings } from '../i18n.js';
import { cleanIntervals, IntervalVisibilityEditor } from './interval-visibility.js';
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  CornerIcon,
  CrossCursorIcon,
  CursorIcon,
  DemoCursorIcon,
  DotCursorIcon,
  DrawingsEyeIcon,
  EraserIcon,
  GripIcon,
  KeepDrawingIcon,
  StarIcon,
  LockIcon,
  SmallCloseIcon,
  TemplateIcon,
  LevelsIcon,
  LayersIcon,
  TextIcon,
  ClockIcon,
  SettingsIcon,
  PaletteIcon,
  FibonacciIcon,
  HorizontalLineIcon,
  MagnetIcon,
  SvgIcon,
  TrashIcon,
  TrendLineIcon,
} from '../icons.js';
import { useStore } from '../store.js';

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
  const t = stringsOf(s);
  const [chosen, setChosen] = useState(tools[0]!.type);
  const armed = tools.find((d) => d.type === s.drawingTool);
  const current = armed ?? tools.find((d) => d.type === chosen) ?? tools[0]!;
  const name = current.name[s.locale];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(false);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', esc);
    };
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
          <span class="fnc-tool-corner">
            <CornerIcon />
          </span>
          <span class="fnc-tool-chevron">
            <ChevronRightIcon />
          </span>
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
                <div class="fnc-tool-row">
                  <button class="fnc-menu-item" role="menuitemradio" aria-checked={def.type === current.type} onClick={() => pick(def)}>
                    <ToolIcon def={def} locale={s.locale} />
                    <span>{def.name[s.locale]}</span>
                  </button>
                  <button
                    class="fnc-tool-fav"
                    aria-pressed={s.favoriteTools.includes(def.type)}
                    aria-label={`${s.favoriteTools.includes(def.type) ? t.unfavoriteTool : t.favoriteTool}: ${def.name[s.locale]}`}
                    data-tip={s.favoriteTools.includes(def.type) ? t.unfavoriteTool : t.favoriteTool}
                    onClick={() => ctx.toggleFavoriteTool(def.type)}
                  >
                    <StarIcon filled={s.favoriteTools.includes(def.type)} />
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CURSORS: { mode: CursorMode; label: 'cursorCross' | 'cursorDot' | 'cursorArrow' | 'cursorDemo' | 'cursorEraser'; Icon: () => JSX.Element }[] = [
  { mode: 'cross', label: 'cursorCross', Icon: CrossCursorIcon },
  { mode: 'dot', label: 'cursorDot', Icon: DotCursorIcon },
  { mode: 'arrow', label: 'cursorArrow', Icon: CursorIcon },
  { mode: 'demo', label: 'cursorDemo', Icon: DemoCursorIcon },
  { mode: 'eraser', label: 'cursorEraser', Icon: EraserIcon },
];

/** The bar's first button: back to the pointer (no tool), and which pointer (십자, 점, 화살표, 데모, 지우개). */
function CursorGroup({ ctx, open, onOpen, onPick }: { ctx: WidgetContext; open: boolean; onOpen(open: boolean): void; onPick(): void }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const ref = useRef<HTMLDivElement>(null);
  const current = CURSORS.find((c) => c.mode === s.cursorMode) ?? CURSORS[0]!;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(false);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const name = `${t.cursor}: ${t[current.label]}`;
  return (
    <div class="fnc-tool-group" ref={ref} data-open={open}>
      <button class="fnc-btn" data-tip={name} aria-label={name} aria-pressed={s.drawingTool === null} onClick={onPick}>
        <current.Icon />
      </button>
      <button class="fnc-tool-more" aria-label={`${t.cursorModes}: ${t[current.label]}`} aria-haspopup="menu" aria-expanded={open} onClick={() => onOpen(!open)}>
        <span class="fnc-tool-corner">
          <CornerIcon />
        </span>
        <span class="fnc-tool-chevron">
          <ChevronRightIcon />
        </span>
      </button>
      {open && (
        <div class="fnc-menu fnc-tool-menu" role="menu">
          <div class="fnc-tool-section" role="presentation">
            {t.cursorModes}
          </div>
          {CURSORS.map((c) => (
            <button
              key={c.mode}
              class="fnc-menu-item"
              role="menuitemradio"
              aria-checked={c.mode === current.mode}
              onClick={() => {
                ctx.setCursorMode(c.mode);
                onOpen(false);
                onPick();
              }}
            >
              <c.Icon />
              <span>{t[c.label]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Left vertical tool bar (TradingView layout). On narrow screens it slides in over the chart. */
export function DrawingToolbar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // A short chart (a phone, a small split pane) can't fit every tool: closer buttons first, then
  // the bar scrolls (tool lists open beside it, so it only scrolls when it must).
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const fit = () => {
      el.removeAttribute('data-fit');
      if (el.scrollHeight <= el.clientHeight) return;
      el.dataset.fit = 'compact';
      if (el.scrollHeight > el.clientHeight) el.dataset.fit = 'scroll';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Every pane gets the same definitions, so the active pane's list is the widget's list.
  const defs = ctx.chart.drawingDefinitions();
  const groups = toolGroups(defs);
  const favorites = s.favoriteTools.map((type) => defs.find((d) => d.type === type)).filter((d): d is DrawingDefinition => !!d);
  const allLocked = s.drawingsLocked;
  // One change (one undo step) for every drawing of this pane.
  const lockAll = () => ctx.chart.setDrawings(ctx.chart.getDrawings().map((d) => ({ ...d, style: { ...d.style, locked: !allLocked } })));

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
      ref={barRef}
      class="fnc-drawbar"
      role="toolbar"
      aria-label={t.drawingTools}
      aria-orientation="vertical"
      data-open={s.drawbarOpen}
      data-collapsed={s.drawbarCollapsed}
    >
      <CursorGroup ctx={ctx} open={openGroup === '__cursor'} onOpen={(open) => setOpenGroup(open ? '__cursor' : null)} onPick={() => pick(null)} />
      {favorites.length > 0 && (
        <>
          {favorites.map((def) => (
            <button
              key={`fav-${def.type}`}
              class="fnc-btn fnc-fav-tool"
              data-tip={def.name[s.locale]}
              aria-label={def.name[s.locale]}
              aria-pressed={s.drawingTool === def.type}
              onClick={() => pick(s.drawingTool === def.type ? null : def.type)}
            >
              <ToolIcon def={def} locale={s.locale} />
            </button>
          ))}
          <div class="fnc-hsep" />
        </>
      )}
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
      <button class="fnc-btn" data-tip={t.keepDrawing} aria-label={t.keepDrawing} aria-pressed={s.keepDrawing} onClick={() => ctx.setKeepDrawing(!s.keepDrawing)}>
        <KeepDrawingIcon />
      </button>
      <button
        class="fnc-btn"
        data-tip={allLocked ? t.unlockAll : t.lockAll}
        aria-label={allLocked ? t.unlockAll : t.lockAll}
        aria-pressed={allLocked}
        disabled={s.drawingCount === 0}
        onClick={lockAll}
      >
        <LockIcon open={!allLocked} />
      </button>
      <button
        class="fnc-btn"
        data-tip={s.drawingsHidden ? t.showAll : t.hideAll}
        aria-label={s.drawingsHidden ? t.showAll : t.hideAll}
        aria-pressed={s.drawingsHidden}
        disabled={s.drawingCount === 0 && !s.drawingsHidden}
        onClick={() => ctx.setDrawingsHidden(!s.drawingsHidden)}
      >
        <DrawingsEyeIcon off={s.drawingsHidden} />
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
const WIDTHS = [1, 2, 3, 4];
const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32];
const DASH_ORDER: NonNullable<DrawingStyle['dash']>[] = ['solid', 'dashed', 'dotted'];
const RECENT_KEY = 'fnc-drawing-colors';
const POS_KEY = 'fnc-selbar-pos';
/**
 * 그리기 템플릿: looks saved by name, per tool (color, width, line style, part colors, font size —
 * not the text, the lock or whether it's hidden). Kept in this browser.
 */
const TEMPLATES_KEY = 'fnc-drawing-templates';
const TEMPLATES_MAX = 20;
interface DrawingTemplate {
  name: string;
  color?: string;
  style: Pick<DrawingStyle, 'width' | 'dash' | 'fontSize' | 'colors' | 'levels' | 'options'>;
}
const lookOf = (style: DrawingStyle): DrawingTemplate['style'] => {
  const { width, dash, fontSize, colors, levels, options } = style;
  return {
    ...(width ? { width } : {}),
    ...(dash ? { dash } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(colors ? { colors: { ...colors } } : {}),
    ...(levels ? { levels: levels.map((l) => ({ ...l })) } : {}),
    ...(options ? { options: { ...options } } : {}),
  };
};
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

function DashGlyph({ dash }: { dash: NonNullable<DrawingStyle['dash']> }) {
  const pattern = dash === 'dashed' ? '4 3' : dash === 'dotted' ? '1 3' : undefined;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M3 10h14" stroke-dasharray={pattern} />
    </svg>
  );
}

/**
 * Floating bar for the selected drawing: move it by its grip (remembered; double-click resets),
 * color (swatches, a custom one, recent customs), line width and style, text for text tools,
 * lock, duplicate, delete (also the only way to delete on touch).
 */
/** 좌표: each point's price and time (in the chart's time zone), typed in. */
function DrawingCoords({ ctx, drawing, t }: { ctx: WidgetContext; drawing: Drawing; t: Strings }) {
  const tz = ctx.chart.timeZone;
  const toLocal = (time: number) => new Date(time + timeZoneOffset(time, tz)).toISOString().slice(0, 16);
  const fromLocal = (text: string) => {
    const asUtc = Date.parse(`${text}:00Z`);
    if (!Number.isFinite(asUtc)) return null;
    // The offset at that moment (twice: across a DST change the first guess can be an hour off).
    const guess = asUtc - timeZoneOffset(asUtc, tz);
    return asUtc - timeZoneOffset(guess, tz);
  };
  const setPoint = (i: number, patch: { time?: number; price?: number }) =>
    ctx.chart.updateDrawing(drawing.id, { points: drawing.points.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div class="fnc-coords">
      {drawing.points.map((p, i) => (
        <div class="fnc-coord-row" key={`${drawing.id}:${i}:${p.time}:${p.price}`}>
          <span class="fnc-coord-name">{drawing.points.length > 1 ? `${t.point} ${i + 1}` : t.point}</span>
          <input
            class="fnc-input fnc-coord-price"
            type="number"
            step="any"
            defaultValue={String(p.price)}
            aria-label={`${t.point} ${i + 1} ${t.price}`}
            onChange={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(v)) setPoint(i, { price: v });
            }}
          />
          <input
            class="fnc-input fnc-coord-time"
            type="datetime-local"
            defaultValue={toLocal(p.time)}
            aria-label={`${t.point} ${i + 1} ${t.time}`}
            onChange={(e) => {
              const time = fromLocal((e.target as HTMLInputElement).value);
              if (time !== null) setPoint(i, { time });
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function SelectionBar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const d = s.selection;
  const [offset, setOffset] = useState<[number, number]>(() => readJson(POS_KEY, [0, 0]));
  const [recent, setRecent] = useState<string[]>(() => readJson(RECENT_KEY, []));
  const [menu, setMenu] = useState<null | 'width' | 'colors' | 'font' | 'template' | 'levels' | 'options' | 'order' | 'coords' | 'visibility' | 'note'>(null);
  const [templates, setTemplates] = useState<Record<string, DrawingTemplate[]>>(() => readJson(TEMPLATES_KEY, {}));
  const [naming, setNaming] = useState<string | null>(null);
  const colorInput = useRef<HTMLInputElement>(null);
  if (!d || s.layout.plotWidth <= 0) return null;

  const def = ctx.chart.drawingDefinitions().find((x) => x.type === d.type);
  const style = d.style ?? {};
  const setStyle = (patch: Partial<DrawingStyle>) => ctx.chart.updateDrawing(d.id, { style: { ...style, ...patch } });
  const setStyleRaw = (next: DrawingStyle) => ctx.chart.updateDrawing(d.id, { style: next });
  const current = d.color ?? SWATCHES[0]!;
  // A main color recolors every part too (their own colors are dropped).
  const pickColor = (color: string) => {
    if (style.colors || style.levels?.some((l) => l.color)) {
      const { colors: _drop, ...rest } = style;
      const levels = rest.levels?.map(({ color: _c, ...l }) => l);
      ctx.chart.updateDrawing(d.id, { color, style: { ...rest, ...(levels ? { levels } : {}) } });
    } else ctx.chart.updateDrawing(d.id, { color });
  };
  // Tools with editable levels color them in 레벨 설정 instead.
  const slots = def?.levels ? [] : (def?.colors ?? []);
  // 레벨 설정: every level as it stands (colors resolved), edited as a whole list.
  const levelRows: DrawingLevel[] = def?.levels ? drawingLevels(def, d) : [];
  const setLevels = (next: DrawingLevel[]) => {
    const { colors: _drop, ...rest } = style;
    setStyleRaw({ ...rest, levels: next });
  };
  const resetLevels = () => {
    const { colors: _c, levels: _l, ...rest } = style;
    setStyleRaw(rest);
  };
  const slotColor = (key: string, fallback: string) => style.colors?.[key] ?? d.color ?? fallback;
  const addRecent = (color: string) => {
    const next = [color, ...recent.filter((c) => c !== color)].slice(0, 3);
    setRecent(next);
    writeJson(RECENT_KEY, next);
  };
  const locked = !!style.locked;
  const dash = style.dash ?? 'solid';
  const mine = templates[d.type] ?? [];
  const keepTemplates = (next: DrawingTemplate[]) => {
    const all = { ...templates, [d.type]: next };
    if (!next.length) delete all[d.type];
    setTemplates(all);
    writeJson(TEMPLATES_KEY, all);
  };
  const saveTemplate = () => {
    const name = (naming ?? '').trim().slice(0, 30);
    if (!name) return setNaming(null);
    // The same name again replaces it.
    keepTemplates([{ name, ...(d.color ? { color: d.color } : {}), style: lookOf(style) }, ...mine.filter((x) => x.name !== name)].slice(0, TEMPLATES_MAX));
    setNaming(null);
    setMenu(null);
  };
  const applyTemplate = (tpl: DrawingTemplate) => {
    // The look only: what it says, its lock and visibility stay.
    const { text, locked: lock, hidden } = style;
    ctx.chart.updateDrawing(d.id, {
      ...(tpl.color ? { color: tpl.color } : {}),
      style: { ...tpl.style, ...(text !== undefined ? { text } : {}), ...(lock ? { locked: lock } : {}), ...(hidden ? { hidden } : {}) },
    });
    setMenu(null);
  };
  // The app's own buttons for this drawing (알림 on a line…).
  const actions = ctx.drawingActions?.(d, ctx.chart) ?? [];

  const startMove = (e: PointerEvent) => {
    e.preventDefault();
    const start = [e.clientX, e.clientY];
    const from = offset;
    const move = (ev: PointerEvent) => setOffset([from[0] + ev.clientX - start[0]!, from[1] + ev.clientY - start[1]!]);
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const next: [number, number] = [from[0] + ev.clientX - start[0]!, from[1] + ev.clientY - start[1]!];
      setOffset(next);
      writeJson(POS_KEY, next);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <div class="fnc-selbar" role="toolbar" style={{ left: `${s.layout.plotWidth / 2 + offset[0]}px`, top: `${8 + offset[1]}px` }}>
      <button
        class="fnc-btn fnc-selbar-grip"
        data-tip={t.moveBar}
        aria-label={t.moveBar}
        onPointerDown={startMove}
        onDblClick={() => {
          setOffset([0, 0]);
          writeJson(POS_KEY, [0, 0]);
        }}
      >
        <GripIcon />
      </button>
      {/* Tools with levels (피보나치…) are colored level by level in 레벨 설정: no one color for all of them. */}
      {!def?.levels &&
        [...SWATCHES, ...recent.filter((c) => !SWATCHES.includes(c))].map((color) => (
          <button class="fnc-swatch" style={{ background: color }} data-tip={t.color} aria-label={`${t.color} ${color}`} aria-pressed={current === color} onClick={() => pickColor(color)} />
        ))}
      {!def?.levels && (
      <label class="fnc-swatch fnc-swatch-add" data-tip={t.customColor} aria-label={t.customColor}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          ref={colorInput}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#3182f6'}
          onInput={(e) => pickColor((e.target as HTMLInputElement).value)}
          onChange={(e) => addRecent((e.target as HTMLInputElement).value)}
        />
      </label>
      )}
      {slots.length > 0 && (
        <div class="fnc-selbar-menu">
          <button class="fnc-btn" data-tip={t.partColors} aria-label={t.partColors} aria-expanded={menu === 'colors'} onClick={() => setMenu(menu === 'colors' ? null : 'colors')}>
            <PaletteIcon />
          </button>
          {menu === 'colors' && (
            <div class="fnc-menu fnc-selbar-pop fnc-part-menu" role="menu">
              {slots.map((slot) => {
                const c = slotColor(slot.key, slot.color);
                return (
                  <label class="fnc-menu-item fnc-part">
                    <span class="fnc-swatch" style={{ background: c }} />
                    <span>{slot.name[s.locale]}</span>
                    <input
                      type="color"
                      aria-label={`${slot.name[s.locale]} ${t.color}`}
                      value={/^#[0-9a-f]{6}$/i.test(c) ? c : '#3182f6'}
                      onInput={(e) => setStyle({ colors: { ...style.colors, [slot.key]: (e.target as HTMLInputElement).value } })}
                    />
                  </label>
                );
              })}
              <button
                class="fnc-menu-item fnc-part-reset"
                role="menuitem"
                onClick={() => {
                  const { colors: _drop, ...rest } = style;
                  ctx.chart.updateDrawing(d.id, { style: rest });
                  setMenu(null);
                }}
              >
                {t.resetColors}
              </button>
            </div>
          )}
        </div>
      )}
      {def?.options && def.options.length > 0 && (
        <div class="fnc-selbar-menu">
          <button class="fnc-btn" data-tip={t.drawingOptions} aria-label={t.drawingOptions} aria-expanded={menu === 'options'} onClick={() => setMenu(menu === 'options' ? null : 'options')}>
            <SettingsIcon />
          </button>
          {menu === 'options' && (
            <div class="fnc-menu fnc-selbar-pop fnc-options-menu" role="menu" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
              {def.options.map((o) => {
                const value = drawingOption(def, d, o.key);
                const set = (v: number | boolean | string) => setStyle({ options: { ...style.options, [o.key]: v } });
                if (o.kind === 'toggle')
                  return (
                    <label class="fnc-menu-item fnc-option-row">
                      <input type="checkbox" checked={value === true} onChange={(e) => set((e.target as HTMLInputElement).checked)} />
                      <span>{o.label[s.locale]}</span>
                    </label>
                  );
                if (o.kind === 'choice')
                  return (
                    <label class="fnc-option-row fnc-option-field">
                      <span>{o.label[s.locale]}</span>
                      <select class="fnc-select" value={String(value)} onChange={(e) => set((e.target as HTMLSelectElement).value)}>
                        {o.choices?.map((c) => (
                          <option value={c.value}>{c.label[s.locale]}</option>
                        ))}
                      </select>
                    </label>
                  );
                return (
                  <label class="fnc-option-row fnc-option-field" key={`${o.key}:${String(value)}`}>
                    <span>{o.label[s.locale]}</span>
                    <input
                      class="fnc-input fnc-option-number"
                      type="number"
                      step={o.step ?? 'any'}
                      min={o.min}
                      max={o.max}
                      defaultValue={String(value)}
                      onChange={(e) => {
                        const v = Number((e.target as HTMLInputElement).value);
                        if (Number.isFinite(v)) set(v);
                      }}
                    />
                    {o.unit && <span class="fnc-option-unit">{o.unit}</span>}
                  </label>
                );
              })}
              <div class="fnc-menu-sep" />
              <button
                class="fnc-menu-item"
                role="menuitem"
                onClick={() => {
                  const { options: _drop, ...rest } = style;
                  setStyleRaw(rest);
                }}
              >
                {t.resetOptions}
              </button>
            </div>
          )}
        </div>
      )}
      {def?.levels && (
        <div class="fnc-selbar-menu">
          <button class="fnc-btn" data-tip={t.levels} aria-label={t.levels} aria-expanded={menu === 'levels'} onClick={() => setMenu(menu === 'levels' ? null : 'levels')}>
            <LevelsIcon />
          </button>
          {menu === 'levels' && (
            <div class="fnc-menu fnc-selbar-pop fnc-levels-menu" role="menu" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
              <div class="fnc-levels-list fnc-scroll">
                {levelRows.map((l, i) => (
                  <div class="fnc-level-row" key={`${i}:${l.value}`}>
                    <input
                      type="checkbox"
                      checked={l.on !== false}
                      aria-label={`${t.levelShown} ${l.value}`}
                      onChange={(e) => setLevels(levelRows.map((x, j) => (j === i ? { ...x, on: (e.target as HTMLInputElement).checked } : x)))}
                    />
                    <input
                      class="fnc-input fnc-level-value"
                      type="number"
                      step="any"
                      defaultValue={String(l.value)}
                      aria-label={t.levelValue}
                      onChange={(e) => {
                        const v = Number((e.target as HTMLInputElement).value);
                        if (Number.isFinite(v) && Math.abs(v) <= 1000) setLevels(levelRows.map((x, j) => (j === i ? { ...x, value: v } : x)));
                      }}
                    />
                    <label class="fnc-swatch fnc-level-color" style={{ background: l.color }} data-tip={t.levelColor}>
                      <input
                        type="color"
                        aria-label={`${t.levelColor} ${l.value}`}
                        value={/^#[0-9a-f]{6}$/i.test(l.color ?? '') ? l.color : '#3182f6'}
                        onInput={(e) => setLevels(levelRows.map((x, j) => (j === i ? { ...x, color: (e.target as HTMLInputElement).value } : x)))}
                      />
                    </label>
                    <input
                      class="fnc-input fnc-level-text"
                      type="text"
                      maxLength={40}
                      defaultValue={l.text ?? ''}
                      placeholder={t.levelText}
                      aria-label={`${l.value} ${t.levelText}`}
                      onChange={(e) => setLevels(levelRows.map((x, j) => (j === i ? { ...x, text: (e.target as HTMLInputElement).value.trim() } : x)))}
                    />
                    <button class="fnc-ind-btn" data-tip={t.removeLevel} aria-label={`${l.value} ${t.removeLevel}`} onClick={() => setLevels(levelRows.filter((_, j) => j !== i))}>
                      <SmallCloseIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div class="fnc-menu-sep" />
              <button
                class="fnc-menu-item"
                role="menuitem"
                onClick={() => {
                  // The next one up: past the largest by the last gap (or 1).
                  const values = levelRows.map((x) => x.value);
                  const top = values.length ? Math.max(...values) : 0;
                  const gap = values.length > 1 ? Math.abs(values[values.length - 1]! - values[values.length - 2]!) || 1 : 1;
                  setLevels([...levelRows, { value: Number((top + gap).toFixed(4)), on: true, color: current }]);
                }}
              >
                + {t.addLevel}
              </button>
              <button class="fnc-menu-item" role="menuitem" onClick={resetLevels}>
                {t.resetLevels}
              </button>
            </div>
          )}
        </div>
      )}
      <div class="fnc-sep" />
      <div class="fnc-selbar-menu">
        <button class="fnc-btn fnc-selbar-width" data-tip={t.lineWidth} aria-label={t.lineWidth} aria-expanded={menu === 'width'} onClick={() => setMenu(menu === 'width' ? null : 'width')}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 10h14" stroke="currentColor" stroke-width={style.width ?? 2} stroke-linecap="round" />
          </svg>
        </button>
        {menu === 'width' && (
          <div class="fnc-menu fnc-selbar-pop" role="menu">
            {WIDTHS.map((w) => (
              <button
                class="fnc-menu-item"
                role="menuitemradio"
                aria-checked={(style.width ?? 2) === w}
                onClick={() => {
                  setStyle({ width: w });
                  setMenu(null);
                }}
              >
                <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true">
                  <path d="M2 6h36" stroke="currentColor" stroke-width={w} stroke-linecap="round" />
                </svg>
                <span>{w}px</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        class="fnc-btn"
        data-tip={`${t.lineStyle}: ${dash === 'solid' ? t.lineSolid : dash === 'dashed' ? t.lineDashed : t.lineDotted}`}
        aria-label={t.lineStyle}
        onClick={() => setStyle({ dash: DASH_ORDER[(DASH_ORDER.indexOf(dash) + 1) % DASH_ORDER.length]! })}
      >
        <DashGlyph dash={dash} />
      </button>
      {def?.text && (
        <input
          class="fnc-selbar-text"
          value={style.text ?? ''}
          placeholder={t.textPlaceholder}
          aria-label={t.drawingText}
          maxLength={200}
          onInput={(e) => setStyle({ text: (e.target as HTMLInputElement).value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
      )}
      {def?.text && (
        <div class="fnc-selbar-menu">
          <button class="fnc-btn fnc-selbar-font" data-tip={t.fontSize} aria-label={t.fontSize} aria-expanded={menu === 'font'} onClick={() => setMenu(menu === 'font' ? null : 'font')}>
            {style.fontSize ?? 14}
          </button>
          {menu === 'font' && (
            <div class="fnc-menu fnc-selbar-pop" role="menu">
              {FONT_SIZES.map((size) => (
                <button
                  class="fnc-menu-item"
                  role="menuitemradio"
                  aria-checked={(style.fontSize ?? 14) === size}
                  onClick={() => {
                    setStyle({ fontSize: size });
                    setMenu(null);
                  }}
                >
                  <span>{size}px</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div class="fnc-selbar-menu">
        <button
          class="fnc-btn"
          data-tip={t.templates}
          aria-label={t.templates}
          aria-expanded={menu === 'template'}
          onClick={() => {
            setNaming(null);
            setMenu(menu === 'template' ? null : 'template');
          }}
        >
          <TemplateIcon />
        </button>
        {menu === 'template' && (
          <div class="fnc-menu fnc-selbar-pop fnc-template-menu" role="menu">
            {mine.length === 0 && <div class="fnc-menu-note">{t.noTemplates}</div>}
            {mine.map((tpl) => (
              <div class="fnc-template-row">
                <button class="fnc-menu-item" role="menuitem" onClick={() => applyTemplate(tpl)}>
                  <span class="fnc-swatch" style={{ background: tpl.color ?? current }} />
                  <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
                    <path
                      d="M2 6h24"
                      stroke={tpl.color ?? current}
                      stroke-width={tpl.style.width ?? 2}
                      stroke-linecap="round"
                      stroke-dasharray={tpl.style.dash === 'dashed' ? '4 3' : tpl.style.dash === 'dotted' ? '1 3' : undefined}
                    />
                  </svg>
                  <span>{tpl.name}</span>
                </button>
                <button
                  class="fnc-ind-btn"
                  data-tip={t.deleteTemplate}
                  aria-label={`${tpl.name} ${t.deleteTemplate}`}
                  onClick={() => keepTemplates(mine.filter((x) => x !== tpl))}
                >
                  <SmallCloseIcon />
                </button>
              </div>
            ))}
            <div class="fnc-menu-sep" />
            {naming === null ? (
              <button class="fnc-menu-item" role="menuitem" onClick={() => setNaming('')}>
                {t.saveTemplate}
              </button>
            ) : (
              <input
                class="fnc-selbar-text fnc-template-name"
                value={naming}
                placeholder={t.templateName}
                aria-label={t.templateName}
                maxLength={30}
                autoFocus
                onInput={(e) => setNaming((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') saveTemplate();
                  if (e.key === 'Escape') setNaming(null);
                }}
              />
            )}
          </div>
        )}
      </div>
      {actions.length > 0 && <div class="fnc-sep" />}
      {actions.map((a) => (
        <button
          class={`fnc-btn fnc-selbar-action${a.icon ? '' : ' is-text'}${a.pressed ? ' is-on' : ''}`}
          data-tip={a.label}
          aria-label={a.label}
          aria-pressed={a.pressed}
          onClick={() => {
            a.onSelect();
            // Done with it: the bar closes (and shows the new state when the drawing is picked again).
            ctx.chart.selectDrawing(null);
          }}
        >
          {a.icon === 'alert' ? <BellIcon /> : a.label}
        </button>
      ))}
      <div class="fnc-sep" />
      <div class="fnc-selbar-menu">
        <button class="fnc-btn" data-tip={t.drawingOrder} aria-label={t.drawingOrder} aria-expanded={menu === 'order'} onClick={() => setMenu(menu === 'order' ? null : 'order')}>
          <LayersIcon />
        </button>
        {menu === 'order' && (
          <div class="fnc-menu fnc-selbar-pop" role="menu">
            {(
              [
                ['front', t.bringToFront],
                ['forward', t.bringForward],
                ['backward', t.sendBackward],
                ['back', t.sendToBack],
              ] as const
            ).map(([where, label]) => (
              <button class="fnc-menu-item" role="menuitem" disabled={!ctx.chart.canMoveDrawing(d.id, where)} onClick={() => ctx.chart.moveDrawing(d.id, where)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {def && !def.text && (
        <div class="fnc-selbar-menu">
          <button
            class={style.text ? 'fnc-btn fnc-btn-on' : 'fnc-btn'}
            data-tip={t.note}
            aria-label={t.note}
            aria-expanded={menu === 'note'}
            onClick={() => setMenu(menu === 'note' ? null : 'note')}
          >
            <TextIcon />
          </button>
          {menu === 'note' && (
            <div class="fnc-menu fnc-selbar-pop fnc-note-menu" role="menu" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
              <textarea
                key={d.id}
                defaultValue={style.text ?? ''}
                placeholder={t.noteText}
                aria-label={t.noteText}
                onInput={(e) => {
                  const text = (e.target as HTMLTextAreaElement).value;
                  const { text: _drop, ...rest } = style;
                  setStyleRaw(text.trim() ? { ...rest, text } : rest);
                }}
              />
              <div class="fnc-note-row">
                <input
                  type="color"
                  class="fnc-color"
                  aria-label={t.textColor}
                  value={/^#[0-9a-f]{6}$/i.test(style.textColor ?? d.color ?? '') ? (style.textColor ?? d.color)! : '#3182f6'}
                  onInput={(e) => setStyle({ textColor: (e.target as HTMLInputElement).value })}
                />
                <select class="fnc-select" aria-label={t.fontSize} value={String(style.fontSize ?? 14)} onChange={(e) => setStyle({ fontSize: Number((e.target as HTMLSelectElement).value) })}>
                  {[10, 11, 12, 14, 16, 20, 24, 28, 32, 40].map((n) => (
                    <option value={String(n)}>{n}px</option>
                  ))}
                </select>
                <button type="button" class="fnc-note-toggle" aria-pressed={!!style.bold} aria-label={t.bold} onClick={() => setStyle({ bold: !style.bold })}>
                  <b>B</b>
                </button>
                <button type="button" class="fnc-note-toggle" aria-pressed={!!style.italic} aria-label={t.italic} onClick={() => setStyle({ italic: !style.italic })}>
                  <i>I</i>
                </button>
              </div>
              <div class="fnc-note-row">
                <span>{t.noteH}</span>
                <select class="fnc-select" aria-label={t.noteH} value={style.textH ?? 'center'} onChange={(e) => setStyle({ textH: (e.target as HTMLSelectElement).value as 'left' | 'center' | 'right' })}>
                  <option value="left">{t.alignLeft}</option>
                  <option value="center">{t.alignCenter}</option>
                  <option value="right">{t.alignRight}</option>
                </select>
                <span>{t.noteV}</span>
                <select
                  class="fnc-select"
                  aria-label={t.noteV}
                  value={style.textV ?? (def.note === 'line' ? 'top' : 'middle')}
                  onChange={(e) => setStyle({ textV: (e.target as HTMLSelectElement).value as 'top' | 'middle' | 'bottom' })}
                >
                  <option value="top">{t.alignTop}</option>
                  <option value="middle">{t.alignMiddle}</option>
                  <option value="bottom">{t.alignBottom}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
      <div class="fnc-selbar-menu">
        <button class="fnc-btn" data-tip={t.coordinates} aria-label={t.coordinates} aria-expanded={menu === 'coords'} onClick={() => setMenu(menu === 'coords' ? null : 'coords')}>
          <CrossCursorIcon />
        </button>
        {menu === 'coords' && (
          <div class="fnc-menu fnc-selbar-pop fnc-coords-menu" role="menu" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
            <DrawingCoords ctx={ctx} drawing={d} t={t} />
          </div>
        )}
      </div>
      <div class="fnc-selbar-menu">
        <button
          class={style.intervals ? 'fnc-btn fnc-btn-on' : 'fnc-btn'}
          data-tip={t.tabVisibility}
          aria-label={t.tabVisibility}
          aria-expanded={menu === 'visibility'}
          onClick={() => setMenu(menu === 'visibility' ? null : 'visibility')}
        >
          <ClockIcon />
        </button>
        {menu === 'visibility' && (
          <div class="fnc-menu fnc-selbar-pop fnc-visibility-menu" role="menu" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
            <p class="fnc-hint">{t.visibilityHint}</p>
            <IntervalVisibilityEditor
              t={t}
              value={style.intervals}
              onChange={(v) => {
                const intervals = cleanIntervals(v);
                const { intervals: _drop, ...rest } = style;
                setStyleRaw(intervals ? { ...rest, intervals } : rest);
              }}
            />
          </div>
        )}
      </div>
      <button class="fnc-btn" data-tip={locked ? t.unlock : t.lock} aria-label={locked ? t.unlock : t.lock} aria-pressed={locked} onClick={() => setStyle({ locked: !locked })}>
        <LockIcon open={!locked} />
      </button>
      <button
        class="fnc-btn"
        data-tip={t.duplicate}
        aria-label={t.duplicate}
        onClick={() => {
          const id = ctx.chart.addDrawing({ type: d.type, points: d.points.map((p) => ({ ...p })), ...(d.color ? { color: d.color } : {}), style: { ...style, locked: false } });
          ctx.chart.selectDrawing(id);
        }}
      >
        <CopyIcon />
      </button>
      <button class="fnc-btn" data-tip={t.remove} aria-label={t.remove} onClick={() => ctx.chart.removeDrawing(d.id)}>
        <TrashIcon />
      </button>
    </div>
  );
}
