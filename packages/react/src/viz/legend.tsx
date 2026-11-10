import type { CSSProperties } from 'react';
import { VAR } from './context';

export type LegendPosition = 'top' | 'bottom';

export interface LegendItem {
  id: string;
  label: string;
  color: string;
  /** Shown after the label (e.g. the scrubbed value). */
  value?: string | undefined;
  /** Rendered dimmed (series hidden). */
  inactive?: boolean;
}

export interface LegendProps {
  items: readonly LegendItem[];
  /** Click to toggle a series; omit for a static legend. */
  onItemClick?: (id: string) => void;
  /** Pointer enters (id) or leaves (null) an item — e.g. to highlight that series. */
  onItemHover?: (id: string | null) => void;
  /** 'circle' (default), 'square' or 'line' swatches. */
  shape?: 'circle' | 'square' | 'line';
  className?: string;
  style?: CSSProperties;
}

/** Series key, HTML (not SVG) so it wraps and stays readable at any width. */
export function Legend({ items, onItemClick, onItemHover, shape = 'circle', className, style }: LegendProps) {
  const swatch = (color: string): CSSProperties =>
    shape === 'line'
      ? { width: 12, height: 3, borderRadius: 2, background: color }
      : { width: 8, height: 8, borderRadius: shape === 'circle' ? '50%' : 2, background: color };
  return (
    <div
      className={className}
      role={onItemClick ? 'group' : 'list'}
      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '4px 0', fontSize: 12, color: VAR.text, fontFamily: VAR.font, ...style }}
    >
      {items.map((item) => {
        const content = (
          <>
            <span aria-hidden="true" style={{ flex: 'none', ...swatch(item.color) }} />
            <span>{item.label}</span>
            {item.value !== undefined && <b style={{ color: VAR.textStrong, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{item.value}</b>}
          </>
        );
        const itemStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, opacity: item.inactive ? 0.4 : 1, transition: 'opacity 0.15s' };
        const hover = onItemHover ? { onPointerEnter: () => onItemHover(item.id), onPointerLeave: () => onItemHover(null) } : {};
        return onItemClick ? (
          <button
            key={item.id}
            type="button"
            aria-pressed={!item.inactive}
            onClick={() => onItemClick(item.id)}
            {...hover}
            style={{ ...itemStyle, border: 0, padding: 0, background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
          >
            {content}
          </button>
        ) : (
          <span key={item.id} role="listitem" style={itemStyle} {...hover}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
