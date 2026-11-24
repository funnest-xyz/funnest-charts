/** @jsxImportSource preact */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf } from '../i18n.js';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../icons.js';
import { useStore } from '../store.js';

const DAY = 86_400_000;
/** `YYYY-MM-DD` (UTC) of a moment. */
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
/** The UTC moment of a `YYYY-MM-DD`, or NaN if it isn't a real date. */
function parseYmd(text: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return Number.NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return ymd(t) === text ? t : Number.NaN;
}
/** Digits typed in any shape → `YYYY-MM-DD` as far as they go. */
function formatTyped(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}

/**
 * 날짜로 이동 (from the right-click menu): a date — typed, or picked on a month calendar (‹ › a
 * month, « » a year) — and 이동. Older history is loaded first when the date is before what's
 * on the chart; the view keeps its zoom, centered on that day.
 */
export function GoToDateDialog({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const today = Date.now();
  const start = ctx.chart.getVisibleTimeRange()?.from ?? today;
  const [text, setText] = useState(ymd(start));
  const [month, setMonth] = useState(() => {
    const d = new Date(start);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const close = () => ctx.store.set({ dialog: null });
  useEffect(() => input.current?.select(), []);

  const picked = parseYmd(text);
  const valid = Number.isFinite(picked) && picked <= today;
  const locale = s.locale === 'en' ? 'en-US' : 'ko-KR';
  const title = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.UTC(month.y, month.m, 1));
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2023, 0, 1 + i)));
  }, [locale]);
  const first = Date.UTC(month.y, month.m, 1);
  const lead = new Date(first).getUTCDay();
  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => first + i * DAY)];

  const shift = (months: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + months, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  const pick = (time: number) => {
    setText(ymd(time));
    const d = new Date(time);
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const go = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await ctx.chart.goToTime(picked);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="fnc-dialog fnc-goto-dialog" role="dialog" aria-modal="true" aria-label={t.goToDate} onKeyDown={(e) => e.key === 'Escape' && close()}>
        <div class="fnc-dialog-head">
          <b>{t.goToDate}</b>
          <button class="fnc-btn" aria-label={t.close} onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <form
          class="fnc-goto-body"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <input
            ref={input}
            class="fnc-input fnc-goto-input"
            value={text}
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            aria-label={t.goToDate}
            aria-invalid={text.length === 10 && !valid}
            onInput={(e) => {
              const next = formatTyped((e.target as HTMLInputElement).value);
              setText(next);
              const time = parseYmd(next);
              if (Number.isFinite(time)) {
                const d = new Date(time);
                setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
              }
            }}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div class="fnc-cal" role="group" aria-label={title}>
            <div class="fnc-cal-head">
              <button type="button" class="fnc-btn" aria-label={t.prevYear} data-tip={t.prevYear} onClick={() => shift(-12)}>
                «
              </button>
              <button type="button" class="fnc-btn" aria-label={t.prevMonth} data-tip={t.prevMonth} onClick={() => shift(-1)}>
                <ChevronLeftIcon />
              </button>
              <b>{title}</b>
              <button type="button" class="fnc-btn" aria-label={t.nextMonth} data-tip={t.nextMonth} disabled={first + days * DAY > today} onClick={() => shift(1)}>
                <ChevronRightIcon />
              </button>
              <button type="button" class="fnc-btn" aria-label={t.nextYear} data-tip={t.nextYear} disabled={Date.UTC(month.y + 1, month.m, 1) > today} onClick={() => shift(12)}>
                »
              </button>
            </div>
            <div class="fnc-cal-grid">
              {weekdays.map((w) => (
                <span class="fnc-cal-wd">{w}</span>
              ))}
              {cells.map((time) =>
                time === null ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    class={`fnc-cal-day${ymd(time) === text ? ' is-on' : ''}${ymd(time) === ymd(today) ? ' is-today' : ''}`}
                    disabled={time > today}
                    aria-pressed={ymd(time) === text}
                    onClick={() => pick(time)}
                    onDblClick={() => {
                      pick(time);
                      void ctx.chart.goToTime(time).then(close);
                    }}
                  >
                    {new Date(time).getUTCDate()}
                  </button>
                ),
              )}
            </div>
          </div>
          <div class="fnc-goto-actions">
            <button type="button" class="fnc-btn fnc-goto-today" onClick={() => pick(Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate()))}>
              {t.today}
            </button>
            <button type="submit" class="fnc-btn fnc-goto-go" disabled={!valid || busy}>
              {t.goTo}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
