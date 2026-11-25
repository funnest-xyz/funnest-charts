import type { IndicatorParams, SeriesStyle } from './definitions.js';
import type { IndicatorDisplay } from './manager.js';

/**
 * 기본값으로 저장: an indicator's settings kept as what a new one of that type starts with, in
 * this browser (localStorage). Nothing kept: the definition's own defaults.
 */
export interface IndicatorDefaults {
  params?: IndicatorParams;
  styles?: Record<string, SeriesStyle>;
  display?: IndicatorDisplay;
  timeframe?: string;
  waitClose?: boolean;
}

const KEY = 'fnc-indicator-defaults';

function readAll(): Record<string, IndicatorDefaults> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, IndicatorDefaults>) : {};
  } catch {
    return {};
  }
}

/** What a new indicator of this type starts with, if saved. */
export function savedIndicatorDefaults(type: string): IndicatorDefaults | null {
  const d = readAll()[type];
  return d && typeof d === 'object' ? d : null;
}

/** Keeps these as the type's defaults (null: back to the definition's own). */
export function saveIndicatorDefaults(type: string, defaults: IndicatorDefaults | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const all = readAll();
    if (defaults) all[type] = JSON.parse(JSON.stringify(defaults)) as IndicatorDefaults;
    else delete all[type];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: nothing kept.
  }
}
