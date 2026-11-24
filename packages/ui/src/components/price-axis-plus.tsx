/** @jsxImportSource preact */
import { formatPrice } from '@funnest/charts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContextMenuItem, WidgetContext } from '../context.js';
import { stringsOf } from '../i18n.js';
import { BellIcon, HorizontalLineIcon, PlusIcon } from '../icons.js';
import { useStore } from '../store.js';

/**
 * The + at the right edge of the plot, on the crosshair's price (mouse only, like most chart
 * sites): a menu of what to do at that price — the app's rows (`priceAxisActions`: an alert…)
 * and a horizontal line. The button holds still while the pointer is on it or its menu is open.
 */
export function PriceAxisPlus({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [at, setAt] = useState<{ y: number; price: number } | null>(null);
  const [open, setOpen] = useState(false);
  const held = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      ctx.chart.on('crosshairMove', (info) => {
        if (held.current) return;
        setAt(info && info.source === 'mouse' && info.pane === 'main' && info.y >= 0 ? { y: info.y, price: info.value } : null);
      }),
    [ctx.chart],
  );

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      held.current = false;
    };
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { plotWidth, panesHeight } = s.layout;
  if (!ctx.priceAxisActions || !at || plotWidth <= 0 || at.y > panesHeight || s.replay.active) return null;
  const precision = s.symbol?.pricePrecision ?? 2;
  const price = Number(at.price.toFixed(precision));
  const items: (ContextMenuItem | { label: string; icon: 'line'; onSelect(): void })[] = open
    ? [
        ...ctx.priceAxisActions({ price, chart: ctx.chart }),
        {
          label: t.horizontalAt.replace('{price}', formatPrice(price, precision)),
          icon: 'line' as const,
          onSelect: () => {
            const time = ctx.chart.bars[ctx.chart.bars.length - 1]?.time ?? Date.now();
            ctx.chart.addDrawing({ type: 'horizontal', points: [{ time, price }] });
          },
        },
      ]
    : [];

  return (
    <div
      class="fnc-axis-plus"
      ref={ref}
      style={{ left: `${plotWidth - 26}px`, top: `${Math.round(at.y) - 11}px` }}
      onPointerEnter={() => (held.current = true)}
      onPointerLeave={() => !open && (held.current = false)}
    >
      <button class="fnc-axis-plus-btn" data-tip={t.atThisPrice} aria-label={t.atThisPrice} aria-expanded={open} onClick={() => setOpen(!open)}>
        <PlusIcon />
      </button>
      {open && (
        <div class="fnc-menu fnc-axis-plus-menu" role="menu">
          {items.map((item) =>
            item === 'separator' ? (
              <div class="fnc-ctx-sep" role="separator" />
            ) : (
              <button
                class="fnc-menu-item"
                role="menuitem"
                disabled={'disabled' in item ? item.disabled : false}
                onClick={() => {
                  setOpen(false);
                  held.current = false;
                  setAt(null);
                  item.onSelect();
                }}
              >
                {item.icon === 'alert' ? <BellIcon /> : item.icon === 'line' ? <HorizontalLineIcon /> : null}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
