import { describe, expect, it } from 'vitest';
import { formatPrice } from '../price.js';
import { positionPnlText } from './trading.js';

const wholeDollars = (p: number) => formatPrice(p, 0);

describe('positionPnlText', () => {
  it('uses the price format when the position sets no P&L decimals (as before)', () => {
    expect(positionPnlText({ price: 61561, quantity: 0.003, side: 'long' }, 61507, wholeDollars).text).toBe('0 (-0.09%)');
    expect(positionPnlText({ price: 100, quantity: 2, side: 'long' }, 112, wholeDollars).text).toBe('+24 (+12.00%)');
  });

  it('writes the amount with pnlPrecision decimals: a small loss on BTC is not 0', () => {
    const r = positionPnlText({ price: 61561, quantity: 0.003, side: 'long', pnlPrecision: 2 }, 61507, wholeDollars);
    expect(r.text).toBe('-0.16 (-0.09%)');
    expect(r.pnl).toBeCloseTo(-0.162);
  });

  it('a short gains when the price falls, with thousands separators', () => {
    expect(positionPnlText({ price: 60000, quantity: 1.5, side: 'short', pnlPrecision: 2 }, 58000, wholeDollars).text).toBe('+3,000.00 (+3.33%)');
  });

  it('no + on a gain that rounds to zero', () => {
    expect(positionPnlText({ price: 100, quantity: 1, side: 'long', pnlPrecision: 2 }, 100.001, wholeDollars).text).toBe('0.00 (0.00%)');
  });
});
