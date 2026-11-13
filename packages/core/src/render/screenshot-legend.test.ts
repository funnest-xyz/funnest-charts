import { describe, expect, it } from 'vitest';
import { layoutLegend, type LegendRow, type MeasureText } from './screenshot-legend';

// Every character is 10px wide.
const measure: MeasureText = (text) => text.length * 10;
const run = (text: string) => ({ text, color: '#000' });

describe('layoutLegend', () => {
  it('stacks rows with a 2px gap and centers text in each line', () => {
    const rows: LegendRow[] = [
      { groups: [[run('BTC')]], gap: 6, size: 13, lineHeight: 20 },
      { groups: [[run('O '), run('1')]], gap: 10, size: 12, lineHeight: 18 },
    ];
    const layout = layoutLegend(rows, 12, 8, 500, measure);
    expect(layout.runs.map((r) => [r.run.text, r.x, r.y])).toEqual([
      ['BTC', 12, 18],
      ['O ', 12, 39],
      ['1', 32, 39],
    ]);
    expect(layout.bottom).toBe(8 + 20 + 2 + 18);
    expect(layout.right).toBe(42);
  });

  it('wraps whole groups that would pass maxWidth, never splitting one', () => {
    const row: LegendRow = { groups: [[run('aaaa')], [run('b '), run('bb')], [run('cccc')]], gap: 10, size: 12, lineHeight: 18 };
    // aaaa (40) + 10 + b bb (40) = 90 fits in 100; + 10 + cccc (40) does not.
    const layout = layoutLegend([row], 0, 0, 100, measure);
    expect(layout.runs.map((r) => [r.run.text, r.x, r.y])).toEqual([
      ['aaaa', 0, 9],
      ['b ', 50, 9],
      ['bb', 70, 9],
      ['cccc', 0, 27],
    ]);
    expect(layout.bottom).toBe(36);
  });

  it('keeps a group wider than maxWidth on its own line', () => {
    const row: LegendRow = { groups: [[run('x'.repeat(20))], [run('y')]], gap: 8, size: 12, lineHeight: 20 };
    const layout = layoutLegend([row], 0, 0, 50, measure);
    expect(layout.runs.map((r) => r.y)).toEqual([10, 30]);
  });

  it('counts a color dot before the text', () => {
    const row: LegendRow = { groups: [[{ text: 'ETH', color: '#f00', dot: true }], [run('+1%')]], gap: 6, size: 12, lineHeight: 22 };
    const layout = layoutLegend([row], 0, 0, 500, measure);
    // dot 8 + gap 6 + "ETH" 30 = 44, then the 6px group gap.
    expect(layout.runs[1]!.x).toBe(50);
  });
});
