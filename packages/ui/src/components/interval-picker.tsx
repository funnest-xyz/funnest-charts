/** @jsxImportSource preact */
import { derivedBase, resolutionToMs, tickCount, type Resolution } from '@funnest/charts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { IntervalGroup, WidgetContext } from '../context.js';
import { resolutionLabel, stringsOf, type Strings } from '../i18n.js';
import { ChevronDownIcon, SmallCloseIcon, StarIcon } from '../icons.js';
import { useStore } from '../store.js';
import { useKeepInView } from './keep-in-view.js';

const GROUP_LABEL: Record<IntervalGroup['id'], keyof Strings> = {
  ticks: 'intervalTicks',
  minutes: 'intervalMinutes',
  hours: 'intervalHours',
  days: 'intervalDays',
};

/**
 * Favorite intervals as toolbar chips + a grouped menu (분 | 시간 | 일) where hovering a row
 * reveals a ★ to pin/unpin it. The current interval is among the chips even when it isn't a
 * favorite, in time order (15분 | 일 picking 1분 reads 1분 | 15분 | 일, not 15분 | 일 | 1분). On
 * narrow screens only the menu trigger (showing the current interval) remains. 직접 추가: any number
 * of minutes, hours, days, weeks or months — made from an interval the feed sends (core
 * datafeed/derived.ts), kept for every pane, removable.
 */

