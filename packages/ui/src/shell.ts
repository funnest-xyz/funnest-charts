import { darkTheme, directionColors, lightTheme, type DirectionPreset, type Resolution, type ThemeTokens } from '@funnest/charts';
import type { UiState } from './context';
import { createStorage, type WidgetStorage } from './storage';
import type { Store } from './store';
import { injectStyles } from './styles';

export type ColorScheme = 'light' | 'dark' | 'system';

/**
 * Empty elements inside the widget layout where the host app mounts its own UI (any framework):
 * market stats, account info, status bars… They inherit the widget's `--fnc-*` theme variables
 * and collapse when empty.
 */
export interface TradingChartSlots {
  /** In the toolbar row, after the interval buttons. */
  readonly toolbar: HTMLElement;
  /** Right end of the toolbar, next to the settings (gear) button — for extra icon buttons. */
  readonly toolbarEnd: HTMLElement;
  /** A full-width row under the toolbar. */
  readonly belowToolbar: HTMLElement;
  /**
   * Under the chart, right of the drawing bar — for an account/positions panel that should
   * line up with the chart while the drawing bar keeps the full height (TradingView-style).
   * The host sets its height.
   */
  readonly bottom: HTMLElement;
  /** A full-width row under everything (status bar). */
  readonly footer: HTMLElement;
}

const THEME_VARS: Partial<Record<keyof ThemeTokens, string>> = {
  background: '--fnc-bg',
  surface: '--fnc-surface',
  text: '--fnc-text',
  textSecondary: '--fnc-text-2',
  border: '--fnc-border',
  up: '--fnc-up',
  down: '--fnc-down',
  accent: '--fnc-accent',
  fontFamily: '--fnc-font',
};

function applyThemeVars(el: HTMLElement, theme: ThemeTokens): void {
  for (const [key, cssVar] of Object.entries(THEME_VARS) as [keyof ThemeTokens, string][]) {
    el.style.setProperty(cssVar, String(theme[key]));
  }
  el.style.setProperty('--fnc-radius', `${theme.radius}px`);
}

export function div(className: string, parent?: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  parent?.appendChild(el);
  return el;
}

/** What the shell needs from a chart pane (see pane.tsx). */
export interface ShellPane {
  readonly store: Store<UiState>;
  readonly chart: { setTheme(theme: Partial<ThemeTokens>): void };
}

export interface ShellOptions {
  colorScheme: ColorScheme;
  theme: Partial<ThemeTokens> | undefined;
  /** Up/down colors under `theme` (TradingChartOptions.direction, resolved from the locale). */
  direction: DirectionPreset;
  storageKey: string | null;
  drawingToolbar: boolean;
  favoriteIntervals: readonly Resolution[];
  onFavoriteIntervalsChange?: ((intervals: Resolution[]) => void) | undefined;
}

/**
 * The frame around one or more chart panes: root element with theme variables, toolbar host,
 * slots, drawing-bar host, fullscreen, and the preferences every pane shares (favorite
 * intervals, folded drawing bar). Panes register through `setPanes`.
 */
export interface Shell {
  readonly root: HTMLElement;
  readonly toolbarHost: HTMLElement;
  readonly body: HTMLElement;
  readonly drawbarHost: HTMLElement | null;
  /** Column right of the drawing bar: put the chart stage (or pane grid) here, before `slots.bottom`. */
  readonly main: HTMLElement;
  readonly slots: TradingChartSlots;
  readonly storage: WidgetStorage;
  theme(): ThemeTokens;
  /** Initial UI-state fields owned by the shell (same for every pane). */
  sharedState(): Pick<UiState, 'fullscreen' | 'favoriteIntervals' | 'drawbarCollapsed'>;
  setPanes(panes: () => readonly ShellPane[]): void;
  setTheme(patch: Partial<ThemeTokens>): void;
  setColorScheme(scheme: ColorScheme): void;
  isFullscreen(): boolean;
  toggleFullscreen(): void;
  setDrawbarCollapsed(collapsed: boolean): void;
  toggleFavoriteInterval(resolution: Resolution): void;
  destroy(): void;
}

/**
 * One tooltip per widget for every element with `data-tip` (instead of native `title`, whose look
 * and delay can't be styled). Shows after 350ms of hover or on keyboard focus; moving between
 * tipped elements shows the next one at once. Sides: right of the drawing bar, above the
 * navigation buttons, otherwise below (flipped up near the bottom edge).
 */
