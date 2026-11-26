/** @jsxImportSource preact */
import type { ComponentChildren } from 'preact';
import type { MenuIconName } from '../context.js';
import { BellIcon, CalendarIcon, HorizontalLineIcon, ResetIcon } from '../icons.js';

/** Menu-row glyphs, all on one 20-unit grid and drawn at 16px (the row's icon column). */
function Glyph({ children }: { children: ComponentChildren }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<Exclude<MenuIconName, 'alert' | 'line' | 'date' | 'reset'>, ComponentChildren> = {
  undo: (
    <>
      <path d="M7 5.5 3.5 9 7 12.5" />
      <path d="M3.5 9h8a4.5 4.5 0 0 1 0 9H9" />
    </>
  ),
  redo: (
    <>
      <path d="M13 5.5 16.5 9 13 12.5" />
      <path d="M16.5 9h-8a4.5 4.5 0 0 0 0 9H11" />
    </>
  ),
  // Motion lines behind a dot: something gliding.
  smooth: (
    <>
      <path d="M3 7h6M2 10h5M3 13h6" />
      <circle cx="13.5" cy="10" r="3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1.8" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  // A diagonal across a box: price to bar kept in step.
  ratio: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M6.5 13.5l7-7M10.5 6.5h3v3" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.1M10 15.1v2.1M2.8 10h2.1M15.1 10h2.1M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M4.9 15.1l1.5-1.5M13.6 6.4l1.5-1.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 1.5" />
    </>
  ),
};

/** The glyph for a menu row's `icon`, sized for the row (16px). */
export function MenuIcon({ name }: { name: MenuIconName }) {
  const shared = name === 'alert' ? <BellIcon /> : name === 'line' ? <HorizontalLineIcon /> : name === 'date' ? <CalendarIcon /> : name === 'reset' ? <ResetIcon /> : null;
  return <span class="fnc-menu-icon">{shared ?? <Glyph>{GLYPHS[name as keyof typeof GLYPHS]}</Glyph>}</span>;
}
