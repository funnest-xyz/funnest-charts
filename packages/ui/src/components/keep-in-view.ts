import { useLayoutEffect, useRef } from 'preact/hooks';

const MARGIN = 8;

/**
 * Keeps an open dropdown inside the widget and the viewport: nudged sideways (its CSS anchor may
 * push it off-screen on phones), and no taller than the room below its top — scrolling inside
 * instead (a short chart on a phone; hosts often clip the widget or put their own bars under it).
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
      el.style.maxHeight = '';
      const r = el.getBoundingClientRect();
      const root = el.closest('.fnc-root')?.getBoundingClientRect();
      const maxY = Math.min(document.documentElement.clientHeight, root?.bottom ?? Infinity) - MARGIN;
      if (r.bottom > maxY) {
        el.style.maxHeight = `${Math.max(120, Math.floor(maxY - r.top))}px`;
        el.style.overflowY = 'auto';
      }
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
