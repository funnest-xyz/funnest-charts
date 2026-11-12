import { Emitter } from './events';
import { Interaction, type HitRegion, type InteractionHost } from './interaction';
import { BarStore } from './model/bar-store';
import { logTicks, niceTicks, PriceScale, type PriceScaleMode } from './model/price-scale';
import { computeTimeTicks, defaultTimeZone, TimeFormatter, type Locale, browserLocale } from './model/time-format';
import { DEFAULT_TIME_SCALE_OPTIONS, TimeScale, type IndexRange, type TimeScaleOptions } from './model/time-scale';
import { decimalsOf, formatCompact, formatPrice, resolveTickSize, roundToTick } from './price';
import type { IndicatorDefinition, IndicatorOutput, IndicatorParams, IndicatorType } from './indicators/definitions';
import { IndicatorManager, indicatorRegistry, type IndicatorConfig, type IndicatorPatch } from './indicators/manager';
import { DrawingManager, drawingRegistry, type Drawing, type DrawingDefinition, type DrawingType } from './objects/drawings';
import {
  TradingLayer,
  type AlertLineOptions,
  type ExecutionMarker,
  type LineHandle,
  type OrderLineOptions,
  type PositionLineOptions,
  type TradingLabelOptions,
  type TradingLabels,
} from './objects/trading';
import { snapToOhlc } from './objects/magnet';
import { DEFAULT_CHART_SETTINGS, parseChartState, type ChartSettings, type ChartState } from './settings';
import { TradingSync, type TradingAdapter } from './objects/trading-sync';
import type { ChartOverlay, ObjectHit, PaneCoords } from './objects/types';
import { CanvasLayer } from './render/canvas-layer';
import { ColorResolver } from './render/color-resolver';
import {
  drawMain,
  drawOverlay,
  type ChartType,
  type CrosshairInfo,
  type Frame,
  type Palette,
  type PaneFrame,
  type PaneId,
  type RenderModel,
  type Tooltip,
} from './render/renderer';
import { DAY_MS, isIntradayResolution, resolutionToMs } from './resolution';
import { sessionStatus } from './session';
import { lightTheme, type ThemeTokens } from './theme';
import type { Bar, ConnectionState, Datafeed, Quote, Resolution, SymbolInfo, TickSize, Unsubscribe } from './types';

export interface ChartOptions {
  /** Merged over the light theme. Values may use CSS variables: `{ background: 'var(--bg)' }`. */
  theme?: Partial<ThemeTokens>;
  locale?: Locale;
  /** IANA timezone for axis labels. Defaults to the browser's; overridden by `SymbolInfo.timezone`. */
  timezone?: string;
  /**
   * Show all times in this timezone regardless of the symbol's exchange (e.g. 'Asia/Seoul'
   * for Korean users watching US stocks). Takes precedence over `timezone` and the symbol's.
   */
  displayTimezone?: string;
  pricePrecision?: number;
  tickSize?: TickSize;
  /** Show the volume pane. Default true. (Same as `settings.volume`.) */
  volume?: boolean;
  /** Initial chart settings (high/low markers, grid, last price line, candle colors…). */
  settings?: Partial<ChartSettings>;
  timeScale?: Partial<TimeScaleOptions>;
  /** Enables `setSymbol()` with automatic history paging and realtime updates. */
  datafeed?: Datafeed;
  /** Bars per history request. Default 300. */
  historyBatchSize?: number;
  /** The user's fills, positions and orders, synced per symbol. See TradingAdapter. */
  trading?: TradingAdapter;
  /** Extra indicators (same shape as the built-ins). They appear in the widget's indicator picker. */
  indicatorDefinitions?: readonly IndicatorDefinition[];
  /** Extra drawing tools. They appear in the widget's drawing bar. */
  drawingDefinitions?: readonly DrawingDefinition[];
}

/** A symbol overlaid for comparison. */
export interface CompareInfo {
  symbol: string;
  /** Display name once resolved (the symbol until then). */
  name: string;
  color: string;
  /** Bars are loaded. */
  ready: boolean;
}

/** Bar replay: history is cut at a past bar and played forward. */
export interface ReplayStatus {
  /** Waiting for the user to click the bar to start from. */
  selecting: boolean;
  active: boolean;
  playing: boolean;
  /** Bars still hidden to the right. */
  remaining: number;
  /** Milliseconds between bars while playing. */
  interval: number;
}

export interface ChartEvents {
  crosshairMove: CrosshairInfo | null;
  visibleRangeChange: IndexRange;
  /** Manual-data mode: the user scrolled near the oldest bar. Respond with `prependData()`. */
  needHistory: { oldestTime: number };
  symbolChange: SymbolInfo;
  /** Bars changed (set / realtime update / history). Fired at most once per frame. */
  dataChange: { last: Bar | undefined };
  /** Plot area geometry changed (resize, price-axis width). */
  layoutChange: ChartLayout;
  /** A symbol/resolution load started (true) or finished (false). */
  loadingChange: boolean;
  /** Drawings were created, edited or removed (not fired during a live drag). */
  drawingsChange: Drawing[];
  /** The armed drawing tool changed (null = cursor). Tools disarm after one drawing. */
  drawingToolChange: DrawingType | null;
  selectionChange: Drawing | null;
  magnetChange: boolean;
  chartTypeChange: ChartType;
  settingsChange: ChartSettings;
  /**
   * Something worth persisting changed (symbol, interval, chart type, settings, indicators,
   * drawings). Batched per tick — a good hook for autosaving `save()`.
   */
  stateChange: void;
  /** Live market statistics from `Datafeed.subscribeQuotes`. */
  quoteChange: Quote;
  /** Realtime connection state/latency reported by the datafeed. */
  connectionChange: ConnectionState;
  indicatorsChange: IndicatorConfig[];
  /** Undo/redo availability changed (drawings and indicators are tracked). */
  historyChange: { canUndo: boolean; canRedo: boolean };
  comparesChange: CompareInfo[];
  /** App rows in the legend (addLegendItem) were added, changed or removed. */
  legendItemsChange: readonly LegendItem[];
  replayChange: ReplayStatus;
  /**
   * Right-click on the chart (mouse only). While anything listens, the browser's own menu is
   * suppressed — the widget shows its menu (undo, horizontal line here, reset…).
   */
  contextMenu: ChartContextMenu;
  error: unknown;
}

export interface ChartContextMenu {
  /** Pixels relative to the chart element. */
  x: number;
  y: number;
  pane: PaneId;
  /** Price under the pointer (tick-rounded) when it's over the price pane, else null. */
  price: number | null;
  /** Time of the bar under the pointer, or null past the data. */
  time: number | null;
}

export interface ChartPaneLayout {
  id: PaneId;
  kind: 'main' | 'volume' | 'indicator';
  top: number;
  height: number;
}

/**
 * A row an app puts in the chart's legend for something it draws itself (a liquidation map, an
 * order-book heatmap, a line from its own data), so people can hide, configure or remove it
 * right where they see the indicators.
 */
export interface LegendItemOptions {
  name: string;
  /** Starts shown. Default true. */
  visible?: boolean;
  /** 👁 hides / shows it: the app stops / resumes drawing. No eye without it. */
  onToggle?(visible: boolean): void;
  /** ⚙ opens the app's own settings for it. */
  onSettings?(): void;
  /** × turns it off (the app removes its drawing and this row). */
  onRemove?(): void;
}
export interface LegendItem extends LegendItemOptions {
  id: string;
  visible: boolean;
}

export interface IndicatorLegendItem {
  id: string;
  type: IndicatorType;
  title: string;
  overlay: boolean;
  visible: boolean;
  /** Visible series only. */
  values: { key: string; label: string; value: string; color: string }[];
}

export interface ChartLayout {
  width: number;
  height: number;
  plotWidth: number;
  panesHeight: number;
  timeAxisHeight: number;
  /** Price pane, volume pane and one pane per non-overlay indicator, top to bottom. */
  panes: ChartPaneLayout[];
}

const TIME_AXIS_HEIGHT = 28;
const MIN_PRICE_AXIS_WIDTH = 56;
/** Relative pane heights: the price pane gets 4 parts, volume 1, each indicator pane 1.3. */
const PANE_WEIGHT = { main: 4, volume: 1, indicator: 1.3 };
/** No pane can be dragged smaller than this. */
const MIN_PANE_HEIGHT = 32;
/** Pointer distance (px) from a pane border that grabs it. */
const PANE_BORDER_GRAB = 4;
const HISTORY_TRIGGER_BARS = 20;
const TIME_LABEL_MIN_GAP = 72;
const PRICE_TICK_SPACING = 48;

const LABELS: Record<Locale, { high: string; low: string }> = {
  ko: { high: '최고', low: '최저' },
  en: { high: 'High', low: 'Low' },
};

const TRADING_LABELS: Record<Locale, TradingLabels> = {
  ko: { buy: '매수', sell: '매도', position: '평균단가', alert: '알림' },
  en: { buy: 'Buy', sell: 'Sell', position: 'Avg', alert: 'Alert' },
};

const HIT_TOLERANCE = { mouse: 5, touch: 14 };
const COMPARE_COLORS = ['#F06595', '#15AABF', '#FF9F0A', '#7048E8', '#12B886'];
const MAX_COMPARES = COMPARE_COLORS.length;
const HISTORY_LIMIT = 100;

interface CompareEntry {
  symbol: string;
  info: SymbolInfo | null;
  store: BarStore;
  color: string;
  unsubscribe: Unsubscribe | null;
  loadingOlder: boolean;
  noMoreOlder: boolean;
  /** Closes aligned to the main bars (NaN before the compare's first bar). */
  aligned: { key: string; values: Float64Array } | null;
}

/** "04:59", "1:04:59", "2d 04:59". */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${two(h)}:${two(m)}`;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

function formatPercent(v: number, decimals: number): string {
  const rounded = Number(v.toFixed(decimals));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(decimals)}%`;
}

/** First non-NaN value at or after `from`. */
function firstFinite(values: Float64Array, from: number): number {
  for (let i = Math.max(0, from); i < values.length; i++) if (!Number.isNaN(values[i]!)) return values[i]!;
  return Number.NaN;
}

const TOOLTIP_LABELS: Record<Locale, { buy: string; sell: string; liquidation: string; fills: (n: number) => string; price: string; avg: string; qty: string }> = {
  ko: { buy: '매수', sell: '매도', liquidation: '청산', fills: (n) => `${n}건`, price: '체결가', avg: '평균가', qty: '수량' },
  en: { buy: 'Buy', sell: 'Sell', liquidation: 'Liquidation', fills: (n) => `${n} fills`, price: 'Price', avg: 'Avg', qty: 'Qty' },
};

/**
 * Keeps the requested resolution when the symbol supports it; otherwise picks the closest
 * supported one (preferring the next shorter), e.g. 3개월 → 1개월 on an exchange without 3M bars.
 */
