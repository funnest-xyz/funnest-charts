/** @jsxImportSource preact */
import { createChart, type Chart, type ChartOptions, type ChartType, type Datafeed, type Resolution } from '@funnest/charts';
import { render } from 'preact';
import { Overlay } from './components/overlay';
import type { ContextMenuItems, IntervalGroup, MultiControls, SearchCategory, UiState, WidgetContext } from './context';
import { div, type Shell } from './shell';
import { Store } from './store';

export interface PaneConfig {
  datafeed: Datafeed;
  chartOptions: Omit<ChartOptions, 'datafeed' | 'theme'>;
  displayTimezone: string;
  resolution: Resolution;
  chartType: ChartType;
  intervalGroups: readonly IntervalGroup[];
  searchCategories: readonly SearchCategory[];
  symbolLogo: boolean;
  drawingToolbar: boolean;
  attribution: boolean;
  contextMenuItems?: ContextMenuItems | undefined;
  multi?: MultiControls | undefined;
}

/**
 * One chart with its legend/navigation overlay and UI state. The toolbar and drawing bar
 * belong to the shell and are pointed at whichever pane is active.
 */
export interface Pane {
  /** `.fnc-stage`: chart canvas + overlay. The owner places it in the layout. */
  readonly stage: HTMLElement;
  readonly chart: Chart;
  readonly store: Store<UiState>;
  readonly ctx: WidgetContext;
  readonly canSearch: boolean;
  load(symbol: string, resolution: Resolution): Promise<void>;
  destroy(): void;
}

export function createPane(shell: Shell, config: PaneConfig): Pane {
  const stage = div('fnc-stage');
  const chartHost = div('fnc-chart-host', stage);
  const overlayHost = div('fnc-overlay', stage);
  const chart = createChart(chartHost, {
    ...config.chartOptions,
    theme: shell.theme(),
    datafeed: config.datafeed,
    displayTimezone: config.displayTimezone,
  });
  chart.setChartType(config.chartType);

  const store = new Store<UiState>({
    locale: config.chartOptions.locale ?? 'ko',
    symbol: null,
    resolution: config.resolution,
    loading: false,
    layout: chart.layout,
    atRealtime: true,
    searchOpen: false,
    searchTarget: 'symbol',
    canUndo: chart.canUndo,
    canRedo: chart.canRedo,
    compares: chart.getCompares(),
    replay: chart.replay,
    chartType: config.chartType,
    drawingTool: null,
    selection: null,
    drawingCount: 0,
    drawbarOpen: false,
    magnet: chart.magnetEnabled,
    indicators: chart.getIndicators(),
    dialog: null,
    ...shell.sharedState(),
  });

  const syncRealtime = () => store.set({ atRealtime: chart.isAtRealtime() });
  const offs = [
    chart.on('symbolChange', (info) => store.set({ symbol: info, resolution: chart.currentResolution ?? store.get().resolution })),
    chart.on('loadingChange', (loading) => store.set({ loading })),
    chart.on('layoutChange', (layout) => store.set({ layout })),
    chart.on('visibleRangeChange', syncRealtime),
    chart.on('dataChange', syncRealtime),
    chart.on('drawingToolChange', (drawingTool) => store.set({ drawingTool })),
    chart.on('selectionChange', (selection) => store.set({ selection })),
    chart.on('drawingsChange', (drawings) => store.set({ drawingCount: drawings.length })),
    chart.on('indicatorsChange', (indicators) => store.set({ indicators })),
    chart.on('magnetChange', (magnet) => store.set({ magnet })),
    chart.on('chartTypeChange', (chartType) => store.set({ chartType })),
    chart.on('historyChange', ({ canUndo, canRedo }) => store.set({ canUndo, canRedo })),
    chart.on('comparesChange', (compares) => store.set({ compares })),
    chart.on('replayChange', (replay) => store.set({ replay })),
  ];

  const load = (sym: string, res: Resolution) => {
    store.set({ resolution: res });
    return chart.setSymbol(sym, res).catch((error: unknown) => {
      console.error('funnest-charts: failed to load', sym, res, error);
      store.set({ loading: false });
    });
  };

  const ctx: WidgetContext = {
    root: shell.root,
    chart,
    datafeed: config.datafeed,
    store,
    storage: shell.storage,
    intervalGroups: config.intervalGroups,
    searchCategories: config.searchCategories,
    displayTimezone: config.displayTimezone,
    showLogo: config.symbolLogo,
    drawingToolbar: config.drawingToolbar,
    attribution: config.attribution,
    contextMenuItems: config.contextMenuItems,
    slots: shell.slots,
    multi: config.multi,
    setDrawbarCollapsed: shell.setDrawbarCollapsed,
    selectSymbol: (sym) => void load(sym, store.get().resolution),
    selectResolution: (res) => {
      const current = store.get().symbol;
      if (current) void load(current.symbol, res);
    },
    toggleFavoriteInterval: shell.toggleFavoriteInterval,
    setSearchOpen: (open, target = 'symbol') => store.set(open ? { searchOpen: true, searchTarget: target } : { searchOpen: false }),
    screenshot: () => {
      const s = store.get();
      chart.takeScreenshot().toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${s.symbol?.symbol ?? 'chart'}_${s.resolution}_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    },
    toggleFullscreen: shell.toggleFullscreen,
  };

  render(<Overlay ctx={ctx} />, overlayHost);

  return {
    stage,
    chart,
    store,
    ctx,
    canSearch: typeof config.datafeed.searchSymbols === 'function',
    load,
    destroy: () => {
      offs.forEach((off) => off());
      render(null, overlayHost);
      chart.destroy();
      stage.remove();
    },
  };
}
