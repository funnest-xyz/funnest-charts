import { arcPath, arcs, seriesColor } from '@funnest/charts-viz';
import { useId, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { formatNumber, VAR } from './context';
import { Legend, type LegendShape } from './legend';

export interface DonutItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutCenter {
  /** Big text in the middle. */
  value: string;
  /** Small text under it. */
  label?: string;
}

export interface DonutChartProps {
  data: readonly DonutItem[];
  /** Diameter, px. Default 180. */
  size?: number;
  /** Hole size as a share of the radius, 0–0.95. 0 draws a pie. Default 0.68. */
  innerRadius?: number;
  /** Gap between segments, degrees. Default 1.5. */
  padAngle?: number;
  /** Rounded segment corners, px. Default 3. */
  cornerRadius?: number;
  /**
   * Text in the hole. Default: the hovered item's share and label, otherwise the total.
   * Return null to leave the hole empty.
   */
  center?: (active: { item: DonutItem; fraction: number } | null, total: number) => DonutCenter | ReactNode | null;
  /** Label under the total when nothing is hovered (e.g. "총 자산"). */
  totalLabel?: string;
  valueFormatter?: (value: number) => string;
  /** Default true. */
  showLegend?: boolean;
  /** Default 'right'. */
  legendPosition?: 'right' | 'bottom';
  legendShape?: LegendShape;
  /** Legend values. Default: the share ("42.0%"). */
  formatLabel?: (item: DonutItem, fraction: number) => string;
  /** Controlled highlight (id) — e.g. synced with a table row. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  palette?: readonly string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const pctText = (f: number) => `${formatNumber(Math.round(f * 1000) / 10)}%`;
const isCenter = (v: unknown): v is DonutCenter => !!v && typeof v === 'object' && 'value' in v && typeof (v as DonutCenter).value === 'string';

/**
 * Ring (or pie) of shares: portfolio by asset, sector weights, account mix.
 * Hover or arrow keys highlight a segment; the hole shows its share.
 */
export function DonutChart({
  data,
  size = 180,
  innerRadius = 0.68,
  padAngle = 1.5,
  cornerRadius = 3,
  center,
  totalLabel,
  valueFormatter = formatNumber,
  showLegend = true,
  legendPosition = 'right',
  legendShape,
  formatLabel = (_i, f) => pctText(f),
  activeId,
  onActiveChange,
  palette,
  className,
  style,
  'aria-label': ariaLabel,
}: DonutChartProps) {
  const uid = useId();
  const [own, setOwn] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const active = activeId !== undefined ? activeId : own;
  const setActive = (id: string | null) => {
    if (activeId === undefined) setOwn(id);
    onActiveChange?.(id);
  };

  const segs = arcs(data, (padAngle * Math.PI) / 180);
  const items = data.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i, palette), seg: segs[i]! }));
  const visible = items.filter((i) => i.seg.fraction > 0);
  const total = data.reduce((t, d) => t + Math.max(0, d.value), 0);
  const hit = items.find((i) => i.id === active) ?? null;

  const pop = 4;
  const r = size / 2 - pop;
  const ir = Math.max(0, Math.min(0.95, innerRadius)) * r;
  const c = size / 2;

  const centerContent = (() => {
    const a = hit ? { item: hit as DonutItem, fraction: hit.seg.fraction } : null;
    if (center) return center(a, total);
    return a ? { value: pctText(a.fraction), label: a.item.label } : { value: valueFormatter(total), ...(totalLabel ? { label: totalLabel } : {}) };
  })();

  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!visible.length) return;
    const k = visible.findIndex((i) => i.id === active);
    let next: string | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = visible[(k + 1) % visible.length]!.id;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = visible[(k <= 0 ? visible.length : k) - 1]!.id;
    else if (e.key === 'Home') next = visible[0]!.id;
    else if (e.key === 'End') next = visible[visible.length - 1]!.id;
    else if (e.key === 'Escape') next = null;
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  const describe = (i: (typeof items)[number]) => `${i.label} ${formatLabel(i, i.seg.fraction)} (${valueFormatter(i.value)})`;
  const side = legendPosition === 'right';

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel ?? items.map(describe).join(', ')}
      tabIndex={0}
      style={{ display: 'block', flex: 'none', overflow: 'visible', outline: 'none', borderRadius: '50%', boxShadow: focused ? `0 0 0 2px ${VAR.accentRing}` : undefined }}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setActive(null);
      }}
      onPointerLeave={() => setActive(null)}
    >
      {total <= 0 && <circle cx={c} cy={c} r={(r + ir) / 2} fill="none" strokeWidth={Math.max(1, r - ir)} style={{ stroke: VAR.grid }} />}
      {visible.map((i) => {
        const on = i.id === active;
        // The highlighted segment moves out along its middle angle.
        const mid = (i.seg.startAngle + i.seg.endAngle) / 2;
        const dx = on ? Math.sin(mid) * pop : 0;
        const dy = on ? -Math.cos(mid) * pop : 0;
        return (
          <path
            key={i.id}
            d={arcPath(c, c, ir, r, i.seg.startAngle, i.seg.endAngle, cornerRadius)}
            transform={`translate(${dx.toFixed(2)},${dy.toFixed(2)})`}
            opacity={active && !on ? 0.35 : 1}
            onPointerEnter={() => setActive(i.id)}
            style={{ fill: i.color, transition: 'transform 0.15s ease, opacity 0.15s', cursor: 'default' }}
          >
            <title>{describe(i)}</title>
          </path>
        );
      })}
      {ir > 24 &&
        centerContent !== null &&
        (isCenter(centerContent) ? (
          <g pointerEvents="none" style={{ fontFamily: VAR.font }}>
            <text
              x={c}
              y={centerContent.label ? c - 8 : c}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(12, Math.min(22, ir * 0.36))}
              fontWeight={700}
              style={{ fill: VAR.textStrong, fontVariantNumeric: 'tabular-nums' }}
            >
              {centerContent.value}
            </text>
            {centerContent.label && (
              <text x={c} y={c + 13} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: VAR.text }}>
                {centerContent.label}
              </text>
            )}
          </g>
        ) : (
          <foreignObject x={c - ir * 0.72} y={c - ir * 0.72} width={ir * 1.44} height={ir * 1.44} pointerEvents="none">
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center' }}>{centerContent}</div>
          </foreignObject>
        ))}
    </svg>
  );

  return (
    <div
      className={className}
      style={{
        fontFamily: VAR.font,
        position: 'relative',
        display: 'flex',
        flexDirection: side ? 'row' : 'column',
        alignItems: 'center',
        gap: side ? 24 : 14,
        ...style,
      }}
    >
      {svg}
      {showLegend && (
        <Legend
          direction={side ? 'column' : 'row'}
          justify={side ? 'flex-start' : 'center'}
          {...(legendShape ? { shape: legendShape } : {})}
          items={items.map((i) => ({ id: i.id, label: i.label, color: i.color, value: formatLabel(i, i.seg.fraction), inactive: !!active && active !== i.id }))}
          onItemHover={setActive}
        />
      )}
      <span id={`${uid}-live`} aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {focused && hit ? describe(hit) : ''}
      </span>
    </div>
  );
}
