/** @jsxImportSource preact */
import { formatPrice, type SymbolInfo, type SymbolSearchResult } from '@funnest/charts';
import { Fragment, type ComponentChildren } from 'preact';
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
/** Rows drawn at first, and how many more each time the list is scrolled near its end. */
const FIRST_ROWS = 40;
const MORE_ROWS = 80;

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

/** Mini lines fetched for rows on screen, shared across openings for two minutes. */
const sparkCache = new Map<string, { at: number; values: Promise<number[]> }>();
const SPARK_TTL = 120_000;
const SPARK_DWELL_MS = 300;

/**
 * A row's mini line: the result's own if it has one, else asked of the datafeed (getSparkline)
 * once the row is on screen — the results never wait for these.
 */
function LazySparkline({ ctx, info, up }: { ctx: WidgetContext; info: SymbolSearchResult; up: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [values, setValues] = useState<number[] | null>(info.sparkline ?? null);
  useEffect(() => {
    if (info.sparkline || !ctx.datafeed.getSparkline || !ref.current) return;
    let alive = true;
    const load = () => {
      let hit = sparkCache.get(info.symbol);
      if (!hit || Date.now() - hit.at > SPARK_TTL) {
        hit = { at: Date.now(), values: ctx.datafeed.getSparkline!(info.symbol).catch(() => []) };
        sparkCache.set(info.symbol, hit);
      }
      void hit.values.then((v) => alive && setValues(v));
    };
    // Only rows that stay on screen a moment (not ones flashing by while typing).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver((entries) => {
      clearTimeout(timer);
      if (!entries.some((e) => e.isIntersecting)) return;
      timer = setTimeout(() => {
        io.disconnect();
        load();
      }, SPARK_DWELL_MS);
    });
    io.observe(ref.current);
    return () => {
      alive = false;
      clearTimeout(timer);
      io.disconnect();
    };
  }, [info.symbol]);
  return <span ref={ref} class="fnc-sr-spark-slot">{values && <Sparkline values={values} up={up} />}</span>;
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
  const { locale, symbol: current, searchTarget } = useStore(ctx.store);
  const comparing = searchTarget === 'compare';
  const t = STRINGS[locale];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ctx.searchCategories[0]?.id ?? 'all');
  const [view, setView] = useState<View>({ kind: 'all' });
  const [exchange, setExchange] = useState<string | null>(null);
  const [results, setResults] = useState<SymbolSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Some markets may still be answering after the first rows show.
  const [pending, setPending] = useState(true);
  const [recent, setRecent] = useState<SymbolSearchResult[]>(() => ctx.storage.get(RECENT_KEY, []));
  const [favorites, setFavorites] = useState<SymbolSearchResult[]>(() => ctx.storage.get(FAVORITE_KEY, []));
  const [active, setActive] = useState(0);
  // A long list (one exchange's 500 symbols) is drawn as it is scrolled, not all at once.
  const [limit, setLimit] = useState(FIRST_ROWS);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPending(true);
    const id = setTimeout(() => {
      const feed = ctx.datafeed;
      // Sources that answer as they come (combineDatafeeds) show the fast ones first.
      const search = feed.searchSymbolsProgressive
        ? feed.searchSymbolsProgressive(query.trim(), (partial) => {
            if (!alive) return;
            setResults(partial);
            setLoading(false);
          })
        : feed.searchSymbols?.(query.trim());
      search
        ?.then((items) => alive && setResults(items))
        .catch(() => alive && setResults([]))
        .finally(() => {
          if (!alive) return;
          setLoading(false);
          setPending(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  const matchCategory = ctx.searchCategories.find((c) => c.id === category)?.match ?? (() => true);
  const categoryOf = (info: SymbolInfo) => ctx.searchCategories.find((c) => c.id !== 'all' && c.match(info));
  const favoriteSet = useMemo(() => new Set(favorites.map((f) => f.symbol)), [favorites]);
  const isFavorite = (info: SymbolInfo) => favoriteSet.has(info.symbol);
  const filter = (list: SymbolSearchResult[]) =>
    list.filter((i) => matchCategory(i) && (!exchange || i.exchange === exchange));

  // The sidebar: the exchanges the app declares (from the start, with logos), then any others the
  // results bring. Counts fill in as results come.
  const exchanges = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results ?? []) if (matchCategory(r)) counts.set(r.exchange, (counts.get(r.exchange) ?? 0) + 1);
    const declared = ctx.searchExchanges.map((e) => ({ ...e, count: counts.get(e.name) }));
    const others = [...counts.entries()]
      .filter(([name]) => !ctx.searchExchanges.some((e) => e.name === name))
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, label: undefined, logoUrl: undefined, count }));
    return [...declared, ...others];
  }, [results, category]);

  const q = query.trim().toLowerCase();
  const favoriteRows = filter(favorites).filter((f) => !q || f.name.toLowerCase().includes(q) || f.symbol.toLowerCase().includes(q));
  const showRecent = view.kind === 'all' && !q && recent.length > 0;
  const recentRows = showRecent ? filter(recent) : [];
  const allResults = view.kind === 'favorites' ? favoriteRows : filter(results ?? []);
  // Without an exchange picked, each exchange shows its first few (searchPreviewPerExchange) and
  // a "모두 보기" row; picking the exchange (row or sidebar) lists all of them.
  const preview = ctx.searchPreviewPerExchange;
  const more = new Map<number, { exchange: string; count: number }>();
  let resultRows = allResults;
  if (preview > 0 && view.kind === 'all' && !exchange) {
    const seen = new Map<string, number>();
    const total = new Map<string, number>();
    for (const r of allResults) total.set(r.exchange, (total.get(r.exchange) ?? 0) + 1);
    resultRows = [];
    for (const r of allResults) {
      const n = (seen.get(r.exchange) ?? 0) + 1;
      seen.set(r.exchange, n);
      if (n > preview) continue;
      resultRows.push(r);
      if (n === preview && (total.get(r.exchange) ?? 0) > preview) more.set(resultRows.length - 1, { exchange: r.exchange, count: total.get(r.exchange)! });
    }
  }
  const rows = [...recentRows, ...resultRows];
  const shownRows = resultRows.length > limit ? resultRows.slice(0, limit) : resultRows;
  const exchangeLabel = (name: string) => ctx.searchExchanges.find((e) => e.name === name)?.label?.[locale] ?? name;

  useEffect(() => setActive(0), [query, category, exchange, view, results]);
  useEffect(() => {
    setLimit(FIRST_ROWS);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, category, exchange, view]);
  // Near the end of what is drawn: draw the next batch.
  const hasMore = resultRows.length > limit;
  useEffect(() => {
    const end = endRef.current;
    if (!hasMore || !end) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setLimit((l) => l + MORE_ROWS), {
      root: listRef.current,
      rootMargin: '0px 0px 600px 0px',
    });
    io.observe(end);
    return () => io.disconnect();
  }, [hasMore, limit]);
  const scrollToActive = useRef(false);
  useEffect(() => {
    // The keyboard can go past what is drawn (↑ from the top wraps to the last row): draw up to
    // it first, then scroll once it is there.
    if (active - recentRows.length >= limit - 1) {
      scrollToActive.current = true;
      setLimit(active - recentRows.length + MORE_ROWS);
    } else listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [limit]);

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
    if (comparing) ctx.chart.addCompare(info.symbol).catch((error: unknown) => console.error('funnest-charts: compare failed', error));
    else ctx.selectSymbol(info.symbol);
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
        key={(isRecent ? 'recent:' : '') + info.symbol}
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
        {(info.sparkline || ctx.datafeed.getSparkline) && <LazySparkline key={info.symbol} ctx={ctx} info={info} up={up} />}
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

  const sideItem = (label: string, selected: boolean, onClick: () => void, extra?: ComponentChildren, logoUrl?: string) => (
    <button class="fnc-sr-side-item" aria-pressed={selected} onClick={onClick}>
      {logoUrl !== undefined && (logoUrl ? <img class="fnc-sr-side-logo" src={logoUrl} alt="" aria-hidden="true" /> : <i class="fnc-sr-side-logo" aria-hidden="true" />)}
      <span>{label}</span>
      {extra}
    </button>
  );

  return (
    <div class="fnc-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div class="fnc-dialog fnc-search-dialog" role="dialog" aria-modal="true" aria-label={comparing ? t.compareSymbol : t.searchSymbol} onKeyDown={onKeyDown}>
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
            placeholder={comparing ? t.compareSymbol : t.searchPlaceholder}
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
            {exchanges.map((x) =>
              sideItem(
                x.label?.[locale] ?? x.name,
                exchange === x.name,
                () => (setView({ kind: 'all' }), setExchange(exchange === x.name ? null : x.name)),
                <em>{x.count ?? (pending ? '' : 0)}</em>,
                ctx.searchExchanges.length ? (x.logoUrl ?? '') : undefined,
              ),
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
              : shownRows.map((info, i) => {
                  const m = more.get(i);
                  return m ? (
                    <Fragment key={info.symbol}>
                      {row(info, recentRows.length + i, false)}
                      <button class="fnc-sr-more" onClick={() => (setView({ kind: 'all' }), setExchange(m.exchange))}>
                        {t.showAllIn.replace('{exchange}', exchangeLabel(m.exchange)).replace('{n}', m.count.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US'))}
                      </button>
                    </Fragment>
                  ) : (
                    row(info, recentRows.length + i, false)
                  );
                })}
            {hasMore && <div ref={endRef} class="fnc-sr-end" aria-hidden="true" />}
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
          {ctx.searchHotkey && (
            <span>
              <kbd class="fnc-kbd">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + K</kbd> {t.searchSymbol}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
