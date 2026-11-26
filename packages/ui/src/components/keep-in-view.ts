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

/**
 * A menu that opens beside its button (the drawing bar's tool lists): placed in the viewport
 * (position: fixed), so a drawing bar that scrolls — a short chart — can't clip it behind the chart.
 * A transformed ancestor moves where fixed boxes land; that offset is measured and taken out. Kept
 * on screen vertically, and moved along when the bar scrolls or the window changes.
 */
export function useBesideAnchor<T extends HTMLElement>(open: boolean, anchor: { current: HTMLElement | null }) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const a = anchor.current;
    if (!open || !el || !a) return;
    const place = () => {
      const r = a.getBoundingClientRect();
      el.style.position = 'fixed';
      el.style.left = '0px';
      el.style.top = '0px';
      const origin = el.getBoundingClientRect();
      const vh = document.documentElement.clientHeight;
      const top = Math.max(MARGIN, Math.min(r.top, vh - MARGIN - el.offsetHeight));
      el.style.left = `${Math.round(r.right + 8 - origin.left)}px`;
      el.style.top = `${Math.round(top - origin.top)}px`;
    };
    place();
    const bar = a.closest('.fnc-drawbar');
    window.addEventListener('resize', place);
    bar?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      bar?.removeEventListener('scroll', place);
    };
  }, [open]);
  return ref;
}
