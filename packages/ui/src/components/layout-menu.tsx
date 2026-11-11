/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { LayoutSync, MultiControls, WidgetContext } from '../context';
import { STRINGS } from '../i18n';
import { ChevronDownIcon, LinkIcon } from '../icons';
import { LAYOUT_GROUPS, LAYOUTS, layoutRects, paneCount, type LayoutId } from '../layouts';

const LAYOUT_PANES = (id: LayoutId) => paneCount(LAYOUTS[id]);
import { useStore } from '../store';

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

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  return { open, setOpen, ref };
}

const SYNC_KEYS: { key: keyof LayoutSync; label: 'syncCrosshair' | 'syncTime' | 'syncSymbol' | 'syncInterval' }[] = [
  { key: 'crosshair', label: 'syncCrosshair' },
  { key: 'time', label: 'syncTime' },
  { key: 'symbol', label: 'syncSymbol' },
  { key: 'interval', label: 'syncInterval' },
];

/** Toolbar buttons of the multi-chart widget: split layout picker and pane sync toggles. */
export function LayoutMenu({ ctx, multi }: { ctx: WidgetContext; multi: MultiControls }) {
  const s = useStore(ctx.store);
  const m = useStore(multi.store);
  const t = STRINGS[s.locale];
  const layout = usePopover();
  const sync = usePopover();
  const anySync = Object.values(m.sync).some(Boolean);

  return (
    <>
      <div class="fnc-menu-wrap" ref={layout.ref}>
        <button
          class="fnc-btn fnc-btn-wide fnc-btn-layout"
          data-tip={t.layout}
          aria-label={t.layout}
          aria-haspopup="menu"
          aria-expanded={layout.open}
          onClick={() => layout.setOpen(!layout.open)}
        >
          <LayoutGlyph id={m.layout} />
          <ChevronDownIcon />
        </button>
        {layout.open && (
          <div class="fnc-menu fnc-layout-menu" role="menu" aria-label={t.layout}>
            {LAYOUT_GROUPS.map((group) => (
              <div class="fnc-layout-row">
                <span class="fnc-layout-count">{group[0]!.split('-')[0]}</span>
                {group.map((id) => (
                  <button
                    class="fnc-layout-opt"
                    role="menuitemradio"
                    aria-checked={id === m.layout}
                    aria-label={`${t.layout} ${id}`}
                    data-layout={id}
                    onClick={() => {
                      multi.setLayout(id);
                      layout.setOpen(false);
                    }}
                  >
                    <LayoutGlyph id={id} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Syncing only means something with two or more panes on screen. */}
      {LAYOUT_PANES(m.layout) > 1 && (
      <div class="fnc-menu-wrap" ref={sync.ref}>
        <button
          class="fnc-btn fnc-btn-sync"
          data-tip={t.sync}
          aria-label={t.sync}
          aria-haspopup="menu"
          aria-expanded={sync.open}
          aria-pressed={anySync}
          onClick={() => sync.setOpen(!sync.open)}
        >
          <LinkIcon />
        </button>
        {sync.open && (
          <div class="fnc-menu fnc-sync-menu" role="menu" aria-label={t.sync}>
            <div class="fnc-menu-title">
              {t.sync}
              <small>{t.syncHint}</small>
            </div>
            {SYNC_KEYS.map(({ key, label }) => (
              <button
                class="fnc-menu-item fnc-sync-item"
                role="menuitemcheckbox"
                aria-checked={m.sync[key]}
                onClick={() => multi.setSync({ [key]: !m.sync[key] })}
              >
                <span>{t[label]}</span>
                <span class="fnc-switch" data-on={m.sync[key] ? 'true' : 'false'} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </>
  );
}
