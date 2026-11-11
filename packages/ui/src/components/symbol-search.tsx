/** @jsxImportSource preact */
import { formatPrice, type SymbolInfo, type SymbolSearchResult } from '@funnest/charts';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { WidgetContext } from '../context';
import { STRINGS } from '../i18n';
import { SearchIcon, SmallCloseIcon, StarIcon } from '../icons';
import { useStore } from '../store';
import { SymbolAvatar } from './symbol-avatar';

const DEBOUNCE_MS = 150;
const RECENT_KEY = 'recent-symbols';
const FAVORITE_KEY = 'favorite-symbols';
const MAX_RECENT = 8;

/** combineDatafeeds namespaces ids ("UPBIT:KRW-BTC"); the exchange column already says where. */
const displayCode = (symbol: string) => symbol.slice(symbol.lastIndexOf(':') + 1);

/** Strips non-serializable fields (price-dependent tickSize functions) for storage. */
const toStored = (info: SymbolInfo): SymbolSearchResult =>
  JSON.parse(JSON.stringify({ ...info, tickSize: 0, price: undefined, changePercent: undefined, sparkline: undefined }));

/** Wraps case-insensitive matches of `query` in <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts: ComponentChildren[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, i)) {
    if (at > i) parts.push(text.slice(i, at));
    parts.push(<mark>{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 72;
  const h = 24;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg class={`fnc-sr-spark ${up ? 'fnc-up' : 'fnc-down'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  );
}

type View = { kind: 'all' } | { kind: 'favorites' };

/**
 * Symbol search: category tabs, an exchange/favorites sidebar (exchange filter shows as a chip
 * in the input), ★ favorites, recent searches, match highlighting and — when the datafeed
 * returns them — price, change and a sparkline per row. Keyboard: ↑↓ Enter Esc.
 */
