/** @jsxImportSource preact */
import { derivedBase } from '@funnest/charts';
import { useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf } from '../i18n.js';
import { CalendarIcon } from '../icons.js';
import { useStore } from '../store.js';

const DAY = 86_400_000;

type RangeId = 'range1D' | 'range5D' | 'range1M' | 'range3M' | 'range6M' | 'rangeYTD' | 'range1Y' | 'range5Y' | 'rangeAll';

/**
 * 기간: each button shows a span at the interval that suits it, as on most chart sites — 1일 at 1분,
 * 5일 at 5분, 1개월 at 30분, 3개월 at 1시간, 6개월 at 2시간, 올해 and 1년 at 일, 5년 at 주, 전체 at 월.
 */
const RANGES: { id: RangeId; resolution: string; from(now: number): number | null }[] = [
  { id: 'range1D', resolution: '1', from: (now) => now - DAY },
  { id: 'range5D', resolution: '5', from: (now) => now - 5 * DAY },
  { id: 'range1M', resolution: '30', from: (now) => now - 30 * DAY },
  { id: 'range3M', resolution: '60', from: (now) => now - 91 * DAY },
  { id: 'range6M', resolution: '120', from: (now) => now - 182 * DAY },
  { id: 'rangeYTD', resolution: '1D', from: (now) => Date.UTC(new Date(now).getUTCFullYear(), 0, 1) },
  { id: 'range1Y', resolution: '1D', from: (now) => now - 365 * DAY },
  { id: 'range5Y', resolution: '1W', from: (now) => now - 5 * 365 * DAY },
  { id: 'rangeAll', resolution: '1M', from: () => null },
];

/** `YYYY-MM-DD` of a moment, for a date input. */
const dateInput = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * Under the chart (like most chart sites): 기간 buttons, then 날짜로 이동 — a date; older history
 * is loaded first when it's before what's on the chart. The date box opens upward.
 */
export function RangeBar({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  if (s.replay.active || s.replay.selecting) return null;
  const supported = s.symbol?.supportedResolutions;
  const usable = (resolution: string) => !supported || supported.includes(resolution) || !!derivedBase(resolution, supported) || resolution === '1M';

  const pick = async (r: (typeof RANGES)[number]) => {
    if (!s.symbol || busy) return;
    setBusy(true);
    try {
      if (r.resolution !== s.resolution) {
        ctx.selectResolution(r.resolution);
        // Wait for the interval's bars before showing the span.
        await new Promise<void>((resolve) => {
          const off = ctx.chart.on('dataChange', () => {
            off();
            resolve();
          });
          setTimeout(() => {
            off();
            resolve();
          }, 8000);
        });
      }
      const from = r.from(Date.now());
      if (from === null) await ctx.chart.showAll();
      else await ctx.chart.showRange(from);
    } finally {
      setBusy(false);
    }
  };
  const go = async () => {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || busy) return;
    setBusy(true);
    try {
      await ctx.chart.goToTime(time);
      setDateOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="fnc-ranges" aria-label={t.ranges} role="group" aria-busy={busy}>
      <div class="fnc-ranges-scroll">
        {RANGES.map((r) => (
          <button class="fnc-range" disabled={busy || !usable(r.resolution)} onClick={() => void pick(r)}>
            {t[r.id]}
          </button>
        ))}
      </div>
      <span class="fnc-range-sep" />
      <button
        class="fnc-range fnc-range-date"
        data-tip={t.goToDate}
        aria-label={t.goToDate}
        aria-expanded={dateOpen}
        onClick={() => {
          if (!dateOpen) setDate(dateInput(ctx.chart.getVisibleTimeRange()?.from ?? Date.now()));
          setDateOpen(!dateOpen);
        }}
      >
        <CalendarIcon />
      </button>
      {dateOpen && (
        <form
          class="fnc-goto"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
          onKeyDown={(e) => e.key === 'Escape' && setDateOpen(false)}
        >
          <span>{t.goToDate}</span>
          <input class="fnc-input" type="date" value={date} max={dateInput(Date.now())} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
          <button class="fnc-btn fnc-goto-go" type="submit" disabled={busy || !date}>
            {t.goTo}
          </button>
        </form>
      )}
    </div>
  );
}
