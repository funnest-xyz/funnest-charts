/** @jsxImportSource preact */
import { formatPrice, type ChartContextMenu } from '@funnest/charts';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ContextMenuItem, WidgetContext } from '../context';
import { stringsOf } from '../i18n';
import { useStore } from '../store';

const MARGIN = 8;

/**
 * Right-click menu on the chart (mouse only): undo/redo, the host's own items
 * (`contextMenuItems`), a horizontal line at the clicked price, reset and settings.
 */
export function ContextMenu({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [target, setTarget] = useState<ChartContextMenu | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => ctx.chart.on('contextMenu', setTarget), [ctx.chart]);

  useEffect(() => {
    if (!target) return;
    const close = () => setTarget(null);
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', close);
      window.removeEventListener('resize', close);
    };
  }, [target]);

  // Open at the pointer, flipped/clamped to stay inside the chart.
  useLayoutEffect(() => {
    const el = ref.current;
    const stage = el?.closest('.fnc-stage');
    if (!el || !target || !stage) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const { width, height } = stage.getBoundingClientRect();
    const x = target.x + w + MARGIN > width ? Math.max(MARGIN, target.x - w) : target.x;
    const y = target.y + h + MARGIN > height ? Math.max(MARGIN, target.y - h) : target.y;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }, [target]);

  if (!target) return null;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? '⌘' : 'Ctrl+';
  const price = target.price;
  const precision = s.symbol?.pricePrecision ?? 2;
  const extra = ctx.contextMenuItems?.({ ...target, chart: ctx.chart }) ?? [];

  const items: ContextMenuItem[] = [
    { label: t.undo, shortcut: `${mod}Z`, disabled: !s.canUndo, onSelect: () => ctx.chart.undo() },
    { label: t.redo, shortcut: `${mod}${mac ? '⇧' : 'Shift+'}Z`, disabled: !s.canRedo, onSelect: () => ctx.chart.redo() },
    'separator',
    ...(extra.length ? [...extra, 'separator' as const] : []),
  ];
  if (price !== null) {
    const time = target.time ?? ctx.chart.bars[ctx.chart.bars.length - 1]?.time ?? Date.now();
    items.push({
      label: t.horizontalAt.replace('{price}', formatPrice(price, precision)),
      onSelect: () => ctx.chart.addDrawing({ type: 'horizontal', points: [{ time, price }] }),
    });
  }
  items.push(
    { label: t.resetChart, onSelect: () => ctx.chart.resetView() },
    { label: t.chartSettingsMore, onSelect: () => ctx.store.set({ dialog: { kind: 'chartSettings' } }) },
  );

  return (
    <div class="fnc-menu fnc-ctx-menu" role="menu" ref={ref} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item) =>
        item === 'separator' ? (
          <div class="fnc-ctx-sep" role="separator" />
        ) : (
          <button
            class="fnc-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              setTarget(null);
              item.onSelect();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