export function SymbolSearch({ ctx }: { ctx: WidgetContext }) {
  const { locale, symbol: current } = useStore(ctx.store);
  const t = STRINGS[locale];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ctx.searchCategories[0]?.id ?? 'all');
  const [view, setView] = useState<View>({ kind: 'all' });
  const [exchange, setExchange] = useState<string | null>(null);
  const [results, setResults] = useState<SymbolSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<SymbolSearchResult[]>(() => ctx.storage.get(RECENT_KEY, []));
  const [favorites, setFavorites] = useState<SymbolSearchResult[]>(() => ctx.storage.get(FAVORITE_KEY, []));
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const id = setTimeout(() => {
      ctx.datafeed
        .searchSymbols?.(query.trim())
        .then((items) => alive && setResults(items))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  const matchCategory = ctx.searchCategories.find((c) => c.id === category)?.match ?? (() => true);
  const categoryOf = (info: SymbolInfo) => ctx.searchCategories.find((c) => c.id !== 'all' && c.match(info));
  const isFavorite = (info: SymbolInfo) => favorites.some((f) => f.symbol === info.symbol);
  const filter = (list: SymbolSearchResult[]) =>
    list.filter((i) => matchCategory(i) && (!exchange || i.exchange === exchange));

  // Exchanges present in the current results feed the sidebar.
  const exchanges = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results ?? []) if (matchCategory(r)) counts.set(r.exchange, (counts.get(r.exchange) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [results, category]);

  const q = query.trim().toLowerCase();
  const favoriteRows = filter(favorites).filter((f) => !q || f.name.toLowerCase().includes(q) || f.symbol.toLowerCase().includes(q));
  const showRecent = view.kind === 'all' && !q && recent.length > 0;
  const recentRows = showRecent ? filter(recent) : [];
  const resultRows = view.kind === 'favorites' ? favoriteRows : filter(results ?? []);
  const rows = [...recentRows, ...resultRows];

  useEffect(() => setActive(0), [query, category, exchange, view, results]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => ctx.setSearchOpen(false);
  const save = (key: string, next: SymbolSearchResult[], set: (v: SymbolSearchResult[]) => void) => {
    set(next);
    ctx.storage.set(key, next);
  };
  const toggleFavorite = (info: SymbolSearchResult) =>
    save(FAVORITE_KEY, isFavorite(info) ? favorites.filter((f) => f.symbol !== info.symbol) : [...favorites, toStored(info)], setFavorites);
  const choose = (info: SymbolInfo | undefined) => {
    if (!info) return;
    save(RECENT_KEY, [toStored(info), ...recent.filter((r) => r.symbol !== info.symbol)].slice(0, MAX_RECENT), setRecent);
    close();
    ctx.selectSymbol(info.symbol);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const count = rows.length;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' && count) setActive((a) => (a + 1) % count);
    else if (e.key === 'ArrowUp' && count) setActive((a) => (a - 1 + count) % count);
    else if (e.key === 'Enter') choose(rows[active]);
    else if (e.key === 'Backspace' && !query && exchange) setExchange(null);
    else return;
    e.preventDefault();
  };

  const row = (info: SymbolSearchResult, index: number, isRecent: boolean) => {
    const cat = categoryOf(info);
    const fav = isFavorite(info);
    const change = info.changePercent ?? 0;
    const up = change >= 0;
    const trend = change > 0 ? 'fnc-up' : change < 0 ? 'fnc-down' : 'fnc-flat';
    return (
      <div
        class="fnc-sr-row"
        role="option"
        aria-selected={index === active}
        data-index={index}
        onPointerMove={() => setActive(index)}
        onClick={() => choose(info)}
      >
        <button
          class={`fnc-sr-star${fav ? ' is-on' : ''}`}
          aria-pressed={fav}
          aria-label={`${info.name} ${fav ? t.removeFavorite : t.addFavorite}`}
          data-tip={fav ? t.removeFavorite : t.addFavorite}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(info);
          }}
        >
          <StarIcon filled={fav} />
        </button>
        {ctx.showLogo && <SymbolAvatar info={info} size={32} />}
        <span class="fnc-sr-main">
          <span class="fnc-sr-name">
            <Highlight text={info.name} query={query} />
            {current?.symbol === info.symbol && <span class="fnc-sr-current">{t.current}</span>}
          </span>
          <span class="fnc-sr-meta">
            <Highlight text={displayCode(info.symbol)} query={query} /> · {info.exchange}
            {cat && ` · ${cat.label[locale]}`}
          </span>
        </span>
        {info.sparkline && <Sparkline values={info.sparkline} up={up} />}
        {info.price !== undefined && (
          <span class="fnc-sr-quote">
            <b>{formatPrice(info.price, info.pricePrecision)}</b>
            {info.changePercent !== undefined && (
              <span class={trend}>
                {change > 0 ? '↑ ' : change < 0 ? '↓ ' : ''}
                {Math.abs(info.changePercent).toFixed(2)}%
              </span>
            )}
          </span>
        )}
        {isRecent && (
          <button
            class="fnc-ind-btn"
            aria-label={`${info.name} ${t.removeRecent}`}
            data-tip={t.removeRecent}
            onClick={(e) => {
              e.stopPropagation();
              save(RECENT_KEY, recent.filter((r) => r.symbol !== info.symbol), setRecent);
            }}
          >
            <SmallCloseIcon />
          </button>
        )}
      </div>
    );
  };

  const sideItem = (label: string, selected: boolean, onClick: () => void, extra?: ComponentChildren) => (
    <button class="fnc-sr-side-item" aria-pressed={selected} onClick={onClick}>
      <span>{label}</span>
      {extra}
    </button>
  );

  return (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="fnc-dialog fnc-search-dialog" role="dialog" aria-modal="true" aria-label={t.searchSymbol} onKeyDown={onKeyDown}>
        <div class="fnc-search">
          <SearchIcon />
          {exchange && (
            <span class="fnc-chip-token">
              {exchange}
              <button aria-label={`${exchange} ${t.cancel}`} onClick={() => setExchange(null)}>
                <SmallCloseIcon />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            placeholder={t.searchPlaceholder}
            role="combobox"
            aria-expanded="true"
            aria-controls="fnc-search-results"
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          {query && (
            <button class="fnc-ind-btn" aria-label={t.cancel} onClick={() => (setQuery(''), inputRef.current?.focus())}>
              <SmallCloseIcon />
            </button>
          )}
          <button class="fnc-kbd fnc-kbd-btn fnc-hide-mobile" aria-label={t.close} data-tip={t.close} onClick={close}>
            ESC
          </button>
        </div>

        <div class="fnc-tabs" role="tablist">
          {ctx.searchCategories.map((c) => (
            <button class="fnc-tab" role="tab" aria-selected={c.id === category} onClick={() => setCategory(c.id)}>
              {c.label[locale]}
            </button>
          ))}
        </div>

        <div class="fnc-sr-body">
          <nav class="fnc-sr-side fnc-scroll" aria-label={t.searchSymbol}>
            <div class="fnc-sr-side-title">{t.browse}</div>
            {sideItem(t.allSymbols, view.kind === 'all' && !exchange, () => (setView({ kind: 'all' }), setExchange(null)))}
            {sideItem(t.favorites, view.kind === 'favorites', () => (setView({ kind: 'favorites' }), setExchange(null)), <em>{favorites.length || ''}</em>)}
            {exchanges.length > 0 && <div class="fnc-sr-side-title">{t.exchanges}</div>}
            {exchanges.map(([name, count]) =>
              sideItem(name, exchange === name, () => (setView({ kind: 'all' }), setExchange(exchange === name ? null : name)), <em>{count}</em>),
            )}
          </nav>

          <div class="fnc-sr-list fnc-scroll" id="fnc-search-results" role="listbox" ref={listRef}>
            {recentRows.length > 0 && (
              <div class="fnc-sr-section">
                <span>{t.recentSearches}</span>
                <button class="fnc-link" onClick={() => save(RECENT_KEY, [], setRecent)}>
                  {t.clearRecent}
                </button>
              </div>
            )}
            {recentRows.map((info, i) => row(info, i, true))}
            {(recentRows.length > 0 || view.kind === 'favorites') && (
              <div class="fnc-sr-section">{view.kind === 'favorites' ? t.favorites : t.symbols}</div>
            )}
            {loading && !results && view.kind === 'all'
              ? Array.from({ length: 6 }, () => <div class="fnc-sr-skeleton" aria-hidden="true" />)
              : resultRows.map((info, i) => row(info, recentRows.length + i, false))}
            {!loading && rows.length === 0 && (
              <div class="fnc-empty">{view.kind === 'favorites' && favorites.length === 0 ? t.noFavorites : t.noResults}</div>
            )}
          </div>
        </div>

        <div class="fnc-sr-footer">
          <span>
            <kbd class="fnc-kbd">↑↓</kbd> {t.navigate}
          </span>
          <span>
            <kbd class="fnc-kbd">↵</kbd> {t.openAction}
          </span>
          <button class="fnc-sr-foot-btn" onClick={close}>
            <kbd class="fnc-kbd">ESC</kbd> {t.close}
          </button>
          <span class="fnc-spacer" />
          <span>
            <kbd class="fnc-kbd">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + K</kbd> {t.searchSymbol}
          </span>
        </div>
      </div>
    </div>
  );
}
