import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { VAR } from './context';

export interface Period {
  id: string;
  label: string;
  /** A live tab: a pulsing dot next to the label, and the live color when selected. */
  live?: boolean;
}

/** A label with a pulsing "live" dot (used by live periods; usable on its own too). */
export function LiveTabLabel({ label, color = 'var(--fnv-live, #F04452)' }: { label: string; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden="true" style={{ position: 'relative', width: 7, height: 7 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
        <svg width="7" height="7" viewBox="0 0 7 7" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <circle cx="3.5" cy="3.5" r="3.5" style={{ fill: color }} fillOpacity={0.45}>
            <animate attributeName="r" values="3.5;8" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="0.45;0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </svg>
      </span>
      {label}
    </span>
  );
}

/** Common ranges for price charts. */
export const DEFAULT_PERIODS: readonly Period[] = [
  { id: '1D', label: '1일' },
  { id: '1W', label: '1주' },
  { id: '1M', label: '1개월' },
  { id: '3M', label: '3개월' },
  { id: '1Y', label: '1년' },
  { id: 'ALL', label: '전체' },
];

export interface PeriodSelectorProps {
  periods?: readonly Period[];
  value: string;
  onChange: (id: string) => void;
  /** Active pill color. Default Funnest violet (set --fnv-accent to theme). */
  activeColor?: string;
  /** Pill color while a live period is selected. Default red. */
  liveColor?: string;
  /** Stretch the tabs across the full width (mobile). */
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

/** Range tabs (1D 1W 1M …) with a sliding pill; arrow keys move between tabs. */
export function PeriodSelector({
  periods = DEFAULT_PERIODS,
  value,
  onChange,
  activeColor = 'var(--fnv-accent, #6C4DFF)',
  liveColor = 'var(--fnv-live, #F04452)',
  fullWidth = false,
  className,
  style,
  'aria-label': ariaLabel = 'Period',
}: PeriodSelectorProps) {
  const activeIsLive = periods.find((p) => p.id === value)?.live ?? false;
  const pillColor = activeIsLive ? liveColor : activeColor;
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!list || !active) return setPill(null);
    const measure = () => setPill({ left: active.offsetLeft, width: active.offsetWidth });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [value, periods]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = periods.findIndex((p) => p.id === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const p = periods[(next + periods.length) % periods.length];
    if (!p) return;
    onChange(p.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-period="${CSS.escape(p.id)}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      onKeyDown={onKeyDown}
      style={{ position: 'relative', display: fullWidth ? 'flex' : 'inline-flex', gap: 2, fontFamily: VAR.font, ...style }}
    >
      {pill && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: pill.left,
            width: pill.width,
            borderRadius: 999,
            background: pillColor,
            opacity: 0.12,
            transition: 'left 0.2s ease, width 0.2s ease',
          }}
        />
      )}
      {periods.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            data-period={p.id}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(p.id)}
            style={{
              position: 'relative',
              flex: fullWidth ? 1 : 'none',
              minWidth: 44,
              height: 32,
              padding: '0 12px',
              border: 0,
              borderRadius: 999,
              background: 'transparent',
              color: active ? (p.live ? liveColor : activeColor) : VAR.text,
              font: 'inherit',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {p.live ? <LiveTabLabel label={p.label} color={liveColor} /> : p.label}
          </button>
        );
      })}
    </div>
  );
}
