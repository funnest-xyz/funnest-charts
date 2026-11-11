/** @jsxImportSource preact */
import { parseChartState, type Chart, type ChartState, type Locale, type Resolution, type ThemeTokens } from '@funnest/charts';
import { render } from 'preact';
import { DrawingToolbar } from './components/drawing-toolbar';
import { Toolbar } from './components/toolbar';
import type { LayoutSync, MultiControls, MultiState } from './context';
import { resolutionLabel, STRINGS } from './i18n';
import { isLayoutId, LAYOUTS, MAX_PANES, paneCount, resizePair, sizesFor, type LayoutId, type SplitNode, type SplitSizes } from './layouts';
import { createPane, type Pane } from './pane';
import { bindWidgetKeys, createShell, div, type ColorScheme, type TradingChartSlots } from './shell';
import { Store, useStore } from './store';
import {
  DEFAULT_FAVORITE_INTERVALS,
  DEFAULT_INTERVAL_GROUPS,
  DEFAULT_SEARCH_CATEGORIES,
  defaultDisplayTimezone,
  type TradingChartOptions,
} from './trading-chart';

export interface PaneSpec {
  symbol: string;
  /** Default: the widget's `resolution`, else '1D'. */
  resolution?: Resolution;
}

export interface MultiChartOptions extends Omit<TradingChartOptions, 'symbol'> {
  /**
   * Initial panes, in layout order (up to 8). Panes the layout needs beyond this list open
   * the active pane's symbol.
   */
  panes: readonly PaneSpec[];
  /** Initial split. Default '1'. */
  layout?: LayoutId;
  /** Default: crosshair on, everything else off. */
  sync?: Partial<LayoutSync>;
  /** Below this container width only the active pane shows, with tabs to switch. Default 640. */
  narrowWidth?: number;
}

/** Everything `load()` needs to rebuild the widget: split, sync, sizes and every pane's chart. */
export interface MultiChartState {
  version: 1;
  layout: LayoutId;
  sync: LayoutSync;
  active: number;
  sizes: SplitSizes;
  panes: ChartState[];
}

export interface MultiChartEvents {
  /** The pane the toolbar acts on changed. */
  activeChange: { index: number; chart: Chart };
  /** Split layout or pane count changed. */
  layoutChange: { layout: LayoutId; panes: number };
  /** Something worth persisting changed in any pane or in the layout — a hook for autosave. */
  stateChange: void;
}

export interface MultiChart {
  readonly slots: TradingChartSlots;
  /** Engines of the visible panes, in layout order. */
  readonly charts: readonly Chart[];
  /** The pane the toolbar, drawing bar and `setSymbol` act on. */
  readonly activeChart: Chart;
  readonly activeIndex: number;
  readonly layout: LayoutId;
  readonly sync: LayoutSync;
  setLayout(layout: LayoutId): void;
  setSync(patch: Partial<LayoutSync>): void;
  activate(index: number): void;
  /** Fill the grid with one pane (default: the active one); call again to go back. */
  toggleMaximize(index?: number): void;
  /** Opens a symbol in the active pane (and every pane, with symbol sync on). */
  setSymbol(symbol: string, resolution?: Resolution): Promise<void>;
  setResolution(resolution: Resolution): Promise<void>;
  setLocale(locale: Locale): void;
  setTheme(theme: Partial<ThemeTokens>): void;
  setColorScheme(scheme: ColorScheme): void;
  save(): MultiChartState;
  load(state: MultiChartState | unknown): Promise<void>;
  on<K extends keyof MultiChartEvents>(event: K, listener: (payload: MultiChartEvents[K]) => void): () => void;
  destroy(): void;
}

const DEFAULT_SYNC: LayoutSync = { crosshair: true, time: false, symbol: false, interval: false };

function PaneTab({ pane, index, active, onSelect }: { pane: Pane; index: number; active: boolean; onSelect(): void }) {
  const s = useStore(pane.store);
  const t = STRINGS[s.locale];
  return (
    <button class="fnc-pane-tab" role="tab" aria-selected={active} onClick={onSelect}>
      <span class="fnc-pane-tab-num">{index + 1}</span>
      {s.symbol?.name ?? `${t.pane} ${index + 1}`}
      <small>{resolutionLabel(s.resolution, s.locale)}</small>
    </button>
  );
}

