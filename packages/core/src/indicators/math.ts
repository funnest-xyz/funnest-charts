/**
 * Indicator math over plain number arrays. Outputs are aligned with the input
 * (same length); positions without enough data are NaN.
 */

export function sma(src: ArrayLike<number>, period: number): Float64Array {
  const out = new Float64Array(src.length).fill(Number.NaN);
  if (period < 1) return out;
  let sum = 0;
  let valid = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i]!;
    if (Number.isNaN(v)) {
      sum = 0;
      valid = 0;
      continue;
    }
    sum += v;
    valid++;
    if (valid > period) sum -= src[i - period]!;
    if (valid >= period) out[i] = sum / period;
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` valid values (leading NaNs are skipped). */
export function ema(src: ArrayLike<number>, period: number): Float64Array {
  const out = new Float64Array(src.length).fill(Number.NaN);
  if (period < 1) return out;
  const k = 2 / (period + 1);
  let prev = Number.NaN;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i]!;
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(prev)) {
      seedSum += v;
      seedCount++;
      if (seedCount === period) out[i] = prev = seedSum / period;
      continue;
    }
    out[i] = prev = v * k + prev * (1 - k);
  }
  return out;
}

/** Rolling population standard deviation. */
export function stdev(src: ArrayLike<number>, period: number): Float64Array {
  const out = new Float64Array(src.length).fill(Number.NaN);
  const mean = sma(src, period);
  for (let i = period - 1; i < src.length; i++) {
    const m = mean[i]!;
    if (Number.isNaN(m)) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (src[j]! - m) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

export function bollinger(src: ArrayLike<number>, period: number, mult: number) {
  const middle = sma(src, period);
  const sd = stdev(src, period);
  const upper = new Float64Array(src.length);
  const lower = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) {
    upper[i] = middle[i]! + mult * sd[i]!;
    lower[i] = middle[i]! - mult * sd[i]!;
  }
  return { middle, upper, lower };
}

/** Wilder's RSI. */
export function rsi(src: ArrayLike<number>, period: number): Float64Array {
  const out = new Float64Array(src.length).fill(Number.NaN);
  if (period < 1 || src.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = src[i]! - src[i - 1]!;
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  const value = () => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));
  out[period] = value();
  for (let i = period + 1; i < src.length; i++) {
    const d = src[i]! - src[i - 1]!;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = value();
  }
  return out;
}

export function macd(src: ArrayLike<number>, fast: number, slow: number, signal: number) {
  const fastEma = ema(src, fast);
  const slowEma = ema(src, slow);
  const line = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) line[i] = fastEma[i]! - slowEma[i]!;
  const signalLine = ema(line, signal);
  const histogram = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) histogram[i] = line[i]! - signalLine[i]!;
  return { macd: line, signal: signalLine, histogram };
}
