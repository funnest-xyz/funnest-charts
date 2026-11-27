/** @jsxImportSource preact */
import type { IndicatorConfig } from '@funnest/charts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context.js';
import { stringsOf } from '../i18n.js';
import { useStore } from '../store.js';
import { SmallCloseIcon, TemplateIcon } from '../icons.js';
import { useKeepInView } from './keep-in-view.js';

/**
 * 지표 템플릿 (TradingView's indicator templates): the chart's indicators — with their inputs,
 * looks and panes — saved by name and put back on any chart in one go (replacing what's there).
 * Kept in this browser, shared by every chart on the page.
 */
const KEY = 'fnc-indicator-templates';
const MAX = 30;

export interface IndicatorTemplate {
  name: string;
  indicators: IndicatorConfig[];
  /** What it holds, as the legend names them (for the list). */
  titles: string[];
}

export function readIndicatorTemplates(): IndicatorTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is IndicatorTemplate => !!x && typeof x.name === 'string' && Array.isArray(x.indicators)) : [];
  } catch {
    return [];
  }
}
function writeIndicatorTemplates(list: IndicatorTemplate[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: kept for this visit only */
  }
}

export function IndicatorTemplates({ ctx }: { ctx: WidgetContext }) {
  const s = useStore(ctx.store);
  const t = stringsOf(s);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<IndicatorTemplate[]>(() => readIndicatorTemplates());
  const [naming, setNaming] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useKeepInView<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    // Another chart may have saved one since.
    setList(readIndicatorTemplates());
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const keep = (next: IndicatorTemplate[]) => {
    setList(next);
    writeIndicatorTemplates(next);
  };
  const current = ctx.chart.getIndicators();
  const save = () => {
    const name = (naming ?? '').trim().slice(0, 30);
    if (!name || current.length === 0) return setNaming(null);
    const titles = ctx.chart.indicatorLegend().map((i) => i.title);
    // The same name again replaces it.
    keep([{ name, indicators: JSON.parse(JSON.stringify(current)) as IndicatorConfig[], titles }, ...list.filter((x) => x.name !== name)].slice(0, MAX));
    setNaming(null);
  };
  const apply = (tpl: IndicatorTemplate) => {
    ctx.chart.setIndicators(JSON.parse(JSON.stringify(tpl.indicators)) as IndicatorConfig[]);
    setOpen(false);
  };

  return (
    <div class="fnc-menu-wrap fnc-indtpl-wrap" ref={ref}>
      <button
        class="fnc-btn fnc-btn-indtpl"
        data-tip={t.indicatorTemplates}
        aria-label={t.indicatorTemplates}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setNaming(null);
          setOpen(!open);
        }}
      >
        <TemplateIcon />
      </button>
      {open && (
        <div class="fnc-menu fnc-template-menu fnc-indtpl-menu" role="menu" aria-label={t.indicatorTemplates} ref={menuRef}>
          <div class="fnc-menu-title">{t.indicatorTemplates}</div>
          {list.length === 0 && <div class="fnc-menu-note">{t.noIndicatorTemplates}</div>}
          {list.map((tpl) => (
            <div class="fnc-template-row">
              <button class="fnc-menu-item fnc-indtpl-item" role="menuitem" onClick={() => apply(tpl)}>
                <span class="fnc-indtpl-name">{tpl.name}</span>
                <small class="fnc-indtpl-sub">{tpl.titles.length ? tpl.titles.join(' · ') : `${tpl.indicators.length}`}</small>
              </button>
              <button class="fnc-ind-btn" data-tip={t.deleteTemplate} aria-label={`${tpl.name} ${t.deleteTemplate}`} onClick={() => keep(list.filter((x) => x !== tpl))}>
                <SmallCloseIcon />
              </button>
            </div>
          ))}
          <div class="fnc-menu-sep" />
          {naming === null ? (
            <button class="fnc-menu-item" role="menuitem" disabled={current.length === 0} onClick={() => setNaming('')}>
              {current.length === 0 ? t.noIndicatorsToSave : t.saveIndicatorTemplate}
            </button>
          ) : (
            <input
              class="fnc-selbar-text fnc-template-name"
              value={naming}
              placeholder={t.templateName}
              aria-label={t.templateName}
              maxLength={30}
              autoFocus
              onInput={(e) => setNaming((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') setNaming(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