function bindTooltips(root: HTMLElement): () => void {
  const tip = div('fnc-tip', root);
  tip.setAttribute('role', 'tooltip');
  tip.id = `fnc-tip-${Math.random().toString(36).slice(2, 8)}`;
  let current: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenAt = 0;

  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let side: 'right' | 'top' | 'bottom' = el.closest('.fnc-drawbar') ? 'right' : el.closest('.fnc-nav') ? 'top' : 'bottom';
    if (side === 'bottom' && r.bottom + h + 10 > vh) side = 'top';
    let left = side === 'right' ? r.right + 8 : r.left + r.width / 2 - w / 2;
    const top = side === 'right' ? r.top + r.height / 2 - h / 2 : side === 'top' ? r.top - h - 6 : r.bottom + 6;
    left = Math.max(4, Math.min(vw - w - 4, left));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.dataset.side = side;
  };
  const show = (el: HTMLElement) => {
    const text = el.dataset.tip;
    if (!text || !el.isConnected) return;
    tip.textContent = text;
    el.setAttribute('aria-describedby', tip.id);
    place(el);
    tip.classList.add('is-on');
  };
  const hide = () => {
    clearTimeout(timer);
    if (tip.classList.contains('is-on')) hiddenAt = Date.now();
    tip.classList.remove('is-on');
    current?.removeAttribute('aria-describedby');
    current = null;
  };
  const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip]') : null);

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = target(e);
    if (el === current) return;
    hide();
    if (!el || !root.contains(el)) return;
    current = el;
    // Sliding from one button to the next shouldn't wait again.
    timer = setTimeout(() => show(el), Date.now() - hiddenAt < 300 ? 0 : 350);
  };
  const onFocus = (e: FocusEvent) => {
    const el = target(e);
    if (!el || !(e.target as HTMLElement).matches?.(':focus-visible')) return;
    hide();
    current = el;
    show(el);
  };
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerleave', hide);
  root.addEventListener('pointerdown', hide, true);
  root.addEventListener('wheel', hide, { passive: true });
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', hide);
  return () => {
    hide();
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', hide);
    root.removeEventListener('pointerdown', hide, true);
    root.removeEventListener('wheel', hide);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('focusout', hide);
    tip.remove();
  };
}

export function createShell(container: HTMLElement, options: ShellOptions): Shell {
  injectStyles(container.ownerDocument);
  const storage = createStorage(options.storageKey);
  const win = container.ownerDocument.defaultView;
  const darkQuery = win?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  let scheme = options.colorScheme;
  let themePatch: Partial<ThemeTokens> = { ...options.theme };
  let panes: () => readonly ShellPane[] = () => [];
  const isDark = () => (scheme === 'system' ? !!darkQuery?.matches : scheme === 'dark');
  const resolveTheme = (): ThemeTokens => ({ ...(isDark() ? darkTheme : lightTheme), ...directionColors(options.direction), ...themePatch });
  let theme = resolveTheme();

  const root = div('fnc-root', container);
  const applyScheme = () => {
    root.dataset.colorScheme = isDark() ? 'dark' : 'light';
    root.style.colorScheme = isDark() ? 'dark' : 'light';
    applyThemeVars(root, theme);
  };
  applyScheme();
  const toolbarHost = div('fnc-toolbar-host', root);
  const slots: TradingChartSlots = {
    toolbar: div('fnc-slot fnc-slot-toolbar'),
    toolbarEnd: div('fnc-slot fnc-slot-toolbar-end'),
    belowToolbar: div('fnc-slot fnc-slot-below-toolbar', root),
    bottom: div('fnc-slot fnc-slot-bottom'),
    footer: div('fnc-slot fnc-slot-footer'),
  };
  const unbindTips = bindTooltips(root);
  const body = div('fnc-body', root);
  const drawbarHost = options.drawingToolbar ? div('fnc-drawbar-host', body) : null;
  const main = div('fnc-main', body);
  main.appendChild(slots.bottom);
  root.appendChild(slots.footer);

  const refreshScheme = () => {
    theme = resolveTheme();
    applyScheme();
    for (const p of panes()) p.chart.setTheme(theme);
  };
  const onSchemeChange = () => scheme === 'system' && refreshScheme();
  darkQuery?.addEventListener?.('change', onSchemeChange);

  let favoriteIntervals = storage.get<Resolution[]>('favorite-intervals', [...options.favoriteIntervals]);
  let drawbarCollapsed = storage.get('drawbar-collapsed', false);
  const broadcast = (patch: Partial<UiState>) => {
    for (const p of panes()) p.store.set(patch);
  };

  // ── Fullscreen (native API with a CSS fallback for iOS Safari) ──
  const isNativeFullscreen = () => document.fullscreenElement === root;
  const isFullscreen = () => isNativeFullscreen() || root.classList.contains('fnc-pseudo-fullscreen');
  const onFullscreenChange = () => broadcast({ fullscreen: isFullscreen() });
  document.addEventListener('fullscreenchange', onFullscreenChange);
  const pseudo = (on: boolean) => {
    root.classList.toggle('fnc-pseudo-fullscreen', on);
    onFullscreenChange();
  };

  return {
    root,
    toolbarHost,
    body,
    drawbarHost,
    main,
    slots,
    storage,
    theme: () => theme,
    sharedState: () => ({ fullscreen: isFullscreen(), favoriteIntervals, drawbarCollapsed }),
    setPanes: (get) => {
      panes = get;
    },
    setTheme: (patch) => {
      themePatch = { ...themePatch, ...patch };
      refreshScheme();
    },
    setColorScheme: (next) => {
      scheme = next;
      refreshScheme();
    },
    isFullscreen,
    toggleFullscreen: () => {
      if (isNativeFullscreen()) void document.exitFullscreen();
      else if (root.classList.contains('fnc-pseudo-fullscreen')) pseudo(false);
      else if (root.requestFullscreen && document.fullscreenEnabled) root.requestFullscreen().catch(() => pseudo(true));
      else pseudo(true);
    },
    setDrawbarCollapsed: (collapsed) => {
      drawbarCollapsed = collapsed;
      storage.set('drawbar-collapsed', collapsed);
      broadcast({ drawbarCollapsed });
    },
    toggleFavoriteInterval: (res) => {
      favoriteIntervals = favoriteIntervals.includes(res) ? favoriteIntervals.filter((r) => r !== res) : [...favoriteIntervals, res];
      storage.set('favorite-intervals', favoriteIntervals);
      broadcast({ favoriteIntervals });
      options.onFavoriteIntervalsChange?.(favoriteIntervals);
    },
    destroy: () => {
      unbindTips();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      darkQuery?.removeEventListener?.('change', onSchemeChange);
      if (isNativeFullscreen()) void document.exitFullscreen();
      root.remove();
    },
  };
}

