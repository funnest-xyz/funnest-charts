/** @jsxImportSource preact */
import type { IntervalUnit, IntervalVisibility } from '@funnest/charts';
import type { Strings } from '../i18n.js';

/** 보임: each interval unit, on or off, and the range of it (TradingView's Visibility tab). */
export const INTERVAL_UNITS: { unit: IntervalUnit; max: number; label: (t: Strings) => string }[] = [
  { unit: 'seconds', max: 59, label: (t) => t.visSeconds },
  { unit: 'minutes', max: 59, label: (t) => t.visMinutes },
  { unit: 'hours', max: 24, label: (t) => t.visHours },
  { unit: 'days', max: 366, label: (t) => t.visDays },
  { unit: 'weeks', max: 52, label: (t) => t.visWeeks },
  { unit: 'months', max: 12, label: (t) => t.visMonths },
];

/** Drops units left at "all of it": nothing left → undefined (shown everywhere). */
export function cleanIntervals(v: IntervalVisibility | undefined): IntervalVisibility | undefined {
  if (!v) return undefined;
  const out: IntervalVisibility = {};
  for (const { unit, max } of INTERVAL_UNITS) {
    const rule = v[unit];
    if (rule === undefined) continue;
    if (rule === false) out[unit] = false;
    else {
      const lo = Math.max(1, Math.min(max, Math.round(rule[0]) || 1));
      const hi = Math.max(lo, Math.min(max, Math.round(rule[1]) || max));
      if (lo !== 1 || hi !== max) out[unit] = [lo, hi];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function IntervalVisibilityEditor({ t, value, onChange }: { t: Strings; value: IntervalVisibility | undefined; onChange: (v: IntervalVisibility) => void }) {
  const v = value ?? {};
  const set = (unit: IntervalUnit, rule: [number, number] | false | undefined) => {
    const next = { ...v };
    if (rule === undefined) delete next[unit];
    else next[unit] = rule;
    onChange(next);
  };
  return (
    <div class="fnc-rows fnc-vis">
      {INTERVAL_UNITS.map(({ unit, max, label }) => {
        const rule = v[unit];
        const on = rule !== false;
        const [lo, hi] = Array.isArray(rule) ? rule : [1, max];
        return (
          <div class="fnc-row">
            <label class="fnc-vis-unit">
              <input type="checkbox" class="fnc-check" checked={on} onChange={(e) => set(unit, e.currentTarget.checked ? undefined : false)} />
              {label(t)}
            </label>
            <input
              class="fnc-input fnc-input-num"
              inputMode="numeric"
              value={String(lo)}
              disabled={!on}
              aria-label={`${label(t)} ${t.rangeFrom}`}
              onChange={(e) => set(unit, [Number(e.currentTarget.value) || 1, hi])}
            />
            <span class="fnc-vis-dash">–</span>
            <input
              class="fnc-input fnc-input-num"
              inputMode="numeric"
              value={String(hi)}
              disabled={!on}
              aria-label={`${label(t)} ${t.rangeTo}`}
              onChange={(e) => set(unit, [lo, Number(e.currentTarget.value) || max])}
            />
          </div>
        );
      })}
    </div>
  );
}