export function fallbackResolution(requested: Resolution, supported: readonly Resolution[] | undefined): Resolution {
  if (!supported?.length || supported.includes(requested)) return requested;
  const target = resolutionToMs(requested);
  const sorted = [...supported].sort((a, b) => resolutionToMs(a) - resolutionToMs(b));
  return [...sorted].reverse().find((r) => resolutionToMs(r) <= target) ?? sorted[0]!;
}

export function createChart(container: HTMLElement, options: ChartOptions = {}): Chart {
  return new Chart(container, options);
}

export class Chart {
  readonly timeScale: TimeScale;

  private readonly root: HTMLDivElement;
  private readonly mainLayer: CanvasLayer;
  private readonly overlayLayer: CanvasLayer;
  private readonly store = new BarStore();
  private readonly mainScale = new PriceScale({ top: 0.08, bottom: 0.08 });
  private readonly volumeScale = new PriceScale({ top: 0.2, bottom: 0 });
  private readonly indicators: IndicatorManager;
  private readonly indicatorScales = new Map<string, PriceScale>();
  private readonly emitter = new Emitter<ChartEvents>();
  private readonly colors: ColorResolver;
  private readonly interaction: Interaction;
  private readonly cleanups: Array<() => void> = [];
  private readonly drawings: DrawingManager;
  private readonly overlays: ChartOverlay[] = [];
  private legendExtras: readonly LegendItem[] = [];
  private legendSeq = 0;
  private readonly trading: TradingLayer;
  private readonly tradingSync: TradingSync;
  private tooltipKey: string | null = null;
  private chartType: ChartType = 'candles';
  private magnet = false;
  private objectDrag: ObjectHit | null = null;

  private theme: ThemeTokens;
  private locale: Locale;
  private formatter: TimeFormatter;
  private pricePrecision: number;
  private tickSize: TickSize;
  private settingsValue: ChartSettings;
  /** Drawings of symbols other than the current one (the current set lives in DrawingManager). */
  private readonly drawingsBySymbol = new Map<string, Drawing[]>();
  private stateQueued = false;
  private readonly datafeed: Datafeed | undefined;
  private readonly historyBatchSize: number;

  private size = { width: 0, height: 0, dpr: 1 };
  private priceAxisWidth = MIN_PRICE_AXIS_WIDTH;
  private frame: Frame | null = null;
  private crosshair: { x: number; y: number; source: 'mouse' | 'touch' } | null = null;
  /** Time (UTC ms) of a crosshair mirrored from a linked chart; see setSyncedCrosshair(). */
  private syncedTime: number | null = null;
  private lastCrosshairKey = '';
  private lastRangeKey = '';
  private lastLayoutKey = '';
  private dataVersion = 0;
  private emittedDataVersion = -1;
  private rafId = 0;
  private mainDirty = true;
  private destroyed = false;

  private symbol: SymbolInfo | null = null;
  private resolution: Resolution | null = null;
  private loadToken = 0;
  private unsubscribeBars: Unsubscribe | null = null;
  private unsubscribeQuotes: Unsubscribe | null = null;
  private latestQuote: Quote | null = null;
  /** Symbol the quote stream belongs to; kept across interval changes of the same symbol. */
  private quoteSymbol: string | null = null;
  private quoteToken = 0;
  private connectionState: ConnectionState | null = null;
  private readonly displayTimezone: string | undefined;
  private loadingHistory = false;
  /**
   * Bumped by every data replacement (setData) and history request: a page answers only if it
   * is still the latest request for the bars on screen. (The load token alone isn't enough — a
   * page requested while setSymbol() awaits carries the new token but the old symbol's bars.)
   */
  private historyRequest = 0;
  /** setSymbol() is between its request and setData(). */
  private symbolLoading = false;
  /**
   * What the latest setSymbol() asked for, until it lands (or fails). load() and save() go by it
   * rather than what's still on screen: a layout switched away and back before a slow symbol
   * arrives must not keep — or save — the one it was leaving.
   */
  private requested: { symbol: string; resolution: Resolution } | null = null;
  private noMoreHistory = false;
  private historyRequestedFor = Number.NaN;
  private countdownLabel: string | null = null;
  /** Undo/redo of drawings + indicators, as JSON snapshots. */
  private readonly history = { undo: [] as string[], redo: [] as string[], current: '', applying: false };
  private readonly compares = new Map<string, CompareEntry>();
  private compareVersion = 0;
  /** Base bar index of the % axis and compare lines (the first visible bar). */
  private percentBaseIndex = 0;
  private replayState: { future: Bar[]; timer: ReturnType<typeof setInterval> | null; interval: number } | null = null;
  private replaySelecting = false;
  /** Pane height weights the user set by dragging borders (unset panes use PANE_WEIGHT). */
  private readonly paneWeights = new Map<PaneId, number>();
  private paneWeightTotal = 1;

  constructor(container: HTMLElement, options: ChartOptions = {}) {
    this.theme = { ...lightTheme, ...options.theme };
    this.locale = options.locale ?? browserLocale();
    this.formatter = new TimeFormatter(options.timezone ?? defaultTimeZone(), this.locale);
    this.pricePrecision = options.pricePrecision ?? 2;
    this.tickSize = options.tickSize ?? 0;
    this.settingsValue = { ...DEFAULT_CHART_SETTINGS, ...options.settings };
    if (options.volume !== undefined) this.settingsValue.volume = options.volume;
    this.datafeed = options.datafeed;
    this.historyBatchSize = options.historyBatchSize ?? 300;
    this.displayTimezone = options.displayTimezone;
    if (options.displayTimezone) this.formatter = new TimeFormatter(options.displayTimezone, this.locale);
    this.timeScale = new TimeScale({ ...DEFAULT_TIME_SCALE_OPTIONS, ...options.timeScale });

    this.root = document.createElement('div');
    this.root.className = 'fnc-chart';
    Object.assign(this.root.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      userSelect: 'none',
    });
    this.root.style.setProperty('-webkit-user-select', 'none');
    this.root.style.setProperty('-webkit-touch-callout', 'none');
    this.root.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    const probe = document.createElement('span');
    probe.style.display = 'none';
    this.root.appendChild(probe);
    container.appendChild(this.root);

    this.colors = new ColorResolver(probe);
    this.indicators = new IndicatorManager(indicatorRegistry(options.indicatorDefinitions));
    this.drawings = new DrawingManager((change) => {
      this.invalidate();
      if (change === 'commit') {
        this.emitter.emit('drawingsChange', this.getDrawings());
        this.stateChanged();
        this.recordHistory();
      }
      if (change === 'tool') this.emitter.emit('drawingToolChange', this.drawings.tool);
      if (change !== 'preview') {
        // Emit a copy: listeners (e.g. UI stores) compare by reference, and drawings mutate in place.
        const d = this.drawings.selected;
        this.emitter.emit('selectionChange', d ? { ...d, points: d.points.map((p) => ({ ...p })) } : null);
      }
    }, drawingRegistry(options.drawingDefinitions));
    this.history.current = this.historySnapshot();
    this.trading = new TradingLayer(() => this.invalidate());
    this.tradingSync = new TradingSync(this.trading, (error) => this.emitter.emit('error', error));
    this.tradingSync.adapter = options.trading ?? null;
    this.mainLayer = new CanvasLayer(this.root);
    this.overlayLayer = new CanvasLayer(this.root);
    this.interaction = new Interaction(this.createInteractionHost(), this.overlayLayer.canvas);