/** What the adder's units turn a number into ('2' 시간 → '120'). */
const UNITS: { id: 'unitMinutes' | 'unitHours' | 'unitDays' | 'unitWeeks' | 'unitMonths'; of(n: number): Resolution }[] = [
  { id: 'unitMinutes', of: (n) => String(n) },
  { id: 'unitHours', of: (n) => String(n * 60) },
  { id: 'unitDays', of: (n) => `${n}D` },
  { id: 'unitWeeks', of: (n) => `${n}W` },
  { id: 'unitMonths', of: (n) => `${n}M` },
];
export function IntervalPicker({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useKeepInView<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const supported = s.symbol?.supportedResolutions;
  // Sent by the feed, or made from one it sends (2시간 from 1시간…).
  // Tick bars only where the feed lists them (every feed can make minutes; few can make ticks).
  const isSupported = (r: Resolution) => (tickCount(r) !== null ? !!supported?.includes(r) : !supported || supported.includes(r) || !!derivedBase(r, supported));
  const groups = ctx.intervalGroups.filter((g) => g.id !== 'ticks' || g.intervals.some(isSupported));
  const listed = new Set(ctx.intervalGroups.flatMap((g) => g.intervals));
  const custom = s.customIntervals.filter((r) => !listed.has(r)).sort((a, b) => resolutionToMs(a) - resolutionToMs(b));
  const order = [...ctx.intervalGroups.flatMap((g) => g.intervals), ...custom];
  const [amount, setAmount] = useState('2');
  const [unit, setUnit] = useState(1);
  const add = () => {
    const n = Math.floor(Number(amount));
    if (!(n >= 1 && n <= 999)) return;
    const r = UNITS[unit]!.of(n);
    if (!listed.has(r)) ctx.addCustomInterval(r);
    select(r);
  };
  const favorites = s.favoriteIntervals;
  // Shortest first: by the menu's order where both are in it, else by length.
  const byTime = (a: Resolution, b: Resolution) => (order.includes(a) && order.includes(b) ? order.indexOf(a) - order.indexOf(b) : resolutionToMs(a) - resolutionToMs(b));
  const chips = [...new Set([...favorites, ...(s.resolution ? [s.resolution] : [])])].sort(byTime);
  const select = (r: Resolution) => {
    setOpen(false);
    ctx.selectResolution(r);
  };

  return (
    <div class="fnc-interval-picker" ref={ref}>
      <div class="fnc-intervals">
        {chips.map((r) => (
          <button
            class={favorites.includes(r) ? 'fnc-chip' : 'fnc-chip fnc-chip-extra'}
            aria-pressed={r === s.resolution}
            disabled={!isSupported(r)}
            data-tip={isSupported(r) ? resolutionLabel(r, s.locale, 'long') : t.unsupportedInterval}
            onClick={() => select(r)}
          >
            {resolutionLabel(r, s.locale)}
          </button>
        ))}
      </div>
      <button
        class="fnc-btn fnc-btn-wide fnc-interval-trigger"
        data-tip={t.moreIntervals}
        aria-label={t.moreIntervals}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <b class="fnc-interval-current">{resolutionLabel(s.resolution, s.locale)}</b>
        <ChevronDownIcon />
      </button>
      {open && (
        <div class="fnc-menu fnc-interval-menu" role="menu" ref={menuRef}>
          {groups.map((group) => (
            <div class="fnc-menu-group" role="group" aria-label={t[GROUP_LABEL[group.id]]}>
              <div class="fnc-menu-title">{t[GROUP_LABEL[group.id]]}</div>
              {group.intervals.map((r) => {
                const favorite = s.favoriteIntervals.includes(r);
                const ok = isSupported(r);
                return (
                  <div class={`fnc-menu-row${favorite ? ' is-favorite' : ''}`}>
                    <button
                      class="fnc-menu-item"
                      role="menuitemradio"
                      aria-checked={r === s.resolution}
                      disabled={!ok}
                      data-tip={ok ? undefined : t.unsupportedInterval}
                      onClick={() => select(r)}
                    >
                      {resolutionLabel(r, s.locale, 'long')}
                    </button>
                    <button
                      class="fnc-star"
                      aria-pressed={favorite}
                      aria-label={`${resolutionLabel(r, s.locale, 'long')} ${favorite ? t.removeFavorite : t.addFavorite}`}
                      data-tip={favorite ? t.removeFavorite : t.addFavorite}
                      onClick={() => ctx.toggleFavoriteInterval(r)}
                    >
                      <StarIcon filled={favorite} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {custom.length > 0 && (
            <div class="fnc-menu-group" role="group" aria-label={t.intervalCustom}>
              <div class="fnc-menu-title">{t.intervalCustom}</div>
              {custom.map((r) => {
                const favorite = s.favoriteIntervals.includes(r);
                const ok = isSupported(r);
                return (
                  <div class={`fnc-menu-row${favorite ? ' is-favorite' : ''}`}>
                    <button class="fnc-menu-item" role="menuitemradio" aria-checked={r === s.resolution} disabled={!ok} data-tip={ok ? undefined : t.unsupportedInterval} onClick={() => select(r)}>
                      {resolutionLabel(r, s.locale, 'long')}
                    </button>
                    <button class="fnc-star" aria-pressed={favorite} aria-label={`${resolutionLabel(r, s.locale, 'long')} ${favorite ? t.removeFavorite : t.addFavorite}`} data-tip={favorite ? t.removeFavorite : t.addFavorite} onClick={() => ctx.toggleFavoriteInterval(r)}>
                      <StarIcon filled={favorite} />
                    </button>
                    <button class="fnc-star fnc-interval-remove" aria-label={`${resolutionLabel(r, s.locale, 'long')} ${t.removeInterval}`} data-tip={t.removeInterval} onClick={() => ctx.removeCustomInterval(r)}>
                      <SmallCloseIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <form
            class="fnc-interval-add"
            aria-label={t.customInterval}
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <div class="fnc-menu-title">{t.customInterval}</div>
            <div class="fnc-interval-add-row">
              <input class="fnc-input" type="number" min={1} max={999} inputMode="numeric" value={amount} aria-label={t.customInterval} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
              <div class="fnc-interval-units" role="radiogroup" aria-label={t.customInterval}>
                {UNITS.map((u, i) => (
                  <button type="button" role="radio" aria-checked={unit === i} class={unit === i ? 'is-on' : undefined} onClick={() => setUnit(i)}>
                    {t[u.id]}
                  </button>
                ))}
              </div>
              <button class="fnc-btn fnc-interval-add-go" type="submit">
                {t.addInterval}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
