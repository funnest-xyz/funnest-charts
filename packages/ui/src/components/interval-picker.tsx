/** @jsxImportSource preact */
import type { Resolution } from '@funnest/charts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { IntervalGroup, WidgetContext } from '../context';
import { resolutionLabel, STRINGS, type Strings } from '../i18n';
import { ChevronDownIcon, StarIcon } from '../icons';
import { useStore } from '../store';

const GROUP_LABEL: Record<IntervalGroup['id'], keyof Strings> = {
  minutes: 'intervalMinutes',
  hours: 'intervalHours',
  days: 'intervalDays',
};

/**
 * Favorite intervals as toolbar chips + a grouped menu (분 | 시간 | 일) where hovering a row
 * reveals a ★ to pin/unpin it. On narrow screens only the menu trigger (showing the current
 * interval) remains.
 */
export function IntervalPicker({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  const isSupported = (r: Resolution) => !supported || supported.includes(r);
  const order = ctx.intervalGroups.flatMap((g) => g.intervals);
  const favorites = [...s.favoriteIntervals].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const select = (r: Resolution) => {
    setOpen(false);
    ctx.selectResolution(r);
  };

  return (
    <div class="fnc-interval-picker" ref={ref}>
      <div class="fnc-intervals">
        {favorites.map((r) => (
          <button
            class="fnc-chip"
            aria-pressed={r === s.resolution}
            disabled={!isSupported(r)}
            title={isSupported(r) ? resolutionLabel(r, s.locale, 'long') : t.unsupportedInterval}
            onClick={() => select(r)}
          >
            {resolutionLabel(r, s.locale)}
          </button>
        ))}
      </div>
      <button
        class={`fnc-btn fnc-btn-wide fnc-interval-trigger${favorites.includes(s.resolution) ? '' : ' fnc-interval-trigger-active'}`}
        title={t.moreIntervals}
        aria-label={t.moreIntervals}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <b class="fnc-interval-current">{resolutionLabel(s.resolution, s.locale)}</b>
        <ChevronDownIcon />
      </button>
      {open && (
        <div class="fnc-menu fnc-interval-menu" role="menu">
          {ctx.intervalGroups.map((group) => (
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
                      title={ok ? undefined : t.unsupportedInterval}
                      onClick={() => select(r)}
                    >
                      {resolutionLabel(r, s.locale, 'long')}
                    </button>
                    <button
                      class="fnc-star"
                      aria-pressed={favorite}
                      aria-label={`${resolutionLabel(r, s.locale, 'long')} ${favorite ? t.removeFavorite : t.addFavorite}`}
                      title={favorite ? t.removeFavorite : t.addFavorite}
                      onClick={() => ctx.toggleFavoriteInterval(r)}
                    >
                      <StarIcon filled={favorite} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