    this.observeSize();
    this.observeThemeVariables();
    this.observeKeyboard();
    this.observeCountdown();
  }

  // ── Public API ──────────────────────────────────────────────────────

  /** Replaces all bars and scrolls to the latest. */
  setData(bars: readonly Bar[]): void {
    this.endReplay(false);
    this.store.set(bars);
    this.timeScale.barCount = this.store.length;
    this.timeScale.rightOffset = this.timeScale.options.rightOffset;
    this.mainScale.autoScale = true;
    this.volumeScale.autoScale = true;
    this.noMoreHistory = false;
    this.historyRequestedFor = Number.NaN;
    // Pages requested for the bars being replaced must not land on the new ones.
    this.historyRequest++;
    this.loadingHistory = false;
    this.dataVersion++;
    this.invalidate();
  }

  /** Realtime tick: same time as the last bar updates it, a newer time appends a bar. */
  update(bar: Bar): void {
    const replay = this.replayState;
    if (replay && (replay.future.length > 0 || bar.time > (this.store.last()?.time ?? -Infinity))) {
      // Replaying: live bars queue up behind the hidden ones.
      const tail = replay.future[replay.future.length - 1];
      if (tail && tail.time === bar.time) replay.future[replay.future.length - 1] = bar;
      else if (!tail || bar.time > tail.time) replay.future.push(bar);
      return;
    }
    const result = this.store.upsert(bar);
    if (result === 'ignored') return;
    if (result === 'append') {
      this.timeScale.barCount = this.store.length;
      // Scrolled back into history? Keep the view still instead of following the new bar.
      if (this.timeScale.rightOffset < 0) this.timeScale.rightOffset -= 1;
    }
    this.dataVersion++;
    this.invalidate();
  }

  /** Adds older bars (history paging). The view stays where it is. */
  prependData(bars: readonly Bar[], options: { noMoreData?: boolean } = {}): void {
    this.store.prepend(bars);
    this.timeScale.barCount = this.store.length;
    if (options.noMoreData) this.noMoreHistory = true;
    this.dataVersion++;
    this.invalidate();
  }

  get bars(): readonly Bar[] {
    return this.store.bars;
  }

  get symbolInfo(): SymbolInfo | null {
    return this.symbol;
  }

  /** Loads a symbol through the datafeed, then follows realtime updates. */
  async setSymbol(symbol: string, resolution: Resolution): Promise<void> {
    const feed = this.datafeed;
    if (!feed) throw new Error('funnest-charts: setSymbol() requires the `datafeed` option');
    const token = ++this.loadToken;
    this.requested = { symbol, resolution };
    this.endReplay(false);
    this.unsubscribeBars?.();
    this.unsubscribeBars = null;
    // Same symbol at another interval: market stats (price, 24h, open interest, funding) don't
    // change, so the quote stream stays and the market bar doesn't blank out.
    const keepQuotes = this.unsubscribeQuotes !== null && this.quoteSymbol === symbol;
    if (!keepQuotes) {
      this.quoteToken++;
      this.unsubscribeQuotes?.();
      this.unsubscribeQuotes = null;
      this.latestQuote = null;
      this.quoteSymbol = null;
    }
    this.emitter.emit('loadingChange', true);
    this.symbolLoading = true;

    let info: SymbolInfo;
    let result: Awaited<ReturnType<Datafeed['getBars']>>;
    try {
      info = await feed.resolveSymbol(symbol);
      if (token !== this.loadToken) return;
      resolution = fallbackResolution(resolution, info.supportedResolutions);
      const to = Date.now();
      result = await feed.getBars(info, resolution, {
        from: to - resolutionToMs(resolution) * this.historyBatchSize,
        to,
        countBack: this.historyBatchSize,
      });
      if (token !== this.loadToken) return;
    } finally {
      // Only the latest request reports completion; superseded ones stay silent.
      if (token === this.loadToken) {
        this.symbolLoading = false;
        this.requested = null;
        this.emitter.emit('loadingChange', false);
      }
    }

    // Drawings belong to a symbol: park the old symbol's, bring back the new one's.
    const previous = this.symbol?.symbol ?? '';
    if (previous !== info.symbol) {
      const current = this.getDrawings();
      if (current.length) this.drawingsBySymbol.set(previous, current);
      this.restoreDrawingsFor(info.symbol);
    }
    this.symbol = info;
    this.resolution = resolution;
    this.formatter = new TimeFormatter(this.displayTimezone ?? info.timezone, this.locale);
    this.pricePrecision = info.pricePrecision;
    this.tickSize = info.tickSize;
    this.setData(result.bars);
    this.noMoreHistory = result.noMoreData;
    void this.tradingSync.load(info, result.bars[0]?.time ?? Date.now());
    this.unsubscribeBars = feed.subscribeBars(
      info,
      resolution,
      (bar) => {
        if (token === this.loadToken) this.update(bar);
      },
      () => {
        if (token === this.loadToken) void this.resync(token);
      },
      (state) => {
        if (token !== this.loadToken) return;
        this.connectionState = state;
        this.emitter.emit('connectionChange', state);
      },
    );
    if (!keepQuotes) {
      const quoteToken = ++this.quoteToken;
      this.quoteSymbol = symbol;
      this.unsubscribeQuotes =
        feed.subscribeQuotes?.(info, (quote) => {
          if (quoteToken !== this.quoteToken) return;
          this.latestQuote = { ...this.latestQuote, ...quote };
          this.emitter.emit('quoteChange', this.latestQuote);
        }) ?? null;
    }
    // Compared symbols follow the interval (and get bars covering the new history).
    for (const entry of this.compares.values()) void this.reloadCompare(entry);
    this.emitter.emit('symbolChange', info);
    this.stateChanged();
  }

  /** Latest market statistics (merged across partial updates), if the datafeed provides them. */
  get quote(): Quote | null {
    return this.latestQuote;
  }

  /** Realtime connection state, if the datafeed reports it. */
  get connection(): ConnectionState | null {
    return this.connectionState;
  }

  get currentResolution(): Resolution | null {
    return this.resolution;
  }

  /** Reloads the current symbol at another resolution. */
  setResolution(resolution: Resolution): Promise<void> {
    if (!this.symbol) throw new Error('funnest-charts: setResolution() needs a symbol loaded via setSymbol()');
    return this.setSymbol(this.symbol.symbol, resolution);
  }

  /** Plot geometry, for positioning overlays. */
  get layout(): ChartLayout {
    const f = this.frame;
    return {
      width: this.size.width,
      height: this.size.height,
      plotWidth: f?.plotWidth ?? 0,
      panesHeight: f?.panesHeight ?? 0,
      timeAxisHeight: TIME_AXIS_HEIGHT,
      panes: (f?.panes ?? []).map((p) => ({ id: p.id, kind: p.kind, top: p.top, height: p.height })),
    };
  }

  /**
   * Reserves `px` at the top of the price pane so overlays (like a legend) never cover
   * the candles. Auto-scaled data is laid out below the inset.
   */
  setTopInset(px: number): void {
    const value = Math.max(0, Math.round(px));
    if (value === this.mainScale.insetTop) return;
    this.mainScale.insetTop = value;
    this.invalidate();
  }

  /** factor > 1 zooms in. Anchored to the latest bar when it's on screen, otherwise to the center. */
  zoom(factor: number): void {
    const anchor = this.isAtRealtime() ? this.timeScale.width : this.timeScale.width / 2;
    this.timeScale.zoom(anchor, factor);
    this.invalidate();
  }

  /** Scrolls by a number of bars; positive moves toward newer bars. */
  scrollBars(bars: number): void {
    this.timeScale.pan(-bars * this.timeScale.barSpacing);
    this.invalidate();
  }

  /** True when the newest bar is visible. */
  isAtRealtime(): boolean {
    return this.store.length === 0 || this.timeScale.visibleRange().to >= this.store.length - 1;
  }

  /**
   * Mirrors another chart's crosshair: a vertical line at `time` (UTC ms) on the bar that
   * contains it, with the time badge but no price line. `crosshairMove` fires with
   * `source: 'sync'`, so legends follow along. A pointer on this chart takes precedence.
   * Pass null to clear.
   */
  setSyncedCrosshair(time: number | null): void {
    if (time === this.syncedTime) return;
    this.syncedTime = time;
    this.invalidate(false);
  }

  /**
   * The time span (UTC ms) between the plot's left and right edges. Edges past the data
   * (the empty space right of the last bar) are extrapolated by the bar interval.
   */
  getVisibleTimeRange(): { from: number; to: number } | null {
    const ts = this.timeScale;
    if (this.store.length === 0 || ts.width <= 0) return null;
    return { from: this.indexToTime(ts.xToIndexFloat(0)), to: this.indexToTime(ts.xToIndexFloat(ts.width)) };
  }

  /** Scrolls and zooms so the plot spans `from`…`to` (UTC ms), e.g. to match a linked chart. */
  setVisibleTimeRange(range: { from: number; to: number }): void {
    const ts = this.timeScale;
    if (this.store.length === 0 || ts.width <= 0 || !(range.to > range.from)) return;
    const from = this.timeToIndex(range.from);
    const to = this.timeToIndex(range.to);
    if (!(to > from)) return;
    // Solve xToIndexFloat(0) = from and xToIndexFloat(width) = to.
    ts.barSpacing = ts.width / (to - from);
    ts.rightOffset = to - 0.5 - (this.store.length - 1);
    ts.clamp();
    this.invalidate();
  }

  /** Fractional bar index → time, interpolating between bars and extrapolating past either end. */
  private indexToTime(index: number): number {
    const bars = this.store.bars;
    const last = bars.length - 1;
    const step = this.barInterval();
    if (index <= 0) return bars[0]!.time + index * step;
    if (index >= last) return bars[last]!.time + (index - last) * step;
    const i = Math.floor(index);
    const a = bars[i]!.time;
    return a + (bars[i + 1]!.time - a) * (index - i);
  }

  /** Inverse of indexToTime(). */
  private timeToIndex(time: number): number {
    const bars = this.store.bars;
    const last = bars.length - 1;
    const step = this.barInterval();
    if (time <= bars[0]!.time) return (time - bars[0]!.time) / step;
    if (time >= bars[last]!.time) return last + (time - bars[last]!.time) / step;
    const i = this.store.indexAtOrBefore(time);
    const a = bars[i]!.time;
    const b = bars[i + 1]!.time;
    return i + (b > a ? (time - a) / (b - a) : 0);
  }

  /** Snapshot of the chart (without the crosshair) at device resolution. */
  takeScreenshot(): HTMLCanvasElement {
    if (this.rafId || this.mainDirty) this.render();
    const src = this.mainLayer.canvas;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    out.getContext('2d')?.drawImage(src, 0, 0);
    return out;
  }

  /**
   * Re-fetches the latest window and merges it in, keeping the view. Datafeeds trigger this
   * via the `onResetCache` callback of subscribeBars after a WebSocket reconnect, so bars
   * missed while disconnected are filled in.
   */
  private async resync(token: number): Promise<void> {
    const feed = this.datafeed;
    if (!feed || !this.symbol || !this.resolution || this.replayState) return;
    try {
      const to = Date.now();
      const result = await feed.getBars(this.symbol, this.resolution, {
        from: to - resolutionToMs(this.resolution) * this.historyBatchSize,
        to,
        countBack: this.historyBatchSize,
      });
      if (token !== this.loadToken) return;
      const lastBefore = this.store.last()?.time ?? -Infinity;
      const before = this.store.length;
      this.store.merge(result.bars);
      // A scrolled-back view stays put when bars are appended at the end (same as realtime appends).
      if (this.timeScale.rightOffset < 0) {
        const appended = result.bars.filter((b) => b.time > lastBefore).length;
        this.timeScale.rightOffset -= Math.min(appended, this.store.length - before);
      }
      this.timeScale.barCount = this.store.length;
      this.dataVersion++;
      this.invalidate();
    } catch (error) {
      this.emitter.emit('error', error);
    }
  }

  // ── Chart type ─────────────────────────────────────────────────────

  get type(): ChartType {
    return this.chartType;
  }

  setChartType(type: ChartType): void {
    if (type === this.chartType) return;
    this.chartType = type;
    this.invalidate();
    this.emitter.emit('chartTypeChange', type);
    this.stateChanged();
  }

  // ── Settings & state ───────────────────────────────────────────────

  get settings(): ChartSettings {
    return { ...this.settingsValue };
  }

  setSettings(patch: Partial<ChartSettings>): void {
    this.settingsValue = { ...this.settingsValue, ...patch };
    this.invalidate();
    this.emitter.emit('settingsChange', this.settings);
    this.stateChanged();
  }

  /** Serializable snapshot of the layout. Pair with `load()`; see `stateChange` for autosave. */
  save(): ChartState {
    const drawings: Record<string, Drawing[]> = Object.fromEntries(this.drawingsBySymbol);
    drawings[this.symbol?.symbol ?? ''] = this.getDrawings();
    return {
      version: 1,
      // A symbol still loading is the one this chart is on (see `requested`).
      symbol: this.requested?.symbol ?? this.symbol?.symbol ?? null,
      resolution: this.requested?.resolution ?? this.resolution,
      chartType: this.chartType,
      settings: this.settings,
      indicators: this.getIndicators(),
      drawings: JSON.parse(JSON.stringify(drawings)) as Record<string, Drawing[]>,
      view: { barSpacing: this.timeScale.barSpacing, rightOffset: this.timeScale.rightOffset },
      compares: [...this.compares.keys()],
      paneWeights: Object.fromEntries(this.paneWeights),
    };
  }

  /**
   * Restores a layout from `save()` (or JSON from storage — it's validated). Loads the saved
   * symbol/interval through the datafeed first unless `{ symbol: false }`.
   */
  async load(input: ChartState | unknown, options: { symbol?: boolean } = {}): Promise<void> {
    const state = parseChartState(input);
    // Replace every symbol's drawings with the saved ones, starting with the current symbol, so
    // a following symbol switch parks the *saved* set rather than what was on screen before.
    this.drawingsBySymbol.clear();
    for (const [symbol, list] of Object.entries(state.drawings)) this.drawingsBySymbol.set(symbol, list);
    this.restoreDrawingsFor(this.symbol?.symbol ?? '');
    const wantSymbol = options.symbol !== false && this.datafeed && state.symbol;
    // Compared with what's loading, if anything: otherwise a slower earlier request would land
    // after this load and take the chart back to its symbol.
    const target = this.requested ?? { symbol: this.symbol?.symbol, resolution: this.resolution };
    if (wantSymbol && (state.symbol !== target.symbol || state.resolution !== target.resolution)) {
      await this.setSymbol(state.symbol!, state.resolution ?? this.resolution ?? '1D');
    }
    this.settingsValue = state.settings;
    this.emitter.emit('settingsChange', this.settings);
    this.setChartType(state.chartType);
    this.setIndicators(state.indicators);
    this.timeScale.barSpacing = state.view.barSpacing;
    this.timeScale.rightOffset = state.view.rightOffset;
    this.timeScale.clamp();
    this.paneWeights.clear();
    for (const [id, w] of Object.entries(state.paneWeights ?? {})) if (w > 0) this.paneWeights.set(id, w);
    const compares = state.compares ?? [];
    for (const symbol of [...this.compares.keys()]) if (!compares.includes(symbol)) this.removeCompare(symbol);
    if (this.datafeed) for (const symbol of compares) void this.addCompare(symbol);
    this.resetHistory();
    this.invalidate();
    this.stateChanged();
  }

  /** Swaps the active drawing set to `symbol`'s. */
  private restoreDrawingsFor(symbol: string): void {
    const list = this.drawingsBySymbol.get(symbol) ?? [];
    this.drawingsBySymbol.delete(symbol);
    this.drawings.set(list);
    // Undo history belongs to one symbol's drawings.
    this.resetHistory();
  }

  private stateChanged(): void {
    if (this.stateQueued) return;
    this.stateQueued = true;
    queueMicrotask(() => {
      this.stateQueued = false;
      if (!this.destroyed) this.emitter.emit('stateChange', undefined);
    });
  }

  // ── Drawings ───────────────────────────────────────────────────────

  /** Arms a drawing tool (null = cursor). It disarms itself after one drawing is placed. */
  setDrawingTool(tool: DrawingType | null): void {
    this.drawings.setTool(tool);
  }

  get drawingTool(): DrawingType | null {
    return this.drawings.tool;
  }

  /** Magnet mode: drawing points snap to the nearest open/high/low/close of the bar. */
  setMagnet(on: boolean): void {
    if (on === this.magnet) return;
    this.magnet = on;
    this.emitter.emit('magnetChange', on);
  }

  get magnetEnabled(): boolean {
    return this.magnet;
  }

  getDrawings(): Drawing[] {
    return this.drawings.drawings.map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })) }));
  }

  /** Restores drawings (e.g. from storage). */
  setDrawings(drawings: readonly Drawing[]): void {
    this.drawings.set(drawings);
  }

  updateDrawing(id: string, patch: Partial<Omit<Drawing, 'id'>>): void {
    this.drawings.update(id, patch);
  }

  /** Adds a drawing (e.g. a horizontal line at a price) and selects it. Returns its id. */
  addDrawing(drawing: Omit<Drawing, 'id'>): string {
    const id = `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.drawings.set([...this.drawings.drawings, { ...drawing, id, points: drawing.points.map((p) => ({ ...p })) }]);
    this.drawings.select(id);
    return id;
  }

  removeDrawing(id: string): void {
    this.drawings.remove(id);
  }

  clearDrawings(): void {
    this.drawings.clear();
  }

  get selectedDrawing(): Drawing | null {
    return this.drawings.selected;
  }

  selectDrawing(id: string | null): void {
    this.drawings.select(id);
  }

  // ── Indicators ─────────────────────────────────────────────────────

  /** Adds an indicator (overlays draw on the candles, others get their own pane). Returns its id. */
  addIndicator(type: IndicatorType, params?: IndicatorParams): string {
    const id = this.indicators.add(type, params);
    this.indicatorsChanged();
    return id;
  }

  removeIndicator(id: string): void {
    if (!this.indicators.remove(id)) return;
    this.indicatorScales.delete(id);
    this.paneWeights.delete(id);
    this.indicatorsChanged();
  }

  /** Changes params, per-series styles (color/width/visible) and/or overall visibility. */
  updateIndicator(id: string, patch: IndicatorPatch): void {
    if (this.indicators.update(id, patch)) this.indicatorsChanged();
  }

  setIndicatorVisible(id: string, visible: boolean): void {
    this.updateIndicator(id, { visible });
  }

  getIndicators(): IndicatorConfig[] {
    return this.indicators.snapshot();
  }

  /** Restores indicators (e.g. from storage). */
  setIndicators(configs: readonly IndicatorConfig[]): void {
    this.indicators.set(configs);
    this.indicatorScales.clear();
    this.indicatorsChanged();
  }

  /** Formatted indicator values at a bar index (default: the last bar), for legends. */
  indicatorLegend(index = this.store.length - 1): IndicatorLegendItem[] {
    return this.indicators.list.map((cfg) => {
      const def = this.indicators.def(cfg.type);
      const output = this.indicators.output(cfg, this.store.bars, this.dataVersion);
      const precision = output.precision ?? this.pricePrecision;
      return {
        id: cfg.id,
        type: cfg.type,
        title: def.title(cfg.params),
        overlay: def.overlay,
        visible: cfg.visible !== false,
        values: output.series.filter((series) => series.visible).map((series) => {
          const v = series.values[index - (series.shift ?? 0)];
          return {
            key: series.key,
            label: series.label,
            value: v === undefined || Number.isNaN(v) ? '—' : formatPrice(v, precision),
            color: series.kind === 'histogram' ? (v !== undefined && v < 0 ? this.theme.down : this.theme.up) : series.color,
          };
        }),
      };
    });
  }

  private indicatorsChanged(): void {
    this.invalidate();
    this.emitter.emit('indicatorsChange', this.getIndicators());
    this.stateChanged();
    this.recordHistory();
  }

  /** Built-in and custom indicators this chart can add. */
  indicatorDefinitions(): IndicatorDefinition[] {
    return [...this.indicators.registry.values()];
  }

  indicatorDefinition(type: IndicatorType): IndicatorDefinition | undefined {
    return this.indicators.registry.get(type);
  }

  /** Built-in and custom drawing tools, in drawing-bar order. */
  drawingDefinitions(): DrawingDefinition[] {
    return [...this.drawings.registry.values()];
  }

  // ── Pane sizes ─────────────────────────────────────────────────────

  /**
   * Moves the border above pane `index` (1 = between the price pane and the next one) by `dy` px.
   * The two neighbouring panes trade height; the rest keep theirs. Users do this by dragging.
   */
  resizePane(index: number, dy: number): void {
    const panes = this.frame?.panes;
    const above = panes?.[index - 1];
    const below = panes?.[index];
    if (!panes || !above || !below || !this.frame) return;
    const pair = above.height + below.height;
    const top = Math.min(pair - MIN_PANE_HEIGHT, Math.max(MIN_PANE_HEIGHT, above.height + dy));
    // Weights on the current scale, so panes added later still get their default share.
    const unit = this.paneWeightTotal / Math.max(1, this.frame.panesHeight);
    for (const p of panes) this.paneWeights.set(p.id, p.height * unit);
    this.paneWeights.set(above.id, top * unit);
    this.paneWeights.set(below.id, (pair - top) * unit);
    this.invalidate();
    this.stateChanged();
  }

  /** Back to the default pane heights. */
  resetPaneSizes(): void {
    if (this.paneWeights.size === 0) return;
    this.paneWeights.clear();
    this.invalidate();
    this.stateChanged();
  }

  // ── Undo / redo ────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.history.undo.length > 0;
  }

  get canRedo(): boolean {
    return this.history.redo.length > 0;
  }

  /** Reverts the last drawing or indicator change. */
  undo(): void {
    const previous = this.history.undo.pop();
    if (previous === undefined) return;
    this.history.redo.push(this.history.current);
    this.applyHistory(previous);
  }

  redo(): void {
    const next = this.history.redo.pop();
    if (next === undefined) return;
    this.history.undo.push(this.history.current);
    this.applyHistory(next);
  }

  private historySnapshot(): string {
    return JSON.stringify([this.drawings.drawings, this.indicators.list]);
  }

  private recordHistory(): void {
    const h = this.history;
    if (h.applying) return;
    const next = this.historySnapshot();
    if (next === h.current) return;
    h.undo.push(h.current);
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    h.redo = [];
    h.current = next;
    this.emitHistory();
  }

  private resetHistory(): void {
    this.history.undo = [];
    this.history.redo = [];
    this.history.current = this.historySnapshot();
    this.emitHistory();
  }

  private applyHistory(snapshot: string): void {
    const [drawings, indicators] = JSON.parse(snapshot) as [Drawing[], IndicatorConfig[]];
    this.history.applying = true;
    try {
      this.drawings.set(drawings);
      this.setIndicators(indicators);
    } finally {
      this.history.applying = false;
    }
    this.history.current = snapshot;
    this.emitHistory();
  }

  private emitHistory(): void {
    this.emitter.emit('historyChange', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  // ── Compare ────────────────────────────────────────────────────────

  /**
   * Overlays another symbol's closes as a line, rebased to the first visible bar. The price
   * axis switches to % while any symbol is compared. Needs the `datafeed` option.
   */
  async addCompare(symbol: string): Promise<void> {
    if (!this.datafeed) throw new Error('funnest-charts: addCompare() requires the `datafeed` option');
    if (this.compares.has(symbol) || this.compares.size >= MAX_COMPARES || symbol === this.symbol?.symbol) return;
    const used = new Set([...this.compares.values()].map((e) => e.color));
    const entry: CompareEntry = {
      symbol,
      info: null,
      store: new BarStore(),
      color: COMPARE_COLORS.find((c) => !used.has(c)) ?? COMPARE_COLORS[0]!,
      unsubscribe: null,
      loadingOlder: false,
      noMoreOlder: false,
      aligned: null,
    };
    this.compares.set(symbol, entry);
    this.comparesChanged();
    await this.reloadCompare(entry);
  }

  removeCompare(symbol: string): void {
    const entry = this.compares.get(symbol);
    if (!entry) return;
    entry.unsubscribe?.();
    this.compares.delete(symbol);
    this.comparesChanged();
  }

  getCompares(): CompareInfo[] {
    return [...this.compares.values()].map((e) => ({
      symbol: e.symbol,
      name: e.info?.name ?? e.symbol,
      color: e.color,
      ready: e.store.length > 0,
    }));
  }

  /** Each compared symbol's % change from the first visible bar, at `index` (default: the last bar). */
  compareLegend(index = this.store.length - 1): (CompareInfo & { value: string })[] {
    return this.getCompares().map((info) => {
      const values = this.alignedCompare(this.compares.get(info.symbol)!);
      const base = firstFinite(values, this.percentBaseIndex);
      const v = values[index];
      return { ...info, value: v === undefined || Number.isNaN(v) || !base ? '—' : formatPercent((v / base - 1) * 100, 2) };
    });
  }

  private comparesChanged(): void {
    this.compareVersion++;
    this.invalidate();
    this.emitter.emit('comparesChange', this.getCompares());
    this.stateChanged();
  }

  /** (Re)loads a compared symbol's bars at the current resolution, back to the main series' first bar. */
  private async reloadCompare(entry: CompareEntry): Promise<void> {
    const feed = this.datafeed;
    const resolution = this.resolution;
    if (!feed || !resolution) return;
    const token = this.loadToken;
    const current = () => this.compares.get(entry.symbol) === entry && token === this.loadToken;
    entry.unsubscribe?.();
    entry.unsubscribe = null;
    try {
      const info = entry.info ?? (await feed.resolveSymbol(entry.symbol));
      if (!current()) return;
      entry.info = info;
      const to = Date.now();
      const from = this.store.first()?.time ?? to - resolutionToMs(resolution) * this.historyBatchSize;
      const result = await feed.getBars(info, resolution, {
        from,
        to,
        countBack: Math.max(this.historyBatchSize, this.store.length + 1),
      });
      if (!current()) return;
      entry.store.set(result.bars);
      entry.noMoreOlder = result.noMoreData;
      entry.unsubscribe = feed.subscribeBars(
        info,
        resolution,
        (bar) => {
          if (!current()) return;
          entry.store.upsert(bar);
          this.compareVersion++;
          this.invalidate();
        },
        () => {},
      );
      this.comparesChanged();
      void this.loadOlderCompare(entry);
    } catch (error) {
      if (!current()) return;
      this.removeCompare(entry.symbol);
      this.emitter.emit('error', error);
    }
  }

  /** Pages a compared symbol's history back until it covers the main series' first bar. */
  private async loadOlderCompare(entry: CompareEntry): Promise<void> {
    const feed = this.datafeed;
    const first = entry.store.first();
    const mainFirst = this.store.first();
    if (!feed || !entry.info || !this.resolution || !first || !mainFirst) return;
    if (entry.loadingOlder || entry.noMoreOlder || first.time <= mainFirst.time) return;
    const token = this.loadToken;
    entry.loadingOlder = true;
    try {
      const to = first.time - 1;
      const result = await feed.getBars(entry.info, this.resolution, { from: mainFirst.time, to, countBack: this.historyBatchSize });
      if (this.compares.get(entry.symbol) !== entry || token !== this.loadToken) return;
      entry.store.prepend(result.bars);
      entry.noMoreOlder = result.noMoreData || result.bars.length === 0;
      this.compareVersion++;
      this.invalidate();
    } catch (error) {
      this.emitter.emit('error', error);
    } finally {
      entry.loadingOlder = false;
    }
  }

  /** Compare closes at each main bar (the compare bar at or before its time). */
  private alignedCompare(entry: CompareEntry): Float64Array {
    const key = `${this.dataVersion}:${this.compareVersion}`;
    if (entry.aligned?.key === key) return entry.aligned.values;
    const bars = this.store.bars;
    const other = entry.store.bars;
    const values = new Float64Array(bars.length).fill(Number.NaN);
    let j = -1;
    for (let i = 0; i < bars.length; i++) {
      const t = bars[i]!.time;
      while (j + 1 < other.length && other[j + 1]!.time <= t) j++;
      if (j >= 0) values[i] = other[j]!.close;
    }
    entry.aligned = { key, values };
    return values;
  }

  /** Compare lines in main-price space, each rebased so its first visible value sits on the main close there. */
  private compareOverlays(baseIndex: number): IndicatorOutput[] {
    const mainBase = this.store.bars[baseIndex]?.close;
    if (mainBase === undefined) return [];
    const out: IndicatorOutput[] = [];
    for (const entry of this.compares.values()) {
      if (entry.store.length === 0) continue;
      const aligned = this.alignedCompare(entry);
      const base = firstFinite(aligned, baseIndex);
      if (!base) continue;
      out.push({
        series: [
          {
            key: entry.symbol,
            label: entry.info?.name ?? entry.symbol,
            values: aligned.map((v) => (mainBase * v) / base),
            color: entry.color,
            width: 2,
            visible: true,
            kind: 'line',
          },
        ],
        precision: null,
      });
    }
    return out;
  }

  // ── Replay ─────────────────────────────────────────────────────────

  get replay(): ReplayStatus {
    const r = this.replayState;
    return {
      selecting: this.replaySelecting,
      active: r !== null,
      playing: r?.timer != null,
      remaining: r?.future.length ?? 0,
      interval: r?.interval ?? 1000,
    };
  }

  /** Arms start picking: the next click on the chart starts a replay from that bar. Esc cancels. */
  setReplaySelecting(on: boolean): void {
    if (on === this.replaySelecting) return;
    if (on && this.drawings.tool) this.drawings.setTool(null);
    this.replaySelecting = on;
    this.invalidate(false);
    this.emitReplay();
  }

  /** Hides every bar after `time` (UTC ms); reveal them with replayStep/replayPlay. */
  startReplay(time: number): void {
    const all = this.replayState ? [...this.store.bars, ...this.replayState.future] : [...this.store.bars];
    let cut = -1;
    while (cut + 1 < all.length && all[cut + 1]!.time <= time) cut++;
    // Keep at least one bar visible and one to replay.
    cut = Math.max(0, cut);
    if (cut >= all.length - 1) return;
    const interval = this.replayState?.interval ?? 1000;
    this.stopReplayTimer();
    this.replaySelecting = false;
    this.replayState = { future: all.slice(cut + 1), timer: null, interval };
    this.store.set(all.slice(0, cut + 1));
    this.timeScale.barCount = this.store.length;
    this.timeScale.rightOffset = Math.max(this.timeScale.options.rightOffset, 10);
    this.timeScale.clamp();
    this.mainScale.autoScale = true;
    this.dataVersion++;
    this.invalidate();
    this.emitReplay();
  }

  /** Reveals the next `count` hidden bars. */
  replayStep(count = 1): void {
    const r = this.replayState;
    if (!r) return;
    for (let k = 0; k < count && r.future.length > 0; k++) {
      this.store.upsert(r.future.shift()!);
      if (this.timeScale.rightOffset < 0) this.timeScale.rightOffset -= 1;
    }
    this.timeScale.barCount = this.store.length;
    this.dataVersion++;
    if (r.future.length === 0) this.stopReplayTimer();
    this.invalidate();
    this.emitReplay();
  }

  /** Plays one bar every `interval` ms (default: the last speed used, initially 1000). */
  replayPlay(interval?: number): void {
    const r = this.replayState;
    if (!r || r.future.length === 0) return;
    if (interval !== undefined) r.interval = Math.max(16, interval);
    if (r.timer) clearInterval(r.timer);
    r.timer = setInterval(() => this.replayStep(), r.interval);
    this.emitReplay();
  }

  /** Changes the playback speed (ms per bar), also while playing. */
  setReplayInterval(interval: number): void {
    const r = this.replayState;
    if (!r) return;
    r.interval = Math.max(16, interval);
    if (r.timer) {
      clearInterval(r.timer);
      r.timer = setInterval(() => this.replayStep(), r.interval);
    }
    this.emitReplay();
  }

  replayPause(): void {
    this.stopReplayTimer();
    this.emitReplay();
  }

  /** Leaves replay and shows every bar again (including live ones that arrived meanwhile). */
  stopReplay(): void {
    this.endReplay(true);
  }

  private endReplay(restore: boolean): void {
    const r = this.replayState;
    const wasSelecting = this.replaySelecting;
    this.replaySelecting = false;
    if (!r) {
      if (wasSelecting) {
        this.invalidate(false);
        this.emitReplay();
      }
      return;
    }
    this.stopReplayTimer();
    this.replayState = null;
    if (restore) {
      for (const bar of r.future) this.store.upsert(bar);
      this.timeScale.barCount = this.store.length;
      this.timeScale.rightOffset = this.timeScale.options.rightOffset;
      this.timeScale.clamp();
      this.dataVersion++;
      this.invalidate();
    }
    this.emitReplay();
  }

  private stopReplayTimer(): void {
    const r = this.replayState;
    if (r?.timer) clearInterval(r.timer);
    if (r) r.timer = null;
  }

  private emitReplay(): void {
    this.emitter.emit('replayChange', this.replay);
  }


  private indicatorScale(id: string): PriceScale {
    let scale = this.indicatorScales.get(id);
    // Generous top margin: the pane's legend sits there.
    if (!scale) this.indicatorScales.set(id, (scale = new PriceScale({ top: 0.24, bottom: 0.08 })));
    return scale;
  }

  // ── Trading ────────────────────────────────────────────────────────

  /**
   * Connects the user's account (fills, positions, orders). The chart loads them for the
   * current symbol, pages older fills with history and applies live updates. Pass null to detach.
   */
  setTradingAdapter(adapter: TradingAdapter | null): void {
    this.tradingSync.adapter = adapter;
    if (adapter && this.symbol) void this.tradingSync.load(this.symbol, this.store.first()?.time ?? Date.now());
    else this.tradingSync.detach();
  }

  /** Average-price line with live P&L against the last price. */
  addPositionLine(options: PositionLineOptions): LineHandle<PositionLineOptions> {
    return this.trading.addPosition(options);
  }

  /** Pending order line. Pass `onMove` to make it draggable and `onCancel` for an × button. */
  addOrderLine(options: OrderLineOptions): LineHandle<OrderLineOptions> {
    return this.trading.addOrder(options);
  }

  /** Price alert line (dotted, gray, "알림" label). Pass `onMove` to make it draggable and `onCancel` for an ×. */
  addAlertLine(options: AlertLineOptions): LineHandle<AlertLineOptions> {
    return this.trading.addAlert(options);
  }

  /**
   * Adds a row to the legend for something the app draws (see LegendItemOptions). `update()`
   * changes its name or state; `remove()` takes the row away (the app removes its drawing).
   */
  addLegendItem(options: LegendItemOptions): { update(patch: Partial<LegendItemOptions>): void; remove(): void } {
    const item: LegendItem = { ...options, id: `legend-${++this.legendSeq}`, visible: options.visible ?? true };
    this.legendExtras = [...this.legendExtras, item];
    this.emitter.emit('legendItemsChange', this.legendExtras);
    return {
      update: (patch) => {
        this.legendExtras = this.legendExtras.map((x) => (x.id === item.id ? { ...x, ...patch, visible: patch.visible ?? x.visible } : x));
        this.emitter.emit('legendItemsChange', this.legendExtras);
      },
      remove: () => {
        if (!this.legendExtras.some((x) => x.id === item.id)) return;
        this.legendExtras = this.legendExtras.filter((x) => x.id !== item.id);
        this.emitter.emit('legendItemsChange', this.legendExtras);
      },
    };
  }

  /** The app's legend rows, in the order they were added. */
  get legendItems(): readonly LegendItem[] {
    return this.legendExtras;
  }

  /** The legend's 👁 on an app row: tells the app (onToggle) and remembers the state. */
  setLegendItemVisible(id: string, visible: boolean): void {
    const item = this.legendExtras.find((x) => x.id === id);
    if (!item || item.visible === visible) return;
    this.legendExtras = this.legendExtras.map((x) => (x.id === id ? { ...x, visible } : x));
    item.onToggle?.(visible);
    this.emitter.emit('legendItemsChange', this.legendExtras);
  }

  /**
   * Paints `overlay` on the price pane every frame (see ChartOverlay). `redraw()` asks for a
   * new frame after its data changed; `remove()` takes it off.
   */
  addOverlay(overlay: ChartOverlay): { redraw(): void; remove(): void } {
    this.overlays.push(overlay);
    this.invalidate();
    return {
      redraw: () => this.invalidate(),
      remove: () => {
        const i = this.overlays.indexOf(overlay);
        if (i >= 0) this.overlays.splice(i, 1);
        this.invalidate();
      },
    };
  }

  /** Fill markers (▲ buy under the bar, ▼ sell above; ⚡ at the price for liquidations). Replaces the previous set. */
  setExecutions(markers: readonly ExecutionMarker[]): void {
    this.trading.setExecutions(markers);
  }

  /** What position/order/alert line labels show and where (direction, price, size, P&L, ×, alignment, line width). */
  setTradingLabels(patch: Partial<TradingLabelOptions>): void {
    this.trading.setLabelOptions(patch);
  }

  get tradingLabels(): TradingLabelOptions {
    return this.trading.labelSettings;
  }

  setTheme(theme: Partial<ThemeTokens>): void {
    this.theme = { ...this.theme, ...theme };
    this.colors.clear();
    this.invalidate();
  }

  /** Re-reads CSS variables used by the theme (call after changing them outside of class/style attributes). */
  refreshTheme(): void {
    this.colors.clear();
    this.invalidate();
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.formatter = new TimeFormatter(this.formatter.timeZone, locale);
    this.invalidate();
  }

  setTimezone(timeZone: string): void {
    this.formatter = new TimeFormatter(this.displayTimezone ?? timeZone, this.locale);
    this.invalidate();
  }

  setPriceFormat(format: { precision?: number; tickSize?: TickSize }): void {
    if (format.precision !== undefined) this.pricePrecision = format.precision;
    if (format.tickSize !== undefined) this.tickSize = format.tickSize;
    this.invalidate();
  }

  setVolumeVisible(visible: boolean): void {
    this.setSettings({ volume: visible });
  }

  fitContent(): void {
    this.timeScale.fitContent();
    this.mainScale.autoScale = true;
    this.invalidate();
  }

  scrollToRealtime(): void {
    this.timeScale.rightOffset = this.timeScale.options.rightOffset;
    this.timeScale.clamp();
    this.invalidate();
  }

  resetView(): void {
    this.timeScale.reset();
    this.mainScale.autoScale = true;
    this.volumeScale.autoScale = true;
    for (const scale of this.indicatorScales.values()) scale.autoScale = true;
    this.invalidate();
  }

  on<K extends keyof ChartEvents>(event: K, listener: (payload: ChartEvents[K]) => void): () => void {
    return this.emitter.on(event, listener);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadToken++;
    this.unsubscribeBars?.();
    this.unsubscribeQuotes?.();
    for (const entry of this.compares.values()) entry.unsubscribe?.();
    this.stopReplayTimer();
    this.tradingSync.detach();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.interaction.destroy();
    for (const cleanup of this.cleanups) cleanup();
    this.emitter.clear();
    this.root.remove();
  }

  // ── Scheduling & rendering ─────────────────────────────────────────

  /** Coalesces any number of changes into one paint per animation frame. */
  private invalidate(main = true): void {
    if (this.destroyed) return;
    if (main) this.mainDirty = true;
    if (!this.rafId) this.rafId = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    this.rafId = 0;
    if (this.destroyed || this.size.width <= 0 || this.size.height <= 0) return;

    if (this.mainDirty || !this.frame) {
      this.mainDirty = false;
      this.frame = this.computeFrame();
      drawMain(this.mainLayer, this.renderModel(this.frame));
      this.afterFrame();
    }
    const crosshair = this.resolveCrosshair(this.frame);
    drawOverlay(this.overlayLayer, this.renderModel(this.frame), crosshair, this.executionTooltip());
    this.emitCrosshair(crosshair);
  }

  private renderModel(frame: Frame): RenderModel {
    return {
      frame,
      bars: this.store.bars,
      timeScale: this.timeScale,
      formatPrice: (p) => formatPrice(p, this.pricePrecision),
      formatVolume: (v) => formatCompact(v, this.locale),
      formatCrosshairTime: (t) => this.formatter.crosshairLabel(t, this.isIntraday()),
      labels: LABELS[this.locale],
      chartType: this.chartType,
      replaySelecting: this.replaySelecting,
      objects: {
        coords: this.paneCoords(),
        overlays: this.overlays,
        drawings: this.drawings,
        trading: this.trading,
        tradingLabels: TRADING_LABELS[this.locale],
        barIndexAt: (time) => this.store.indexAtOrBefore(time),
      },
    };
  }

  /** Approximate ms per bar: the resolution when known, else the smallest recent gap. */
  private barInterval(): number {
    if (this.resolution) return resolutionToMs(this.resolution);
    const bars = this.store.bars;
    let gap = Infinity;
    for (let i = Math.max(1, bars.length - 20); i < bars.length; i++) gap = Math.min(gap, bars[i]!.time - bars[i - 1]!.time);
    return Number.isFinite(gap) && gap > 0 ? gap : 60_000;
  }

  private paneCoords(): PaneCoords {
    const interval = this.barInterval();
    const ts = this.timeScale;
    const scale = this.mainScale;
    return {
      plotWidth: ts.width,
      height: scale.height,
      timeToX: (time) => ts.indexToX(this.store.indexFloatOfTime(time, interval)),
      timeToIndex: (time) => this.store.indexFloatOfTime(time, interval),
      pointAt: (x, y) => {
        const index = Math.round(ts.xToIndexFloat(x));
        const bar = this.magnet ? this.store.at(index) : undefined;
        return {
          time: this.store.timeOfIndexFloat(index, interval),
          // Magnet: stick to the nearest OHLC of the bar under the pointer (no bar → free).
          price: bar ? snapToOhlc(bar, y, (p) => scale.priceToY(p)) : roundToTick(scale.yToPrice(y), this.tickSize),
        };
      },
      priceToY: (p) => scale.priceToY(p),
      yToPrice: (y) => scale.yToPrice(y),
      snapPrice: (p) => roundToTick(p, this.tickSize),
      // Drawing and order badges follow the axis (a % axis labels them in %).
      formatPrice: this.mainScale.mode === 'percent' ? this.mainValueFormat() : (p) => formatPrice(p, this.pricePrecision),
    };
  }

  private computeFrame(): Frame {
    const { width, height } = this.size;
    const bars = this.store.bars;
    const panesHeight = Math.max(0, height - TIME_AXIS_HEIGHT);
    this.timeScale.barCount = this.store.length;

    // Pane heights by weight; the price pane absorbs rounding.
    const indicatorPanes = this.indicators.panes;
    // Weights: defaults, or what the user dragged the pane borders to.
    const weightOf = (id: PaneId, kind: keyof typeof PANE_WEIGHT) => this.paneWeights.get(id) ?? PANE_WEIGHT[kind];
    const weights: [PaneId, number][] = [['main', weightOf('main', 'main')]];
    if (this.settingsValue.volume) weights.push(['volume', weightOf('volume', 'volume')]);
    for (const c of indicatorPanes) weights.push([c.id, weightOf(c.id, 'indicator')]);
    const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
    this.paneWeightTotal = totalWeight;
    const heightOf = new Map(weights.map(([id, w]) => [id, Math.max(MIN_PANE_HEIGHT, Math.round((panesHeight * w) / totalWeight))]));
    const volumeHeight = heightOf.get('volume') ?? 0;
    const indicatorHeights = indicatorPanes.map((c) => heightOf.get(c.id)!);
    // The price pane absorbs rounding.
    const mainHeight = Math.max(MIN_PANE_HEIGHT, panesHeight - volumeHeight - indicatorHeights.reduce((a, b) => a + b, 0));
    this.mainScale.height = mainHeight;
    this.volumeScale.height = volumeHeight;

    // What actually gets drawn/scaled: hidden indicators and hidden series drop out.
    const drawable = (config: IndicatorConfig): IndicatorOutput => {
      const { fill, ...out } = this.indicators.output(config, bars, this.dataVersion);
      if (config.visible === false) return { ...out, series: [] };
      const series = out.series.filter((x) => x.visible);
      const shown = (key: string) => series.some((x) => x.key === key);
      return fill && shown(fill.upper) && shown(fill.lower) ? { ...out, series, fill } : { ...out, series };
    };
    const overlays = this.indicators.overlays.map((config) => ({ config, output: drawable(config) }));
    // Comparing symbols only makes sense on a % axis.
    const mode: PriceScaleMode = this.compares.size > 0 ? 'percent' : this.settingsValue.priceScale;
    if (this.mainScale.mode !== mode) {
      this.mainScale.mode = mode;
      this.mainScale.autoScale = true;
    }
    let compareOverlays: IndicatorOutput[] = [];
    this.countdownLabel = this.countdownText();
    const subPanes = indicatorPanes.map((config) => {
      const scale = this.indicatorScale(config.id);
      scale.height = heightOf.get(config.id)!;
      return { config, scale, output: drawable(config) };
    });
    const indicatorFormat = (output: IndicatorOutput) => {
      const precision = output.precision ?? this.pricePrecision;
      return (v: number) => formatPrice(v, precision);
    };

    // Axis labels only need as many decimals as the tick step (RSI: "70", not "70.00").
    const tickFormat = (ticks: number[], output: IndicatorOutput) => {
      const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 1;
      const decimals = Math.min(output.precision ?? this.pricePrecision, decimalsOf(step));
      return (v: number) => formatPrice(v, decimals);
    };
    const fontFamily = this.colors.fontFamily(this.theme.fontFamily);
    const font = `${this.theme.fontSize}px ${fontFamily}`;
    const ctx = this.mainLayer.ctx;
    ctx.font = font;

    // The price axis width depends on label widths, which depend on the visible range,
    // which depends on the plot width. Iterate until stable (normally 1–2 passes).
    let range: IndexRange = { from: 0, to: -1 };
    let highLow: Frame['highLow'] = null;
    let priceTicks: number[] = [];
    let subTicks: number[][] = [];
    for (let pass = 0; pass < 3; pass++) {
      this.timeScale.width = Math.max(0, width - this.priceAxisWidth);
      this.timeScale.clamp();
      range = this.timeScale.visibleRange();
      this.percentBaseIndex = Math.max(0, range.from);
      compareOverlays = this.compareOverlays(this.percentBaseIndex);
      highLow = this.autoScale(range, [...overlays.map((o) => o.output), ...compareOverlays]);
      for (const pane of subPanes) this.autoScaleIndicator(pane.scale, pane.output, range);

      // Ticks span the pane's whole visible price range (margins and legend inset included),
      // so the grid covers the full background like TradingView, not just the data band.
      priceTicks = this.mainTicks(mainHeight);
      subTicks = subPanes.map((p) => {
        // Fixed-range indicators (RSI 0–100) keep labels inside their range.
        const [lo, hi] = p.output.range ?? [p.scale.yToPrice(p.scale.height), p.scale.yToPrice(0)];
        return niceTicks(lo, hi, Math.max(1, Math.floor(p.scale.height / 36)));
      });

      let labelWidth = 0;
      const measure = (text: string) => (labelWidth = Math.max(labelWidth, ctx.measureText(text).width));
      const last = this.store.last();
      const tickLabel = this.mainTickFormat(priceTicks);
      for (const v of priceTicks) measure(tickLabel(v));
      if (last) measure(this.mainValueFormat()(last.close));
      if (this.countdownLabel) measure(this.countdownLabel);
      subPanes.forEach((p, i) => subTicks[i]!.forEach((v) => measure(tickFormat(subTicks[i]!, p.output)(v))));
      const needed = Math.max(MIN_PRICE_AXIS_WIDTH, Math.ceil((labelWidth + 20) / 8) * 8);
      if (needed === this.priceAxisWidth) break;
      this.priceAxisWidth = needed;
    }

    const plotWidth = this.timeScale.width;
    const panes: PaneFrame[] = [
      {
        id: 'main',
        kind: 'main',
        top: 0,
        height: mainHeight,
        scale: this.mainScale,
        ticks: priceTicks,
        format: this.mainValueFormat(),
        tickFormat: this.mainTickFormat(priceTicks),
      },
    ];
    let top = mainHeight;
    if (volumeHeight > 0) {
      panes.push({
        id: 'volume',
        kind: 'volume',
        top,
        height: volumeHeight,
        scale: this.volumeScale,
        ticks: [],
        format: (v) => formatCompact(Math.max(0, v), this.locale),
      });
      top += volumeHeight;
    }
    subPanes.forEach((p, i) => {
      panes.push({
        id: p.config.id,
        kind: 'indicator',
        top,
        height: p.scale.height,
        scale: p.scale,
        ticks: subTicks[i]!,
        format: indicatorFormat(p.output),
        tickFormat: tickFormat(subTicks[i]!, p.output),
        indicator: p.output,
      });
      top += p.scale.height;
    });

    return {
      width,
      height,
      plotWidth,
      panesHeight,
      timeAxisHeight: TIME_AXIS_HEIGHT,
      panes,
      range,
      priceTicks,
      timeTicks: computeTimeTicks(this.store.bars, this.timeScale, this.formatter, TIME_LABEL_MIN_GAP),
      highLow,
      settings: this.settingsValue,
      overlays: [...overlays.map((o) => o.output), ...compareOverlays],
      palette: this.resolvePalette(),
      font,
      radius: this.theme.radius,
      countdown: this.countdownLabel,
    };
  }

  /** Price-pane tick values for the current axis mode. */
  private mainTicks(height: number): number[] {
    const s = this.mainScale;
    const lo = s.yToPrice(height);
    const hi = s.yToPrice(0);
    const count = Math.max(2, Math.floor(height / PRICE_TICK_SPACING));
    const minStep = resolveTickSize(this.tickSize, (lo + hi) / 2);
    if (s.mode === 'log') return logTicks(s, PRICE_TICK_SPACING, minStep);
    if (s.mode === 'percent') {
      const base = this.percentBase();
      const pct = (p: number) => (p / base - 1) * 100;
      return niceTicks(pct(lo), pct(hi), count).map((t) => base * (1 + t / 100));
    }
    return niceTicks(lo, hi, count, minStep);
  }

  private percentBase(): number {
    return this.store.at(this.percentBaseIndex)?.close || 1;
  }

  /** Price-axis tick labels: prices, or "+2.5%" on a % axis (decimals follow the step). */
  private mainTickFormat(ticks: readonly number[]): (v: number) => string {
    if (this.mainScale.mode !== 'percent') return (v) => formatPrice(v, this.pricePrecision);
    const base = this.percentBase();
    const step = ticks.length > 1 ? (Math.abs(ticks[1]! - ticks[0]!) / base) * 100 : 1;
    const decimals = Math.min(2, decimalsOf(Number(step.toPrecision(6))));
    return (v) => formatPercent((v / base - 1) * 100, decimals);
  }

  /** Crosshair and last-price label of the price pane. */
  private mainValueFormat(): (v: number) => string {
    if (this.mainScale.mode !== 'percent') return (v) => formatPrice(roundToTick(v, this.tickSize), this.pricePrecision);
    const base = this.percentBase();
    return (v) => formatPercent((v / base - 1) * 100, 2);
  }

  /** Time left in the last bar, when it's still forming (null otherwise). */
  private countdownText(now = Date.now()): string | null {
    const s = this.settingsValue;
    const last = this.store.last();
    const info = this.symbol;
    if (!s.countdown || !s.lastPriceLine || this.replayState || !this.resolution || !info || !last) return null;
    let end: number | null = null;
    if (isIntradayResolution(this.resolution)) {
      end = last.time + resolutionToMs(this.resolution);
    } else if (resolutionToMs(this.resolution) === DAY_MS) {
      if (info.session.trim().toLowerCase() === '24x7') end = last.time + DAY_MS;
      else {
        // A session market's daily bar closes with the session — while today's bar is the last one.
        const status = sessionStatus(info.session, info.timezone, now);
        end = status.open && now - last.time < DAY_MS ? status.nextChange : null;
      }
    }
    return end !== null && end > now ? formatCountdown(end - now) : null;
  }

  /** Auto-scales the price pane to visible candles and overlay indicators; returns the candle extremes. */
  private autoScale(range: IndexRange, overlays: IndicatorOutput[]): Frame['highLow'] {
    const bars = this.store.bars;
    let high = -Infinity;
    let low = Infinity;
    let highIndex = -1;
    let lowIndex = -1;
    let maxVolume = 0;
    for (let i = range.from; i <= range.to; i++) {
      const bar = bars[i]!;
      if (bar.high > high) {
        high = bar.high;
        highIndex = i;
      }
      if (bar.low < low) {
        low = bar.low;
        lowIndex = i;
      }
      if (bar.volume && bar.volume > maxVolume) maxVolume = bar.volume;
    }
    if (this.mainScale.autoScale && highIndex >= 0) {
      let min = low;
      let max = high;
      for (const output of overlays) {
        for (const series of output.series) {
          const shift = series.shift ?? 0;
          for (let i = range.from; i <= range.to; i++) {
            const v = series.values[i - shift]!;
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
      }
      this.mainScale.setRange(min, max);
    }
    if (this.volumeScale.autoScale) this.volumeScale.setRange(0, maxVolume || 1);
    return highIndex >= 0 ? { highIndex, lowIndex } : null;
  }

  private autoScaleIndicator(scale: PriceScale, output: IndicatorOutput, range: IndexRange): void {
    if (!scale.autoScale) return;
    if (output.range) {
      scale.setRange(output.range[0], output.range[1]);
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const series of output.series) {
      if (series.kind === 'histogram') {
        min = Math.min(min, 0);
        max = Math.max(max, 0);
      }
      const shift = series.shift ?? 0;
      for (let i = range.from; i <= range.to; i++) {
        const v = series.values[i - shift]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max)) scale.setRange(min, max);
    else scale.setRange(0, 1);
  }

  private resolvePalette(): Palette {
    const t = this.theme;
    const s = this.settingsValue;
    const c = (v: string) => this.colors.color(v);
    // A chart theme's text color also gives the muted text (axis labels) and crosshair.
    const muted = s.textColor && /^#[0-9a-f]{6}$/i.test(s.textColor) ? `${s.textColor}99` : null;
    return {
      background: c(s.background ?? t.background),
      text: c(s.textColor ?? t.text),
      textSecondary: c(muted ?? t.textSecondary),
      grid: c(s.gridColor ?? t.grid),
      border: c(s.gridColor ?? t.border),
      crosshair: c(muted ?? t.crosshair),
      up: c(this.settingsValue.upColor ?? t.up),
      down: c(this.settingsValue.downColor ?? t.down),
      accent: c(t.accent),
    };
  }

  private isIntraday(): boolean {
    if (this.resolution) return isIntradayResolution(this.resolution);
    const bars = this.store.bars;
    let minGap = Infinity;
    for (let i = 1; i < Math.min(bars.length, 20); i++) minGap = Math.min(minGap, bars[i]!.time - bars[i - 1]!.time);
    return minGap < DAY_MS;
  }

  private afterFrame(): void {
    const layout = this.layout;
    // Pane ids/heights are part of the key: adding an indicator pane must notify overlays (legends).
    const layoutKey = `${layout.width}:${layout.height}:${layout.plotWidth}:${layout.panesHeight}:${layout.panes.map((p) => `${p.id}@${p.top}`).join(',')}`;
    if (layoutKey !== this.lastLayoutKey) {
      this.lastLayoutKey = layoutKey;
      this.emitter.emit('layoutChange', layout);
    }
    if (this.dataVersion !== this.emittedDataVersion) {
      this.emittedDataVersion = this.dataVersion;
      this.emitter.emit('dataChange', { last: this.store.last() });
    }
    const range = this.timeScale.visibleRange();
    const key = `${range.from}:${range.to}`;
    if (key !== this.lastRangeKey) {
      this.lastRangeKey = key;
      this.emitter.emit('visibleRangeChange', range);
    }
    if (this.store.length > 0 && this.timeScale.xToIndexFloat(0) < HISTORY_TRIGGER_BARS) this.requestHistory();
  }

  private requestHistory(): void {
    const oldest = this.store.first();
    if (!oldest || this.loadingHistory || this.noMoreHistory || oldest.time === this.historyRequestedFor) return;
    // Mid-load (setSymbol awaiting the next symbol's bars): the bars on screen are on their way out.
    if (this.symbolLoading) return;
    this.historyRequestedFor = oldest.time;

    const feed = this.datafeed;
    if (!feed || !this.symbol || !this.resolution) {
      this.emitter.emit('needHistory', { oldestTime: oldest.time });
      return;
    }
    const token = this.loadToken;
    const request = ++this.historyRequest;
    const current = () => token === this.loadToken && request === this.historyRequest;
    this.loadingHistory = true;
    const to = oldest.time - 1;
    feed
      .getBars(this.symbol, this.resolution, {
        from: to - resolutionToMs(this.resolution) * this.historyBatchSize,
        to,
        countBack: this.historyBatchSize,
      })
      .then((result) => {
        if (!current()) return;
        this.prependData(result.bars, { noMoreData: result.noMoreData || result.bars.length === 0 });
        const first = this.store.first();
        if (first) void this.tradingSync.loadOlder(first.time);
        for (const entry of this.compares.values()) void this.loadOlderCompare(entry);
      })
      .catch((error: unknown) => this.emitter.emit('error', error))
      .finally(() => {
        if (current()) this.loadingHistory = false;
      });
  }

  // ── Crosshair ──────────────────────────────────────────────────────

  private resolveCrosshair(frame: Frame): CrosshairInfo | null {
    const ch = this.crosshair;
    const bars = this.store.bars;
    if (bars.length === 0) return null;
    const outside = ch?.source === 'mouse' && (ch.x < 0 || ch.x > frame.plotWidth || ch.y < 0 || ch.y > frame.panesHeight);
    if (!ch || outside) return this.syncedTime === null ? null : this.resolveSyncedCrosshair(this.syncedTime);

    const index = Math.min(bars.length - 1, Math.max(0, this.timeScale.xToIndex(ch.x)));
    const bar = bars[index]!;
    const x = this.timeScale.indexToX(index);
    // Touch: magnet to the close so a finger doesn't hide the value.
    const y = ch.source === 'touch' ? this.mainScale.priceToY(bar.close) : ch.y;
    const pane = this.paneAt(frame, y);
    const raw = pane.scale.yToPrice(y - pane.top);
    const value = pane.kind === 'main' ? roundToTick(raw, this.tickSize) : raw;
    return { index, time: bar.time, bar, value, pane: pane.id, x, y, source: ch.source };
  }

  /** The bar containing `time`, as a crosshair without a price (nothing when it's off the data). */
  private resolveSyncedCrosshair(time: number): CrosshairInfo | null {
    const bars = this.store.bars;
    const last = bars[bars.length - 1]!;
    if (time < bars[0]!.time || time >= last.time + this.barInterval()) return null;
    const index = this.store.indexAtOrBefore(time);
    const bar = bars[index];
    if (!bar) return null;
    const x = this.timeScale.indexToX(index);
    if (x < 0 || x > this.timeScale.width) return null;
    return { index, time: bar.time, bar, value: bar.close, pane: 'main', x, y: -1, source: 'sync' };
  }

  private paneAt(frame: Frame, y: number): PaneFrame {
    return frame.panes.find((p) => y >= p.top && y < p.top + p.height) ?? frame.panes[frame.panes.length - 1]!;
  }

  private setTooltip(key: string | null): void {
    if (key === this.tooltipKey) return;
    this.tooltipKey = key;
    this.invalidate(false);
  }

  private executionTooltip(): Tooltip | null {
    const g = this.tooltipKey ? this.trading.executionGroup(this.tooltipKey) : undefined;
    if (!g) return null;
    const t = TOOLTIP_LABELS[this.locale];
    const side = g.kind === 'liquidation' ? t.liquidation : g.side === 'buy' ? t.buy : t.sell;
    const lines = [
      g.count > 1 ? `${side} ${t.fills(g.count)}` : side,
      `${g.count > 1 ? t.avg : t.price} ${formatPrice(roundToTick(g.averagePrice, this.tickSize), this.pricePrecision)}`,
    ];
    if (g.quantity > 0) lines.push(`${t.qty} ${Number(g.quantity.toFixed(8))}`);
    lines.push(this.formatter.crosshairLabel(g.time, true));
    return { x: g.x, y: g.y, side: g.kind === 'liquidation' ? 'sell' : g.side, lines };
  }

  private emitCrosshair(info: CrosshairInfo | null): void {
    const key = info ? `${info.index}|${info.value}|${info.bar.close}|${info.bar.volume ?? ''}` : '';
    if (key === this.lastCrosshairKey) return;
    this.lastCrosshairKey = key;
    this.emitter.emit('crosshairMove', info);
  }

  // ── Interaction host ───────────────────────────────────────────────

  private paneScale(pane: PaneId): PriceScale {
    if (pane === 'main') return this.mainScale;
    if (pane === 'volume') return this.volumeScale;
    return this.indicatorScales.get(pane) ?? this.mainScale;
  }

  private createInteractionHost(): InteractionHost {
    return {
      hitTest: (x, y): HitRegion => {
        const f = this.frame;
        if (!f) return { area: 'none', pane: null };
        if (y >= f.panesHeight) return { area: x < f.plotWidth ? 'timeAxis' : 'none', pane: null };
        const border = f.panes.findIndex((p, i) => i > 0 && Math.abs(y - p.top) <= PANE_BORDER_GRAB);
        if (border > 0) return { area: 'paneBorder', pane: f.panes[border]!.id, border };
        return { area: x >= f.plotWidth ? 'priceAxis' : 'plot', pane: this.paneAt(f, y).id };
      },
      plotWidth: () => this.timeScale.width,
      setCrosshair: (x, y, source) => {
        this.crosshair = { x, y, source };
        this.invalidate(false);
      },
      clearCrosshair: () => {
        if (!this.crosshair) return;
        this.crosshair = null;
        this.invalidate(false);
      },
      panTime: (dx) => {
        this.timeScale.pan(dx);
        this.invalidate();
      },
      zoomTime: (anchorX, factor) => {
        this.timeScale.zoom(anchorX, factor);
        this.invalidate();
      },
      panPrice: (pane, dy) => {
        const scale = this.paneScale(pane);
        if (scale.autoScale || pane !== 'main') return;
        scale.pan(dy);
        this.invalidate();
      },
      scalePrice: (pane, factor) => {
        this.paneScale(pane).zoom(factor);
        this.invalidate();
      },
      resetPriceScale: (pane) => {
        this.paneScale(pane).autoScale = true;
        this.invalidate();
      },
      resetView: () => this.resetView(),
      resizePane: (index, dy) => this.resizePane(index, dy),
      contextMenu: (x, y) => {
        const f = this.frame;
        if (!this.emitter.has('contextMenu') || !f || x > f.plotWidth || y > f.panesHeight) return false;
        const pane = this.paneAt(f, y);
        const index = this.timeScale.xToIndex(x);
        const bar = this.store.at(index);
        this.emitter.emit('contextMenu', {
          x,
          y,
          pane: pane.id,
          price: pane.kind === 'main' ? roundToTick(this.mainScale.yToPrice(y), this.tickSize) : null,
          time: bar?.time ?? null,
        });
        return true;
      },
      resetPaneSizes: () => this.resetPaneSizes(),

      toolActive: () => (this.drawings.tool !== null || this.replaySelecting) && this.store.length > 0,
      hitObject: (x, y, touch) => {
        if (y > this.mainScale.height) return null;
        const tolerance = touch ? HIT_TOLERANCE.touch : HIT_TOLERANCE.mouse;
        return (
          this.trading.hitTest((p) => this.mainScale.priceToY(p), x, y, tolerance) ??
          this.drawings.hitTest(this.paneCoords(), x, y, tolerance)
        );
      },
      drawAt: (x, y) => {
        if (this.replaySelecting) {
          const bars = this.store.bars;
          this.startReplay(bars[Math.min(bars.length - 1, Math.max(0, this.timeScale.xToIndex(x)))]!.time);
          return;
        }
        this.drawings.createAt(this.paneCoords(), x, y);
      },
      drawPreview: (x, y) => {
        if (!this.replaySelecting) this.drawings.previewAt(this.paneCoords(), x, y);
      },
      drawRelease: (x, y, moved) => {
        if (!this.replaySelecting) this.drawings.releaseAt(this.paneCoords(), x, y, moved);
      },
      objectDown: (hit, x, y) => {
        this.objectDrag = hit;
        if (hit.kind === 'drawing') this.drawings.beginDrag(this.paneCoords(), hit.id, hit.part, x, y);
        else if (hit.kind === 'execution') this.setTooltip(hit.key); // tap shows details on touch
        else if (hit.part === 'line') this.trading.beginDrag(hit.id);
      },
      objectMove: (x, y) => {
        const hit = this.objectDrag;
        if (!hit) return;
        if (hit.kind === 'drawing') this.drawings.dragTo(this.paneCoords(), x, y);
        else if (hit.kind === 'order' && hit.part === 'line') {
          this.trading.dragTo(roundToTick(this.mainScale.yToPrice(y), this.tickSize));
        }
      },
      objectUp: (moved) => {
        const hit = this.objectDrag;
        this.objectDrag = null;
        if (!hit) return;
        if (hit.kind === 'drawing') this.drawings.endDrag(moved);
        else if (hit.kind === 'order' && hit.part === 'line') this.trading.endDrag();
        else if (hit.kind === 'order' && !moved) this.trading.cancel(hit.id);
      },
      hoverObject: (hit) => this.setTooltip(hit?.kind === 'execution' ? hit.key : null),
      clearSelection: () => {
        this.drawings.select(null);
        this.setTooltip(null);
      },
    };
  }

  /** Esc cancels a drawing in progress or deselects; Delete/Backspace removes the selected drawing. */
  private observeKeyboard(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key === 'Escape' && this.replaySelecting) {
        this.setReplaySelecting(false);
      } else if (e.key === 'Escape' && (this.drawings.tool || this.drawings.selectedId)) {
        this.drawings.cancel();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.drawings.selectedId) {
        e.preventDefault();
        this.drawings.remove(this.drawings.selectedId);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => document.removeEventListener('keydown', onKeyDown));
  }

  // ── Environment observers ──────────────────────────────────────────

  /** Repaints when the bar-close countdown ticks over (once a second, only while it shows or changes). */
  private observeCountdown(): void {
    const timer = setInterval(() => {
      if (this.destroyed || document.hidden) return;
      if (this.countdownText() !== this.countdownLabel) this.invalidate();
    }, 1000);
    this.cleanups.push(() => clearInterval(timer));
  }

  private observeSize(): void {
    const apply = (width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      if (width === this.size.width && height === this.size.height && dpr === this.size.dpr) return;
      this.size = { width, height, dpr };
      this.mainLayer.resize(width, height, dpr);
      this.overlayLayer.resize(width, height, dpr);
      this.invalidate();
    };

    const ro = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (rect) apply(Math.floor(rect.width), Math.floor(rect.height));
    });
    ro.observe(this.root);
    this.cleanups.push(() => ro.disconnect());

    // devicePixelRatio changes (browser zoom, moving between monitors) don't resize the element.
    let mq: MediaQueryList | null = null;
    const onDprChange = () => {
      apply(this.size.width, this.size.height);
      watchDpr();
    };
    const watchDpr = () => {
      mq?.removeEventListener('change', onDprChange);
      mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', onDprChange);
    };
    watchDpr();
    this.cleanups.push(() => mq?.removeEventListener('change', onDprChange));

    const rect = this.root.getBoundingClientRect();
    apply(Math.floor(rect.width), Math.floor(rect.height));
  }

  /** Theme values using `var(--x)` follow the host page's dark-mode / theme switches automatically. */
  private observeThemeVariables(): void {
    const onChange = () => {
      const t = this.theme;
      if (!Object.values(t).some((v) => typeof v === 'string' && v.includes('var('))) return;
      this.refreshTheme();
    };
    const mo = new MutationObserver(onChange);
    for (const el of [document.documentElement, document.body]) {
      if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onChange);
    this.cleanups.push(() => {
      mo.disconnect();
      mq.removeEventListener('change', onChange);
    });
  }
}
