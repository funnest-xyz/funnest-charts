/** @jsxImportSource preact */
import type { ChartType } from '@funnest/charts';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { STRINGS, type Strings } from '../i18n';
import { AreaChartIcon, CandlesIcon, ChevronDownIcon, LineChartIcon } from '../icons';
import { useStore } from '../store';

const TYPES: { type: ChartType; label: keyof Strings; icon: () => JSX.Element }[] = [
  { type: 'candles', label: 'candles', icon: CandlesIcon },
  { type: 'line', label: 'line', icon: LineChartIcon },
  { type: 'area', label: 'area', icon: AreaChartIcon },
];

export function ChartTypeMenu({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = STRINGS[s.locale];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = TYPES.find((x) => x.type === s.chartType) ?? TYPES[0]!;

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

  const choose = (type: ChartType) => {
    ctx.chart.setChartType(type);
    ctx.store.set({ chartType: type });
    setOpen(false);
  };

  return (
    <div class="fnc-menu-wrap fnc-chart-type" ref={ref}>
      <button
        class="fnc-btn fnc-btn-wide"
        data-tip={t.chartType}
        aria-label={t.chartType}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <current.icon />
        <ChevronDownIcon />
      </button>
      {open && (
        <div class="fnc-menu" role="menu">
          {TYPES.map(({ type, label, icon: Icon }) => (
            <button
              class="fnc-menu-item"
              role="menuitemradio"
              aria-checked={type === s.chartType}
              onClick={() => choose(type)}
            >
              <Icon />
              <span>{t[label]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
