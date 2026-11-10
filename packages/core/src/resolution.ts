import type { Resolution } from './types';

const MINUTE = 60_000;
export const DAY_MS = 86_400_000;

/**
 * Approximate duration of a resolution string.
 * Bare numbers are minutes ('1', '15', '240'); suffixes: S (seconds), D, W, M (months ≈ 30d).
 */
export function resolutionToMs(resolution: Resolution): number {
  const match = /^(\d*)([SDWM]?)$/i.exec(resolution.trim());
  if (!match) throw new Error(`funnest-charts: invalid resolution "${resolution}"`);
  const n = match[1] ? Number(match[1]) : 1;
  switch ((match[2] ?? '').toUpperCase()) {
    case 'S':
      return n * 1000;
    case 'D':
      return n * DAY_MS;
    case 'W':
      return n * 7 * DAY_MS;
    case 'M':
      return n * 30 * DAY_MS;
    default:
      return n * MINUTE;
  }
}

export function isIntradayResolution(resolution: Resolution): boolean {
  return resolutionToMs(resolution) < DAY_MS;
}
