/** @jsxImportSource preact */
import { useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Mounts a persistent, host-owned element inside Preact-rendered UI. The element outlives
 * re-renders, so whatever the host app rendered into it (React, Vue, plain DOM) stays intact.
 */
export function Slot({ el }: { el: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.appendChild(el);
    return () => el.remove();
  }, [el]);
  return <div class="fnc-slot-host" ref={ref} />;
}
