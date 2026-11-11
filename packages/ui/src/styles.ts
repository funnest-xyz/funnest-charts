/**
 * Widget styles, injected once per document. Everything is scoped under `.fnc-root`
 * and themed through `--fnc-*` custom properties (set from ThemeTokens), so the host
 * page's CSS is never touched and the host can override any token.
 */
const CSS = /* css */ `
.fnc-root {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--fnc-bg);
  color: var(--fnc-text);
  font-family: var(--fnc-font);
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
.fnc-root *, .fnc-root *::before, .fnc-root *::after { box-sizing: border-box; }
.fnc-root.fnc-pseudo-fullscreen { position: fixed; inset: 0; z-index: 2147483000; }
:where(.fnc-root) button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fnc-root button:focus-visible { outline: 2px solid var(--fnc-accent); outline-offset: 1px; }

/* ── Toolbar ─────────────────────────────────────────── */
.fnc-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 8px;
  border-bottom: 1px solid var(--fnc-border);
  flex: none;
}
.fnc-symbol {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  max-width: 220px;
  padding: 0 10px 0 8px;
  border-radius: var(--fnc-radius);
  font-weight: 700;
  font-size: 15px;
  /* The symbol gives way first when the toolbar is tight: its name truncates, never overlaps. */
  flex: 0 1 auto;
  min-width: 36px;
  overflow: hidden;
}
.fnc-symbol .fnc-icon { color: var(--fnc-text-2); display: flex; }
.fnc-symbol-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fnc-symbol:not(:disabled):hover, .fnc-btn:hover, .fnc-chip:hover { background: var(--fnc-surface); }
.fnc-symbol:disabled { cursor: default; }
.fnc-sep { width: 1px; height: 20px; background: var(--fnc-border); margin: 0 4px; flex: none; }
.fnc-intervals {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
}
.fnc-intervals::-webkit-scrollbar { display: none; }
.fnc-chip {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--fnc-radius);
  font-size: 13px;
  font-weight: 600;
  color: var(--fnc-text-2);
  white-space: nowrap;
  flex: none;
}
.fnc-chip[aria-pressed='true'] { color: var(--fnc-text); background: var(--fnc-surface); }
.fnc-spacer { flex: 1; min-width: 8px; }
.fnc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--fnc-radius);
  color: var(--fnc-text-2);
  flex: none;
}
.fnc-btn:hover { color: var(--fnc-text); }
.fnc-btn[aria-pressed='true'] { color: var(--fnc-text); background: var(--fnc-surface); }
.fnc-btn:disabled { opacity: 0.35; cursor: default; background: none; }
.fnc-btn-wide { width: auto; gap: 2px; padding: 0 6px 0 8px; }
.fnc-btn-drawbar { display: none; }
.fnc-btn-label { font-size: 13px; font-weight: 600; gap: 4px; padding: 0 10px 0 8px; }

.fnc-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  font-weight: 700;
  line-height: 1;
  background: var(--fnc-surface);
}

/* ── Menus ───────────────────────────────────────────── */
.fnc-menu-wrap { position: relative; flex: none; }
.fnc-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  padding: 6px;
  border-radius: 12px;
  background: var(--fnc-bg);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.16), 0 0 0 1px var(--fnc-border);
}
.fnc-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--fnc-radius);
  font-size: 14px;
  color: var(--fnc-text-2);
  text-align: left;
}
.fnc-menu-item:hover, .fnc-menu-item[aria-checked='true'] { background: var(--fnc-surface); color: var(--fnc-text); }

/* ── Chart body & overlays ───────────────────────────── */
.fnc-body { position: relative; display: flex; flex: 1; min-height: 0; }
.fnc-main { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.fnc-stage { position: relative; flex: 1; min-width: 0; min-height: 0; }
.fnc-slot-bottom { flex: none; min-width: 0; }
.fnc-chart-host, .fnc-overlay { position: absolute; inset: 0; }

/* ── Drawing tool bar (left) ─────────────────────────── */
.fnc-drawbar-host { flex: none; display: flex; }
.fnc-drawbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 48px;
  padding: 8px 0;
  border-right: 1px solid var(--fnc-border);
  background: var(--fnc-bg);
}
.fnc-hsep { width: 20px; height: 1px; background: var(--fnc-border); margin: 4px 0; }

/* Selected drawing: floating color/delete bar */
.fnc-selbar {
  position: absolute;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  transform: translateX(-50%);
  border-radius: calc(var(--fnc-radius) + 4px);
  background: var(--fnc-bg);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12), 0 0 0 1px var(--fnc-border);
  pointer-events: auto;
}
.fnc-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex: none;
}
.fnc-swatch[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--fnc-bg), 0 0 0 4px var(--fnc-text-2); }
.fnc-selbar .fnc-btn { width: 32px; height: 32px; }
.fnc-overlay { pointer-events: none; }
.fnc-overlay button { pointer-events: auto; }

.fnc-legend {
  position: absolute;
  left: 12px;
  top: 8px;
  right: 80px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--fnc-text-2);
  font-variant-numeric: tabular-nums;
}
.fnc-legend-title { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.fnc-legend-title b { color: var(--fnc-text); font-weight: 700; }
.fnc-legend-values { display: flex; flex-wrap: wrap; gap: 0 10px; }
.fnc-legend-values b { font-weight: 600; }
/* Indicator legend rows */
.fnc-ind {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
  min-height: 20px;
  pointer-events: auto;
  width: fit-content;
  max-width: 100%;
  border-radius: 6px;
}
.fnc-ind-title { color: var(--fnc-text-2); }
.fnc-ind-hidden .fnc-ind-title { opacity: 0.5; text-decoration: line-through; }
.fnc-ind-eye { margin-left: -4px; }
.fnc-ind-hidden .fnc-ind-eye { color: var(--fnc-text-2); opacity: 0.7; }
.fnc-ind-collapse, .fnc-ind-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  height: 20px;
  margin-top: 2px;
  border-radius: 6px;
  color: var(--fnc-text-2);
  pointer-events: auto;
}
.fnc-ind-collapse { width: 24px; margin-left: -4px; }
.fnc-ind-collapse:hover, .fnc-ind-handle:hover { background: var(--fnc-surface); color: var(--fnc-text); }
/* Collapsed: a small horizontal bar centered in a comfortable tap target. */
.fnc-ind-handle { width: 40px; margin-left: -6px; }
.fnc-ind-handle span { width: 24px; height: 4px; border-radius: 2px; background: currentColor; opacity: 0.55; }
.fnc-ind-handle:hover span { opacity: 0.9; }
.fnc-ind b { font-weight: 600; }
.fnc-ind-actions { display: inline-flex; gap: 2px; opacity: 0; transition: opacity 0.12s; }
.fnc-ind:hover .fnc-ind-actions, .fnc-ind:focus-within .fnc-ind-actions { opacity: 1; }
.fnc-ind-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--fnc-text-2);
}
.fnc-ind-btn:hover { background: var(--fnc-surface); color: var(--fnc-text); }
.fnc-ind { cursor: pointer; }
.fnc-ind:hover .fnc-ind-title { color: var(--fnc-text); }
/* Touch: no tiny icons; tapping the row opens settings (which can also remove). */
@media (hover: none) { .fnc-ind-actions { display: none; } }
.fnc-pane-legend { right: auto; }

/* ── Thin, quiet scrollbars for every scroll area in the widget ── */
.fnc-root .fnc-scroll, .fnc-root .fnc-menu, .fnc-root .fnc-dialog form {
  scrollbar-width: thin;
  scrollbar-color: var(--fnc-border) transparent;
}
.fnc-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.fnc-root ::-webkit-scrollbar-track { background: transparent; }
.fnc-root ::-webkit-scrollbar-thumb {
  background: var(--fnc-border);
  border-radius: 10px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.fnc-root ::-webkit-scrollbar-thumb:hover { background-color: var(--fnc-text-2); }

/* ── Interval picker ─────────────────────────────────── */
.fnc-interval-picker { position: relative; display: flex; align-items: center; min-width: 0; }
.fnc-interval-trigger { gap: 2px; padding: 0 6px; }
.fnc-interval-current { display: none; font-size: 13px; color: var(--fnc-text); }
.fnc-interval-trigger-active { background: var(--fnc-surface); }
.fnc-interval-trigger-active .fnc-interval-current { display: inline; }
.fnc-chip:disabled { opacity: 0.35; cursor: default; background: none; }
.fnc-interval-menu {
  width: 208px;
  max-height: min(440px, 70vh);
  overflow-y: auto;
  gap: 0;
}
.fnc-menu-group + .fnc-menu-group { border-top: 1px solid var(--fnc-border); margin-top: 4px; padding-top: 4px; }
.fnc-menu-title { padding: 8px 10px 4px; font-size: 11px; font-weight: 700; color: var(--fnc-text-2); letter-spacing: 0.02em; }
.fnc-menu-row { display: flex; align-items: center; border-radius: var(--fnc-radius); }
.fnc-menu-row:hover { background: var(--fnc-surface); }
.fnc-menu-row .fnc-menu-item { flex: 1; background: none; }
.fnc-menu-row .fnc-menu-item[aria-checked='true'] { color: var(--fnc-accent); font-weight: 700; }
.fnc-menu-item:disabled { opacity: 0.35; cursor: default; }
.fnc-star {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  color: var(--fnc-text-2);
  opacity: 0;
  transition: opacity 0.12s, color 0.12s;
}
.fnc-menu-row:hover .fnc-star, .fnc-star:focus-visible { opacity: 1; }
.fnc-star:hover { color: #FF9F0A; }
.fnc-menu-row.is-favorite .fnc-star { opacity: 1; color: #FF9F0A; }
@media (hover: none) { .fnc-star { opacity: 0.5; } }

/* Interval buttons keep their width; host content in the toolbar slot shrinks first. */
.fnc-interval-picker { flex: none; }

/* ── Slots: host-app UI inside the widget (collapse when empty) ── */
.fnc-slot:empty { display: none; }
.fnc-slot-host { display: flex; align-self: stretch; min-width: 0; flex: 0 1 auto; }
/* Buttons next to the gear keep their size (they'd otherwise slide under it on phones). */
.fnc-slot-host-fixed { flex: none; }
.fnc-slot-toolbar { position: relative; display: flex; align-items: center; min-width: 0; padding-left: 9px; margin-left: 4px; }
.fnc-slot-toolbar::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 1px;
  height: 20px;
  margin-top: -10px;
  background: var(--fnc-border);
}
.fnc-slot-below-toolbar, .fnc-slot-footer { flex: none; min-width: 0; }
.fnc-slot-toolbar-end { display: flex; align-items: center; gap: 2px; flex: none; }

/* ── Drawing bar fold (desktop) ── */
.fnc-drawbar .fnc-spacer { flex: 1; min-height: 8px; }
.fnc-drawbar[data-collapsed='true'] { display: none; }
.fnc-drawbar-tab {
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 56px;
  border: 1px solid var(--fnc-border);
  border-left: 0;
  border-radius: 0 8px 8px 0;
  color: var(--fnc-text-2);
  background: var(--fnc-bg);
}
.fnc-drawbar-tab:hover { color: var(--fnc-text); background: var(--fnc-surface); }

/* ── Symbol search ───────────────────────────────────── */
.fnc-dialog.fnc-search-dialog { width: min(880px, calc(100% - 32px)); height: min(640px, 100%); max-height: none; }
.fnc-sr-body { display: flex; flex: 1; min-height: 0; }
.fnc-sr-side {
  width: 196px;
  flex: none;
  padding: 8px;
  border-right: 1px solid var(--fnc-border);
  overflow-y: auto;
}
.fnc-sr-side-title { padding: 12px 10px 6px; font-size: 12px; font-weight: 700; color: var(--fnc-text-2); }
.fnc-sr-side-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--fnc-radius);
  font-size: 14px;
  color: var(--fnc-text);
  text-align: left;
}
.fnc-sr-side-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fnc-sr-side-item em { font-style: normal; font-size: 12px; color: var(--fnc-text-2); }
.fnc-sr-side-item:hover { background: var(--fnc-surface); }
.fnc-sr-side-item[aria-pressed='true'] { background: var(--fnc-surface); font-weight: 700; }
.fnc-chip-token {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  height: 28px;
  padding: 0 4px 0 10px;
  border: 1px solid var(--fnc-border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--fnc-text);
}
.fnc-chip-token button { display: flex; color: var(--fnc-text-2); }
.fnc-chip-token button:hover { color: var(--fnc-text); }
.fnc-kbd {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--fnc-border);
  border-radius: 6px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: var(--fnc-text-2);
  background: var(--fnc-surface);
}
.fnc-sr-star {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  margin-right: -4px;
  color: var(--fnc-text-2);
  opacity: 0.45;
  border-radius: 6px;
}
.fnc-sr-star:hover { opacity: 1; color: #ff9f0a; }
.fnc-sr-star.is-on { opacity: 1; color: #ff9f0a; }
.fnc-sr-spark { flex: none; }
.fnc-sr-quote { display: flex; flex-direction: column; align-items: flex-end; flex: none; min-width: 84px; line-height: 1.25; font-variant-numeric: tabular-nums; }
.fnc-sr-quote b { font-size: 14px; font-weight: 700; }
.fnc-sr-quote span { font-size: 12px; font-weight: 600; }
.fnc-search mark { background: none; color: var(--fnc-accent); font-weight: 700; }
.fnc-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--fnc-border);
  overflow-x: auto;
  scrollbar-width: none;
  flex: none;
}
.fnc-tabs::-webkit-scrollbar { display: none; }
.fnc-tab {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fnc-text-2);
  white-space: nowrap;
  flex: none;
}
.fnc-tab:hover { color: var(--fnc-text); }
.fnc-tab[aria-selected='true'] { background: var(--fnc-text); color: var(--fnc-bg); }
.fnc-sr-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 8px; }
.fnc-sr-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--fnc-text-2);
}
.fnc-link { font-size: 12px; color: var(--fnc-text-2); }
.fnc-link:hover { color: var(--fnc-text); text-decoration: underline; }
.fnc-sr-row {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px;
  border-radius: 12px;
  cursor: pointer;
}
.fnc-sr-row[aria-selected='true'] { background: var(--fnc-surface); }
.fnc-sr-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.fnc-sr-name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fnc-sr-meta { font-size: 12px; color: var(--fnc-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fnc-sr-name mark, .fnc-sr-meta mark { background: none; color: var(--fnc-accent); font-weight: 700; }
.fnc-sr-current { margin-left: 6px; font-size: 11px; font-weight: 700; color: var(--fnc-accent); }
.fnc-sr-skeleton {
  height: 48px;
  margin: 8px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--fnc-surface) 0%, var(--fnc-bg) 50%, var(--fnc-surface) 100%);
  background-size: 200% 100%;
  animation: fnc-shimmer 1.2s ease-in-out infinite;
}
@keyframes fnc-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.fnc-sr-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--fnc-border);
  font-size: 12px;
  color: var(--fnc-text-2);
  flex: none;
}

/* Tooltip (data-tip). Hosts can restyle it with --fnc-tip-bg / --fnc-tip-text. */
.fnc-tip {
  position: fixed;
  z-index: 2147483001;
  max-width: 240px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--fnc-tip-bg, #24242b);
  color: var(--fnc-tip-text, #f2f2f4);
  font-family: var(--fnc-font);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.28);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms cubic-bezier(0.4, 0, 1, 1), transform 120ms cubic-bezier(0.4, 0, 1, 1), visibility 0s 120ms;
}
.fnc-tip[data-side='bottom'] { transform: translateY(-4px); }
.fnc-tip[data-side='top'] { transform: translateY(4px); }
.fnc-tip[data-side='right'] { transform: translateX(-4px); }
.fnc-tip.is-on {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1), visibility 0s;
}
@media (prefers-reduced-motion: reduce) { .fnc-tip, .fnc-tip.is-on { transform: none; } }
@media (hover: none) { .fnc-tip { display: none; } }

.fnc-tools { display: flex; align-items: center; gap: 4px; flex: none; }
/* Right-hand menus open toward the left so they stay on screen. */
.fnc-tools .fnc-menu { left: auto; right: 0; }
.fnc-kbd-btn { cursor: pointer; }
.fnc-kbd-btn:hover, .fnc-sr-foot-btn:hover { color: var(--fnc-text); }
.fnc-sr-foot-btn { display: inline-flex; align-items: center; gap: 4px; font-size: inherit; color: inherit; cursor: pointer; }

.fnc-up { color: var(--fnc-up); }
.fnc-down { color: var(--fnc-down); }
.fnc-flat { color: var(--fnc-text); }
.fnc-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--fnc-border);
  border-top-color: var(--fnc-text-2);
  border-radius: 50%;
  animation: fnc-spin 0.8s linear infinite;
}
@keyframes fnc-spin { to { transform: rotate(360deg); } }

.fnc-attribution {
  position: absolute;
  left: 10px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px 0 4px;
  border-radius: 14px;
  color: var(--fnc-text);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -0.3px;
  text-decoration: none;
  pointer-events: auto;
  opacity: 0.85;
  transition: opacity 0.15s, background 0.15s;
}
.fnc-attribution:hover { opacity: 1; background: var(--fnc-bg); box-shadow: 0 0 0 1px var(--fnc-border); }
.fnc-attribution svg { flex: none; }
.fnc-attribution span { max-width: 0; overflow: hidden; transition: max-width 0.2s; }
.fnc-attribution:hover span, .fnc-attribution:focus-visible span { max-width: 80px; }

.fnc-nav {
  position: absolute;
  display: flex;
  gap: 4px;
  padding: 4px;
  transform: translateX(-50%);
  border-radius: calc(var(--fnc-radius) + 4px);
  background: var(--fnc-bg);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12), 0 0 0 1px var(--fnc-border);
  opacity: 0;
  transition: opacity 0.15s;
}
.fnc-body:hover .fnc-nav, .fnc-nav:focus-within { opacity: 1; }
.fnc-nav .fnc-btn { width: 32px; height: 32px; }
.fnc-realtime {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--fnc-bg);
  color: var(--fnc-text);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12), 0 0 0 1px var(--fnc-border);
}
@media (hover: none) {
  .fnc-nav { display: none; }
}

/* ── Symbol search ───────────────────────────────────── */
.fnc-backdrop {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
  background: rgb(0 0 0 / 0.32);
}
.fnc-dialog {
  display: flex;
  flex-direction: column;
  width: min(480px, calc(100% - 32px));
  max-height: min(560px, 100%);
  border-radius: 16px;
  background: var(--fnc-bg);
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.2);
  overflow: hidden;
}
.fnc-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--fnc-border);
  color: var(--fnc-text-2);
}
.fnc-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fnc-text);
  font: inherit;
  font-size: 16px;
}
.fnc-search input::placeholder { color: var(--fnc-text-2); }
.fnc-dialog-wide { width: min(600px, calc(100% - 32px)); }
.fnc-dialog form { overflow-y: auto; }
.fnc-section { font-size: 12px; font-weight: 700; color: var(--fnc-text-2); margin-top: 2px; }
.fnc-rows { display: flex; flex-direction: column; gap: 8px; }
.fnc-row { display: flex; align-items: center; gap: 8px; min-height: 40px; }
.fnc-row-label { width: 44px; flex: none; font-size: 13px; color: var(--fnc-text-2); white-space: nowrap; }
.fnc-row-label-wide { width: 88px; }
.fnc-check { width: 18px; height: 18px; flex: none; accent-color: var(--fnc-accent); margin: 0; cursor: pointer; }
.fnc-color {
  width: 32px;
  height: 32px;
  flex: none;
  padding: 0;
  border: 1px solid var(--fnc-border);
  border-radius: var(--fnc-radius);
  background: none;
  cursor: pointer;
}
.fnc-color::-webkit-color-swatch-wrapper { padding: 3px; }
.fnc-color::-webkit-color-swatch { border: 0; border-radius: 4px; }
.fnc-select, .fnc-input {
  height: 40px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--fnc-border);
  border-radius: var(--fnc-radius);
  background: var(--fnc-bg);
  color: var(--fnc-text);
  font: inherit;
  font-size: 14px;
  outline: none;
}
.fnc-select:focus, .fnc-input:focus { border-color: var(--fnc-accent); }
.fnc-input { flex: 1; font-size: 16px; }
.fnc-input-period { flex: 0 0 72px; text-align: right; }
.fnc-select-width { flex: 0 0 72px; }
.fnc-select-source { flex: 1; }
.fnc-toggle-row { justify-content: space-between; min-height: 36px; cursor: pointer; font-size: 14px; }
.fnc-switch {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 40px;
  height: 24px;
  flex: none;
  margin: 0;
  border-radius: 12px;
  background: var(--fnc-border);
  cursor: pointer;
  transition: background 0.15s;
}
.fnc-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  transition: transform 0.15s;
}
.fnc-switch:checked { background: var(--fnc-accent); }
.fnc-switch:checked::after { transform: translateX(16px); }
.fnc-switch:focus-visible { outline: 2px solid var(--fnc-accent); outline-offset: 2px; }
.fnc-add-row {
  height: 40px;
  border: 1px dashed var(--fnc-border);
  border-radius: var(--fnc-radius);
  color: var(--fnc-text-2);
  font-size: 14px;
  font-weight: 600;
}
.fnc-add-row:hover { color: var(--fnc-text); border-color: var(--fnc-text-2); }
.fnc-empty { padding: 32px 16px; text-align: center; color: var(--fnc-text-2); }
.fnc-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 8px 0 20px;
  border-bottom: 1px solid var(--fnc-border);
  font-size: 16px;
}
.fnc-group { padding: 12px 12px 4px; font-size: 12px; font-weight: 600; color: var(--fnc-text-2); }
.fnc-form { display: flex; flex-direction: column; gap: 14px; padding: 20px; }
.fnc-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--fnc-text-2); }
.fnc-field input {
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--fnc-border);
  border-radius: var(--fnc-radius);
  background: var(--fnc-bg);
  color: var(--fnc-text);
  font: inherit;
  font-size: 16px;
  outline: none;
}
.fnc-field input:focus { border-color: var(--fnc-accent); }
/* Actions stay pinned to the bottom of long, scrolling dialogs (indicator / chart settings). */
.fnc-form-actions {
  position: sticky;
  bottom: -20px;
  display: flex;
  gap: 8px;
  margin: 6px -20px -20px;
  padding: 12px 20px 20px;
  border-top: 1px solid var(--fnc-border);
  background: var(--fnc-bg);
}
.fnc-action {
  flex: 1;
  height: 48px;
  border-radius: var(--fnc-radius);
  background: var(--fnc-surface);
  font-size: 15px;
  font-weight: 600;
}
.fnc-action-primary { background: var(--fnc-accent); color: #fff; }
.fnc-action-danger { flex: 0 0 auto; padding: 0 16px; color: var(--fnc-danger, #F04452); background: none; }

/* ── Narrow widgets (split screens next to side panels): the widget's own width decides, so
   every toolbar button stays reachable. Ctrl/⌘+Z still undoes when the buttons are hidden. ── */
.fnc-root { container: fnc / inline-size; }
@container fnc (max-width: 1100px) {
  .fnc-btn-label span { display: none; }
  .fnc-toolbar .fnc-btn-label { padding: 0 6px; }
}
@container fnc (max-width: 940px) {
  .fnc-intervals { display: none; }
  .fnc-interval-current { display: inline; }
}

/* ── Narrow phones (≤ 400px): drop the menu chevrons and separators so every button fits ── */
@media (max-width: 400px) {
  .fnc-toolbar .fnc-btn-wide > svg:last-child { display: none; }
  .fnc-toolbar .fnc-btn-wide { padding: 0 3px; }
  .fnc-toolbar > .fnc-sep { display: none; }
  .fnc-toolbar > .fnc-spacer { min-width: 0; }
}

/* ── Multi-chart (split panes) ──────────────────────── */
.fnc-grid { display: flex; flex: 1; min-width: 0; min-height: 0; }
.fnc-split { display: flex; min-width: 0; min-height: 0; }
.fnc-split-row { flex-direction: row; }
.fnc-split-col { flex-direction: column; }
.fnc-pane { position: relative; display: flex; min-width: 0; min-height: 0; }
.fnc-pane > .fnc-stage { flex: 1; min-height: 0; }
.fnc-split-on .fnc-pane-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--fnc-text-2);
  pointer-events: none;
  z-index: 3;
}
.fnc-splitter { position: relative; flex: none; background: var(--fnc-border); z-index: 4; touch-action: none; }
.fnc-splitter::after { content: ''; position: absolute; }
.fnc-splitter-row { width: 1px; cursor: col-resize; }
.fnc-splitter-row::after { inset: 0 -4px; }
.fnc-splitter-col { height: 1px; cursor: row-resize; }
.fnc-splitter-col::after { inset: -4px 0; }
.fnc-splitter:hover { background: var(--fnc-text-2); }
.fnc-resizing-x, .fnc-resizing-x * { cursor: col-resize !important; user-select: none; }
.fnc-resizing-y, .fnc-resizing-y * { cursor: row-resize !important; user-select: none; }
.fnc-parking { display: none; }
/* Navigation controls follow the hovered pane, not the whole widget. */
.fnc-multi .fnc-body:hover .fnc-nav { opacity: 0; }
.fnc-multi .fnc-stage:hover .fnc-nav, .fnc-multi .fnc-nav:focus-within { opacity: 1; }
.fnc-pane-max {
  position: absolute;
  top: 6px;
  width: 28px;
  height: 28px;
  opacity: 0;
  background: var(--fnc-bg);
  pointer-events: auto;
  z-index: 2;
}
.fnc-stage:hover .fnc-pane-max, .fnc-pane-max:focus-visible, .fnc-pane-max[aria-pressed='true'] { opacity: 1; }
@media (hover: none) { .fnc-pane-max { opacity: 0.7; } }
.fnc-pane-tabs {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--fnc-border);
}
.fnc-pane-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 30px;
  padding: 0 10px 0 6px;
  border-radius: var(--fnc-radius);
  font-size: 13px;
  font-weight: 600;
  color: var(--fnc-text-2);
  white-space: nowrap;
}
.fnc-pane-tab small { font-size: 12px; font-weight: 400; color: var(--fnc-text-2); }
.fnc-pane-tab[aria-selected='true'] { background: var(--fnc-surface); color: var(--fnc-text); }
.fnc-pane-tab-num {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: var(--fnc-surface);
  font-size: 11px;
}
.fnc-pane-tab[aria-selected='true'] .fnc-pane-tab-num { background: var(--fnc-text-2); color: var(--fnc-bg); }
.fnc-layout-menu { min-width: 0; gap: 2px; padding: 8px; }
.fnc-layout-row { display: flex; align-items: center; gap: 2px; }
.fnc-layout-count { width: 16px; flex: none; font-size: 12px; color: var(--fnc-text-2); text-align: center; }
.fnc-layout-opt {
  display: grid;
  place-items: center;
  width: 36px;
  height: 32px;
  border-radius: var(--fnc-radius);
  color: var(--fnc-text-2);
}
.fnc-layout-opt:hover { background: var(--fnc-surface); color: var(--fnc-text); }
.fnc-layout-opt[aria-checked='true'] { background: var(--fnc-surface); color: var(--fnc-text); }
.fnc-sync-menu { min-width: 220px; }
.fnc-menu-title { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px 8px; font-size: 13px; font-weight: 600; color: var(--fnc-text); }
.fnc-menu-title small { font-size: 12px; font-weight: 400; color: var(--fnc-text-2); }
.fnc-sync-item { justify-content: space-between; }
.fnc-sync-item[aria-checked='true'] { background: none; color: var(--fnc-text); }
.fnc-sync-item:hover { background: var(--fnc-surface); }
.fnc-sync-item .fnc-switch { display: inline-block; transform: scale(0.8); transform-origin: right center; }
.fnc-switch[data-on='true'] { background: var(--fnc-text-2); }
.fnc-switch[data-on='true']::after { transform: translateX(16px); }

/* ── Right-click menu ────────────────────────────────── */
.fnc-ctx-menu { top: 0; left: 0; z-index: 40; min-width: 220px; pointer-events: auto; }
.fnc-ctx-menu .fnc-menu-item { justify-content: space-between; gap: 24px; color: var(--fnc-text); }
.fnc-ctx-menu .fnc-menu-item:disabled { color: var(--fnc-text-2); }
.fnc-ctx-menu kbd { font: inherit; font-size: 12px; color: var(--fnc-text-2); }
.fnc-ctx-sep { height: 1px; margin: 4px 6px; background: var(--fnc-border); }

/* ── 도구 menu: chart type, split, compare, replay, axis, screenshot, settings ── */
.fnc-tools-menu { width: 300px; padding: 8px; gap: 2px; max-height: 72vh; overflow-y: auto; }
.fnc-tools-section { padding: 8px 6px 6px; font-size: 12px; font-weight: 700; color: var(--fnc-text-2); }
.fnc-tools-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin: 0 2px 4px; }
.fnc-tools-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 0; padding: 0 6px; }
.fnc-tools-seg svg { width: 16px; height: 16px; flex: none; }
.fnc-tools-layouts { display: flex; flex-direction: column; gap: 2px; padding: 0 2px 4px; }
.fnc-tools-sep { height: 1px; margin: 6px 4px; background: var(--fnc-border); }
.fnc-tools-item svg { flex: none; color: var(--fnc-text-2); }
.fnc-tools-item[aria-pressed='true'] { background: var(--fnc-surface); color: var(--fnc-text); }

/* ── Drawing tool groups ─────────────────────────────── */
.fnc-tool-group { position: relative; display: flex; }
.fnc-tool-group[data-open='true'] { z-index: 30; }
.fnc-tool-more {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  width: 14px;
  height: 14px;
  padding: 3px;
  color: var(--fnc-text-2);
  opacity: 0.7;
}
.fnc-tool-more:hover, .fnc-tool-more[aria-expanded='true'] { opacity: 1; color: var(--fnc-text); }
.fnc-tool-menu { top: 0; left: calc(100% + 8px); min-width: 200px; max-height: min(640px, calc(100vh - 120px)); overflow-y: auto; }
.fnc-tool-section { padding: 8px 10px 4px; color: var(--fnc-text-2); font-size: 11px; font-weight: 600; }
.fnc-tool-section.is-after { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--fnc-border); }
.fnc-tool-menu .fnc-menu-item { white-space: nowrap; }
.fnc-tool-letter { font-size: 13px; font-weight: 700; }
.fnc-svg-icon { display: inline-flex; }
.fnc-svg-icon svg { width: 20px; height: 20px; }

/* ── Segmented control (price scale, replay speed) ──── */
.fnc-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: calc(var(--fnc-radius) + 2px); background: var(--fnc-surface); }
.fnc-seg button {
  min-width: 56px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--fnc-radius);
  font-size: 13px;
  color: var(--fnc-text-2);
}
.fnc-seg button[aria-checked='true'] { background: var(--fnc-bg); color: var(--fnc-text); font-weight: 700; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
.fnc-seg-sm button { min-width: 36px; height: 26px; padding: 0 6px; font-size: 12px; }

/* ── Chart themes (settings dialog) ──────────────────── */
.fnc-themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; padding: 2px 0 6px; }
.fnc-theme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--fnc-radius);
  font-size: 12px;
  color: var(--fnc-text-2);
}
.fnc-theme:hover { background: var(--fnc-surface); }
.fnc-theme[aria-checked='true'] { border-color: var(--fnc-text-2); color: var(--fnc-text); font-weight: 700; }
.fnc-theme-swatch { width: 56px; height: 36px; display: block; }

/* ── Compare legend rows ─────────────────────────────── */
.fnc-cmp { display: flex; align-items: center; gap: 6px; min-height: 22px; font-size: 12px; color: var(--fnc-text-2); pointer-events: auto; }
.fnc-cmp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.fnc-cmp-name { color: var(--fnc-text); }
.fnc-cmp b { color: var(--fnc-text); font-weight: 600; font-variant-numeric: tabular-nums; }
.fnc-cmp .fnc-ind-btn { opacity: 0; }
.fnc-cmp:hover .fnc-ind-btn, .fnc-cmp .fnc-ind-btn:focus-visible { opacity: 1; }
@media (hover: none) { .fnc-cmp .fnc-ind-btn { opacity: 1; } }

/* ── Replay ──────────────────────────────────────────── */
.fnc-replay {
  position: absolute;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  transform: translateX(-50%);
  border-radius: calc(var(--fnc-radius) + 4px);
  background: var(--fnc-bg);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12), 0 0 0 1px var(--fnc-border);
  white-space: nowrap;
  pointer-events: auto;
}
.fnc-replay .fnc-btn { width: 32px; height: 32px; }
.fnc-replay .fnc-sep { height: 20px; margin: 0 2px; }
.fnc-replay-hint { gap: 8px; padding: 4px 4px 4px 12px; font-size: 13px; color: var(--fnc-text); }
.fnc-replay-hint svg { color: var(--fnc-text-2); }
.fnc-replay-note { padding: 0 6px; font-size: 12px; color: var(--fnc-text-2); }

/* Indicator picker search (shown when custom indicators make the list long) */
.fnc-ind-search { height: 48px; padding: 0 16px; }
.fnc-ind-search input { font-size: 15px; }

/* ── Mobile ──────────────────────────────────────────── */
@media (max-width: 640px) {
  .fnc-toolbar { padding: 0 4px; gap: 2px; }
  .fnc-toolbar .fnc-btn { width: 32px; height: 32px; }
  .fnc-toolbar .fnc-btn-wide, .fnc-toolbar .fnc-btn-label { width: auto; padding: 0 6px; }
  .fnc-toolbar .fnc-sep { margin: 0 2px; }
  .fnc-symbol { max-width: 140px; padding: 0 8px 0 6px; }
  /* Logo only on phones; the name is in the chart legend right below. */
  .fnc-toolbar .fnc-symbol:has(.fnc-avatar) :is(.fnc-symbol-name, .fnc-icon) { display: none; }
  .fnc-chip { padding: 0 8px; }
  .fnc-btn-label span { display: none; }
  .fnc-intervals { display: none; }
  .fnc-interval-current { display: inline; }
  .fnc-interval-menu { left: auto; right: -40px; }
  .fnc-btn-drawbar { display: flex; }
  .fnc-drawbar-tab, .fnc-drawbar-collapse { display: none; }
  .fnc-drawbar[data-collapsed='true'] { display: flex; }
  /* The drawing bar slides over the chart instead of taking width. */
  .fnc-drawbar-host { position: absolute; left: 0; top: 0; bottom: 0; z-index: 5; pointer-events: none; }
  .fnc-drawbar {
    pointer-events: auto;
    transform: translateX(-100%);
    transition: transform 0.18s ease;
    box-shadow: 4px 0 16px rgb(0 0 0 / 0.08);
  }
  .fnc-drawbar[data-open='true'] { transform: none; }
  .fnc-selbar { top: auto; bottom: 56px; }
  .fnc-legend { left: 10px; right: 64px; }
  .fnc-backdrop { padding: 0; align-items: stretch; }
  .fnc-dialog { width: 100%; max-height: none; border-radius: 0; }
  .fnc-dialog.fnc-search-dialog { width: 100%; height: 100%; }
  .fnc-sr-footer, .fnc-sr-side, .fnc-hide-mobile, .fnc-sr-spark { display: none; }
  /* The interval button must stay whole; the symbol name truncates instead. */
  .fnc-symbol { flex: 0 1 auto; min-width: 36px; }
  /* MA rows wrap to two lines: [label ✓ color width ×] / [source period] */
  .fnc-rows .fnc-row { flex-wrap: wrap; row-gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--fnc-border); }
  /* Basis = row − indent(52) − gap(8) − period(72): too wide for line 1, so it always wraps. */
  .fnc-rows .fnc-select-source { order: 10; flex: 0 0 calc(100% - 132px); margin-left: 52px; }
  .fnc-rows .fnc-input-period { order: 11; }
  .fnc-rows .fnc-ind-btn { margin-left: auto; }
}
`;

const STYLE_ID = 'fnc-styles';

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
