/** @jsxImportSource preact */
import { LAYOUTS, layoutRects, type LayoutId } from '../layouts';

/** Mini drawing of a split layout. */
export function LayoutGlyph({ id }: { id: LayoutId }) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
      {layoutRects(LAYOUTS[id]).map((r) => (
        <rect x={r.x + 0.5} y={r.y + 0.5} width={Math.max(0, r.w - 1)} height={Math.max(0, r.h - 1)} rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
      ))}
    </svg>
  );
}