function PaneTabs({ multi, panes }: { multi: MultiControls; panes: () => Pane[] }) {
  const m = useStore(multi.store);
  const visible = panes().slice(0, paneCount(LAYOUTS[m.layout]));
  if (!m.narrow || visible.length < 2) return null;
  return (
    <div class="fnc-pane-tabs" role="tablist">
      {visible.map((p, i) => (
        <PaneTab pane={p} index={i} active={i === m.active} onSelect={() => multi.activate(i)} />
      ))}
    </div>
  );
}

/**
 * Several linked charts in one split layout (1–8 panes) sharing one toolbar and drawing bar
 * that act on the active pane. Clicking a pane activates it; Alt+1…8 too, Alt+Enter maximizes.
 * Crosshair, time range, symbol and interval can be synced across panes.
 */
export function createMultiChart(container: HTMLElement, options: MultiChartOptions): MultiChart {
  const {
    datafeed,
    panes: paneSpecs,
    layout: initialLayout = '1',
    sync: initialSync,
    narrowWidth = 640,
    resolution = '1D',
    intervalGroups = DEFAULT_INTERVAL_GROUPS,
    favoriteIntervals,
    onFavoriteIntervalsChange,
    searchCategories = DEFAULT_SEARCH_CATEGORIES,
    storageKey = 'funnest-charts',
    searchHotkey = true,
    symbolLogo = true,
    drawingToolbar = true,
    chartType = 'candles',
    attribution = true,
    colorScheme = 'system',
    contextMenuItems,
    theme,
    ...chartOptions
  } = options;
  if (paneSpecs.length === 0) throw new Error('funnest-charts: createMultiChart needs at least one pane');
  const displayTimezone = defaultDisplayTimezone(chartOptions.locale ?? 'ko', chartOptions.displayTimezone);

  const shell = createShell(container, {
    colorScheme,
    theme,
    storageKey,
    drawingToolbar,
    favoriteIntervals: favoriteIntervals ?? DEFAULT_FAVORITE_INTERVALS,
    onFavoriteIntervalsChange,
  });
  shell.root.classList.add('fnc-multi');
  const tabsHost = div('fnc-pane-tabs-host');
  shell.root.insertBefore(tabsHost, shell.body);
  const grid = div('fnc-grid');
  shell.main.insertBefore(grid, shell.slots.bottom);
  const parking = div('fnc-parking', shell.root); // hidden panes stay alive here

  const listeners = new Map<keyof MultiChartEvents, Set<(payload: never) => void>>();
  const emit = <K extends keyof MultiChartEvents>(event: K, payload: MultiChartEvents[K]) => {
    for (const l of listeners.get(event) ?? []) (l as (p: MultiChartEvents[K]) => void)(payload);
  };
  let stateQueued = false;
  const queueState = () => {
    if (stateQueued) return;
    stateQueued = true;
    queueMicrotask(() => {
      stateQueued = false;
      emit('stateChange', undefined);
    });
  };

  const store = new Store<MultiState>({
    layout: isLayoutId(initialLayout) ? initialLayout : '1',
    sync: { ...DEFAULT_SYNC, ...initialSync },
    active: 0,
    maximized: null,
    narrow: false,
  });
  let sizes: SplitSizes = {};
  const panes: Pane[] = [];
  const cells: HTMLElement[] = [];
  /** Pane the user last touched: only its scroll/zoom is broadcast (avoids feedback loops). */
  let driver = -1;
  const visibleCount = () => Math.min(paneCount(LAYOUTS[store.get().layout]), MAX_PANES);
  const visible = () => panes.slice(0, visibleCount());

  const controls: MultiControls = {
    store,
    setLayout: (layout) => setLayout(layout),
    setSync: (patch) => setSync(patch),
    activate: (index) => activate(index),
    toggleMaximize: (index) => toggleMaximize(index),
  };

  // ── Panes ──────────────────────────────────────────────────────────

  function makePane(index: number, spec: PaneSpec): Pane {
    const pane = createPane(shell, {
      datafeed,
      chartOptions,
      displayTimezone,
      resolution: spec.resolution ?? resolution,
      chartType,
      intervalGroups,
      searchCategories,
      symbolLogo,
      searchHotkey,
      drawingToolbar,
      // One badge for the whole widget, not one per pane.
      attribution: attribution && index === 0,
      contextMenuItems,
      multi: controls,
    });
    const cell = div('fnc-pane');
    cell.appendChild(pane.stage);
    const touch = () => {
      driver = panes.indexOf(pane);
      if (driver >= 0 && driver !== store.get().active) activate(driver);
    };
    cell.addEventListener('pointerdown', touch, true);
    cell.addEventListener('wheel', () => (driver = panes.indexOf(pane)), { capture: true, passive: true });

    const c = pane.chart;
    c.on('crosshairMove', (info) => {
      if (!store.get().sync.crosshair || info?.source === 'sync') return;
      for (const other of visible()) if (other !== pane) other.chart.setSyncedCrosshair(info ? info.time : null);
    });
    c.on('visibleRangeChange', () => {
      if (!store.get().sync.time || panes[driver] !== pane) return;
      broadcastTime(pane);
    });
    c.on('symbolChange', (info) => {
      queueState();
      if (panes[store.get().active] !== pane) return;
      const res = c.currentResolution;
      const { sync } = store.get();
      if (!sync.symbol && !sync.interval) return;
      for (const other of visible()) {
        if (other === pane) continue;
        const sym = sync.symbol ? info.symbol : other.chart.symbolInfo?.symbol;
        const r = sync.interval && res ? res : (other.chart.currentResolution ?? other.store.get().resolution);
        if (sym && (sym !== other.chart.symbolInfo?.symbol || r !== other.chart.currentResolution)) void other.load(sym, r);
      }
    });
    c.on('stateChange', queueState);

    panes[index] = pane;
    cells[index] = cell;
    void pane.load(spec.symbol, spec.resolution ?? resolution);
    return pane;
  }

  function broadcastTime(from: Pane) {
    const range = from.chart.getVisibleTimeRange();
    if (!range) return;
    const res = from.chart.currentResolution;
    for (const other of visible()) {
      // Bars of other intervals don't line up index-for-index; only same-interval panes follow.
      if (other !== from && other.chart.currentResolution === res) other.chart.setVisibleTimeRange(range);
    }
  }

  /** Creates panes up to `count`, new ones copying the active pane's symbol and interval. */
  function ensurePanes(count: number) {
    for (let i = panes.length; i < count; i++) {
      const src = panes[store.get().active] ?? panes[0];
      const spec = paneSpecs[i] ?? {
        symbol: src?.chart.symbolInfo?.symbol ?? paneSpecs[0]!.symbol,
        resolution: src?.chart.currentResolution ?? src?.store.get().resolution ?? resolution,
      };
      makePane(i, spec);
    }
  }

  // ── Layout rendering ───────────────────────────────────────────────

  function buildNode(node: SplitNode, path: string, layout: LayoutId): HTMLElement {
    if (typeof node === 'number') return cells[node]!;
    const box = div(`fnc-split fnc-split-${node.dir}`);
    const key = `${layout}:${path}`;
    const weights = sizesFor(sizes, key, node.children.length);
    const children = node.children.map((child, i) => {
      const el = buildNode(child, path ? `${path}.${i}` : String(i), layout);
      el.style.flex = `${weights[i]} 1 0px`;
      return el;
    });
    children.forEach((el, i) => {
      box.appendChild(el);
      if (i < children.length - 1) box.appendChild(makeSplitter(box, node.dir, key, i, children));
    });
    return box;
  }

  function makeSplitter(box: HTMLElement, dir: 'row' | 'col', key: string, i: number, children: HTMLElement[]) {
    const bar = div(`fnc-splitter fnc-splitter-${dir}`);
    bar.setAttribute('role', 'separator');
    bar.setAttribute('aria-orientation', dir === 'row' ? 'vertical' : 'horizontal');
    let last: number | null = null;
    const apply = (next: number[]) => {
      sizes = { ...sizes, [key]: next };
      next.forEach((w, j) => (children[j]!.style.flex = `${w} 1 0px`));
      queueState();
    };
    bar.addEventListener('pointerdown', (e) => {
      bar.setPointerCapture(e.pointerId);
      last = dir === 'row' ? e.clientX : e.clientY;
      shell.root.classList.add(dir === 'row' ? 'fnc-resizing-x' : 'fnc-resizing-y');
    });
    bar.addEventListener('pointermove', (e) => {
      if (last === null) return;
      const pos = dir === 'row' ? e.clientX : e.clientY;
      const length = dir === 'row' ? box.clientWidth : box.clientHeight;
      if (length <= 0) return;
      apply(resizePair(sizesFor(sizes, key, children.length), i, (pos - last) / length));
      last = pos;
    });
    const end = () => {
      last = null;
      shell.root.classList.remove('fnc-resizing-x', 'fnc-resizing-y');
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('dblclick', () => apply(Array<number>(children.length).fill(1)));
    return bar;
  }

  function renderGrid() {
    const s = store.get();
    const count = visibleCount();
    for (let i = 0; i < panes.length; i++) {
      if (i >= count) parking.appendChild(cells[i]!);
      cells[i]!.classList.toggle('fnc-pane-active', i === s.active && count > 1);
    }
    const single = s.maximized ?? (s.narrow ? s.active : null);
    const top = single !== null && single < count ? cells[single]! : buildNode(LAYOUTS[s.layout], '', s.layout);
    top.style.flex = '1 1 0px';
    grid.replaceChildren(top);
    shell.root.classList.toggle('fnc-split-on', count > 1 && single === null);
  }

  // ── Toolbar binding ────────────────────────────────────────────────

  function bindToolbar() {
    const pane = panes[store.get().active]!;
    // Keyed by pane: the toolbar and drawing bar remount on the new pane's state.
    render(<Toolbar key={store.get().active} ctx={pane.ctx} />, shell.toolbarHost);
    if (shell.drawbarHost) render(<DrawingToolbar key={store.get().active} ctx={pane.ctx} />, shell.drawbarHost);
  }

  // ── Actions ────────────────────────────────────────────────────────

  function activate(index: number) {
    const s = store.get();
    if (index < 0 || index >= visibleCount() || index === s.active) return;
    // A half-finished drawing belongs to the pane being left.
    panes[s.active]?.chart.setDrawingTool(null);
    store.set({ active: index, maximized: s.maximized === null ? null : index });
    bindToolbar();
    renderGrid();
    emit('activeChange', { index, chart: panes[index]!.chart });
    queueState();
  }

  function setLayout(layout: LayoutId) {
    if (!isLayoutId(layout)) return;
    const count = paneCount(LAYOUTS[layout]);
    ensurePanes(count);
    const s = store.get();
    for (const p of panes.slice(count)) p.chart.setSyncedCrosshair(null);
    store.set({ layout, maximized: null, active: Math.min(s.active, count - 1) });
    if (s.active !== store.get().active) bindToolbar();
    renderGrid();
    emit('layoutChange', { layout, panes: count });
    queueState();
  }

  function setSync(patch: Partial<LayoutSync>) {
    const before = store.get().sync;
    const sync = { ...before, ...patch };
    store.set({ sync });
    const active = panes[store.get().active]!;
    if (!sync.crosshair) for (const p of panes) p.chart.setSyncedCrosshair(null);
    if (sync.time && !before.time) broadcastTime(active);
    if ((sync.symbol && !before.symbol) || (sync.interval && !before.interval)) {
      const info = active.chart.symbolInfo;
      const res = active.chart.currentResolution;
      for (const other of visible()) {
        if (other === active || !info) continue;
        const sym = sync.symbol ? info.symbol : (other.chart.symbolInfo?.symbol ?? info.symbol);
        const r = sync.interval && res ? res : (other.chart.currentResolution ?? other.store.get().resolution);
        if (sym !== other.chart.symbolInfo?.symbol || r !== other.chart.currentResolution) void other.load(sym, r);
      }
    }
    queueState();
  }

  function toggleMaximize(index?: number) {
    const s = store.get();
    const target = index ?? s.active;
    if (s.maximized !== null) store.set({ maximized: null });
    else if (visibleCount() > 1) {
      if (target !== s.active) activate(target);
      store.set({ maximized: target });
    }
    renderGrid();
  }

  // ── Setup ──────────────────────────────────────────────────────────

  makePane(0, paneSpecs[0]!);
  ensurePanes(Math.max(visibleCount(), Math.min(paneSpecs.length, MAX_PANES)));
  shell.setPanes(() => panes);
  bindToolbar();
  render(<PaneTabs multi={controls} panes={() => panes} />, tabsHost);
  renderGrid();

  const resize = new ResizeObserver(() => {
    const narrow = shell.root.clientWidth > 0 && shell.root.clientWidth < narrowWidth;
    if (narrow === store.get().narrow) return;
    store.set({ narrow });
    renderGrid();
  });
  resize.observe(shell.root);

  const unbindKeys = bindWidgetKeys(
    shell,
    () => panes[store.get().active] ?? null,
    searchHotkey,
    (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return false;
      if (e.key === 'Enter') {
        toggleMaximize();
        return true;
      }
      // e.code: Alt+digit types other characters on some layouts (e.g. ¡ on macOS).
      const digit = /^Digit([1-8])$/.exec(e.code)?.[1];
      if (!digit) return false;
      activate(Number(digit) - 1);
      return true;
    },
  );

  const save = (): MultiChartState => {
    const s = store.get();
    return { version: 1, layout: s.layout, sync: { ...s.sync }, active: s.active, sizes: { ...sizes }, panes: panes.map((p) => p.chart.save()) };
  };

  return {
    slots: shell.slots,
    get charts() {
      return visible().map((p) => p.chart);
    },
    get activeChart() {
      return panes[store.get().active]!.chart;
    },
    get activeIndex() {
      return store.get().active;
    },
    get layout() {
      return store.get().layout;
    },
    get sync() {
      return { ...store.get().sync };
    },
    setLayout,
    setSync,
    activate,
    toggleMaximize,
    setSymbol: (sym, res) => {
      const pane = panes[store.get().active]!;
      return pane.load(sym, res ?? pane.store.get().resolution);
    },
    setResolution: (res) => {
      const pane = panes[store.get().active]!;
      const current = pane.store.get().symbol;
      return current ? pane.load(current.symbol, res) : Promise.resolve();
    },
    setLocale: (locale) => {
      for (const p of panes) {
        p.chart.setLocale(locale);
        p.store.set({ locale });
      }
    },
    setTheme: shell.setTheme,
    setColorScheme: shell.setColorScheme,
    save,
    load: async (input) => {
      const raw = input as Partial<MultiChartState> | null;
      if (!raw || typeof raw !== 'object' || raw.version !== 1 || !Array.isArray(raw.panes) || raw.panes.length === 0) {
        throw new Error('funnest-charts: unsupported multi-chart state (expected version 1)');
      }
      const states = raw.panes.slice(0, MAX_PANES).map((p) => parseChartState(p));
      sizes = raw.sizes && typeof raw.sizes === 'object' ? { ...raw.sizes } : {};
      const layout = isLayoutId(raw.layout) ? raw.layout : '1';
      // Panes beyond the saved list are created from pane 0 and then overwritten below.
      ensurePanes(Math.max(states.length, paneCount(LAYOUTS[layout])));
      store.set({ sync: { ...DEFAULT_SYNC, ...raw.sync } });
      setLayout(layout);
      activate(Math.min(Math.max(0, Number(raw.active) || 0), visibleCount() - 1));
      await Promise.all(states.map((state, i) => panes[i]!.chart.load(state)));
    },
    on: (event, listener) => {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener as (payload: never) => void);
      return () => set.delete(listener as (payload: never) => void);
    },
    destroy: () => {
      unbindKeys();
      resize.disconnect();
      render(null, shell.toolbarHost);
      if (shell.drawbarHost) render(null, shell.drawbarHost);
      render(null, tabsHost);
      for (const p of panes) p.destroy();
      listeners.clear();
      shell.destroy();
    },
  };
}
