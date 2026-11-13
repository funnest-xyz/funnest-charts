import type { Locale } from './model/time-format';
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

/**
 * '1' → 1분, '60' → 1시간, '1D' → 일 (short) / 1일 (long), '12M' → 1년.
 * Short labels are for the toolbar chips, long ones for the interval menu.
 */
export function resolutionLabel(resolution: Resolution, locale: Locale, form: 'short' | 'long' = 'short'): string {
  const match = /^(\d*)([SDWM]?)$/i.exec(resolution.trim());
  if (!match) return resolution;
  const n = match[1] ? Number(match[1]) : 1;
  const unit = (match[2] ?? '').toUpperCase();
  const ko = locale === 'ko';
  const long = form === 'long';
  switch (unit) {
    case 'S':
      return ko ? `${n}초` : `${n}s`;
    case 'D':
      return ko ? (n === 1 && !long ? '일' : `${n}일`) : `${n}D`;
    case 'W':
      return ko ? (n === 1 && !long ? '주' : `${n}주`) : `${n}W`;
    case 'M':
      if (n % 12 === 0) return ko ? `${n / 12}년` : `${n / 12}Y`;
      return ko ? (n === 1 && !long ? '월' : `${n}개월`) : `${n}M`;
    default:
      if (n >= 60 && n % 60 === 0) return ko ? `${n / 60}시간` : `${n / 60}h`;
      return ko ? `${n}분` : `${n}m`;
  }
}