/**
 * Ctrl/⌘+K and Escape handling for the pane that currently owns the toolbar.
 * Returns a cleanup function.
 */
export function bindWidgetKeys(
  shell: Shell,
  active: () => { store: Store<UiState>; canSearch: boolean; chart: { undo(): void; redo(): void } } | null,
  searchHotkey: boolean,
  extra?: (e: KeyboardEvent) => boolean,
): () => void {
  const { root } = shell;
  // Undo/redo only when the user last clicked inside this widget (pages may host several, or forms).
  let focused = false;
  const onPointerDown = (e: PointerEvent) => (focused = root.contains(e.target as Node));
  const onKeyDown = (e: KeyboardEvent) => {
    const pane = active();
    if (!pane) return;
    const s = pane.store.get();
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const key = e.key.toLowerCase();
    if (focused && !typing && !s.dialog && !s.searchOpen && (e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) pane.chart.redo();
      else pane.chart.undo();
      return;
    }
    // Ctrl/⌘ + K opens symbol search from anywhere on the page.
    if (searchHotkey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && pane.canSearch && !s.dialog) {
      e.preventDefault();
      pane.store.set({ searchOpen: true });
      return;
    }
    // Escape closes the top-most layer even when focus has left the dialog (clicking empty
    // space inside a dialog moves focus to <body>, so the dialog's own handler never sees it).
    if (e.key === 'Escape' && !e.defaultPrevented && (s.searchOpen || s.dialog)) {
      e.preventDefault();
      pane.store.set(s.searchOpen ? { searchOpen: false } : { dialog: null });
      return;
    }
    if (e.key === 'Escape' && root.classList.contains('fnc-pseudo-fullscreen') && !s.searchOpen && !s.dialog) {
      shell.toggleFullscreen();
      return;
    }
    if (extra?.(e)) e.preventDefault();
  };
  // Korean/Japanese IME: while composing, the first Escape only ends the composition and
  // keydown reports "Process" (keyCode 229). The key-up still says "Escape", so close then.
  const onKeyUp = (e: KeyboardEvent) => {
    const pane = active();
    if (!pane) return;
    const s = pane.store.get();
    if (e.key === 'Escape' && (s.searchOpen || s.dialog)) pane.store.set(s.searchOpen ? { searchOpen: false } : { dialog: null });
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('pointerdown', onPointerDown, true);
  };
}
