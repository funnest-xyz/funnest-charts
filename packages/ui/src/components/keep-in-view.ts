import { useLayoutEffect, useRef } from 'preact/hooks';

const MARGIN = 8;

/**
 * Nudges an open dropdown horizontally so it stays inside the widget and the viewport (its CSS
 * anchor may push it off-screen on phones; hosts often clip the widget with overflow: hidden).
 * Attach the returned ref to the menu element.
 */
export function useKeepInView<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    el.style.translate = '';
    const fit = () => {
      el.style.translate = '';
      const r = el.getBoundingClientRect();
      const root = el.closest('.fnc-root')?.getBoundingClientRect();
      const minX = Math.max(0, root?.left ?? 0) + MARGIN;
      const maxX = Math.min(document.documentElement.clientWidth, root?.right ?? Infinity) - MARGIN;
      let dx = 0;
      if (r.right > maxX) dx = maxX - r.right;
      if (r.left + dx < minX) dx = minX - r.left;
      if (dx) el.style.translate = `${Math.round(dx)}px 0`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);
  return ref;
}
