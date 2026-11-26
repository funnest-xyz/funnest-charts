/** @jsxImportSource preact */
import { formatPrice, type ChartContextMenu } from '@funnest/charts';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ContextMenuItem, WidgetContext } from '../context.js';
import { stringsOf } from '../i18n.js';
import { CheckIcon } from '../icons.js';
import { useStore } from '../store.js';
import { MenuIcon } from './menu-icon.js';

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
    { label: t.undo, icon: 'undo', shortcut: `${mod}Z`, disabled: !s.canUndo, onSelect: () => ctx.chart.undo() },
    { label: t.redo, icon: 'redo', shortcut: `${mod}${mac ? '⇧' : 'Shift+'}Z`, disabled: !s.canRedo, onSelect: () => ctx.chart.redo() },
    'separator',
    ...(extra.length ? [...extra, 'separator' as const] : []),
  ];
  if (price !== null) {
    const time = target.time ?? ctx.chart.bars[ctx.chart.bars.length - 1]?.time ?? Date.now();
    items.push({
      label: t.horizontalAt.replace('{price}', formatPrice(price, precision)),
      icon: 'line',
      onSelect: () => ctx.chart.addDrawing({ type: 'horizontal', points: [{ time, price }] }),
    });
  }
  const { zoomAnimation, scrollInertia, lockView, lockRatio } = ctx.chart.settings;
  // 부드러운 스크롤·확대: both 확대·축소 애니메이션 and 이동 관성 (차트 설정 › 애니메이션 has each).
  const smooth = zoomAnimation && scrollInertia;
  items.push(
    { label: t.goToDateMore, icon: 'date', onSelect: () => ctx.store.set({ dialog: { kind: 'goToDate' } }) },
    { label: t.smoothScroll, icon: 'smooth', checked: smooth, onSelect: () => ctx.chart.setSettings({ smoothScroll: !smooth }) },
    { label: t.lockView, icon: 'lock', checked: lockView, onSelect: () => ctx.chart.setSettings({ lockView: !lockView }) },
    { label: t.lockRatio, icon: 'ratio', checked: lockRatio, onSelect: () => ctx.chart.setSettings({ lockRatio: !lockRatio }) },
    'separator',
    { label: t.resetChart, icon: 'reset', disabled: lockView, onSelect: () => ctx.chart.resetView() },
    { label: t.chartSettingsMore, icon: 'settings', onSelect: () => ctx.store.set({ dialog: { kind: 'chartSettings' } }) },
  );

  return (
    <div class="fnc-menu fnc-ctx-menu" role="menu" ref={ref} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item) =>
        item === 'separator' ? (
          <div class="fnc-ctx-sep" role="separator" />
        ) : (
          <button
            class={`fnc-menu-item${item.checked !== undefined ? ' fnc-menu-check' : ''}`}
            role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={item.checked}
            disabled={item.disabled}
            onClick={() => {
              setTarget(null);
              item.onSelect();
            }}
          >
            {item.icon ? <MenuIcon name={item.icon} /> : <span class="fnc-menu-icon" />}
            <span class="fnc-menu-label">{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
            {item.checked && (
              <span class="fnc-menu-check-mark">
                <CheckIcon />
              </span>
            )}
          </button>
        ),
      )}
    </div>
  );
}
