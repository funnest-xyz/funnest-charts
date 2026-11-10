import type { TickSize } from './types';

/** Number of decimal places in a finite number (handles exponent notation like 1e-8). */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const [mantissa = '', exp] = value.toExponential().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exp));
}

export function resolveTickSize(tickSize: TickSize, price: number): number {
  return typeof tickSize === 'function' ? tickSize(price) : tickSize;
}

/**
 * Round `price` to the nearest multiple of the tick size, avoiding float drift
 * (e.g. 0.1 + 0.2) by working in scaled integers.
 */
export function roundToTick(price: number, tickSize: TickSize): number {
  const tick = resolveTickSize(tickSize, price);
  if (!(tick > 0)) return price;
  const decimals = decimalsOf(tick);
  const scale = 10 ** decimals;
  const scaledTick = Math.round(tick * scale);
  // toPrecision(15) strips binary noise such as 1.005 * 100 = 100.49999999999999.
  const scaledPrice = Number((price * scale).toPrecision(15));
  return (Math.round(scaledPrice / scaledTick) * scaledTick) / scale;
}

/** KRX equity tick size table (effective 2023-01-25). */
export function krxTickSize(price: number): number {
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

export interface FormatPriceOptions {
  thousandsSeparator?: boolean;
}

export function formatPrice(
  price: number,
  precision: number,
  { thousandsSeparator = true }: FormatPriceOptions = {},
): string {
  if (!Number.isFinite(price)) return '';
  const fixed = Math.abs(price).toFixed(precision);
  const [int = '0', frac] = fixed.split('.');
  const intPart = thousandsSeparator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int;
  const sign = price < 0 && Number(fixed) !== 0 ? '-' : '';
  return sign + (frac ? `${intPart}.${frac}` : intPart);
}

const COMPACT_UNITS: Record<'ko' | 'en', ReadonlyArray<readonly [number, string]>> = {
  ko: [
    [1e12, '조'],
    [1e8, '억'],
    [1e4, '만'],
  ],
  en: [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ],
};

/** Compact number for volumes: 1234567 → "123.5만" (ko) / "1.23M" (en). */
export function formatCompact(value: number, locale: 'ko' | 'en' = 'ko'): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  for (const [unit, suffix] of COMPACT_UNITS[locale]) {
    if (abs >= unit) {
      const scaled = value / unit;
      const digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
      return trimFractionZeros(formatPrice(scaled, digits)) + suffix;
    }
  }
  return trimFractionZeros(formatPrice(value, abs < 10 && !Number.isInteger(value) ? 2 : 0));
}

/** "1.50" → "1.5", "2.00" → "2", "120" → "120". */
function trimFractionZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
