/**
 * SITE CODE (not part of the library): market statistics mounted into the widget's slots.
 * Desktop: inline in the toolbar row. Mobile: its own row under the toolbar (see site.css).
 * Built only on public APIs — `chart.on('quoteChange' | 'symbolChange')` and `widget.slots`.
 */
import { formatCompact, formatPrice, type Quote, type SymbolInfo } from '@funnest/charts';
import type { TradingChart } from '@funnest/charts-ui';

const pad2 = (n: number) => String(n).padStart(2, '0');
const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
};
const dir = (v: number | undefined) => (v === undefined || v === 0 ? '' : v > 0 ? 'site-up' : 'site-down');

function html(info: SymbolInfo, q: Quote): string {
  const rolling = info.type === 'crypto' || info.type === 'futures';
  const price = (v: number) => formatPrice(v, info.pricePrecision);
  const items: [string, string, string?][] = [];
  if (q.high24h !== undefined) items.push([rolling ? '24시간 고가' : '고가', price(q.high24h), 'site-up']);
  if (q.low24h !== undefined) items.push([rolling ? '24시간 저가' : '저가', price(q.low24h), 'site-down']);
  if (q.volume24h !== undefined) items.push([rolling ? '24시간 거래량' : '거래량', formatCompact(q.volume24h, 'ko')]);
  if (q.turnover24h !== undefined) items.push([rolling ? '24시간 거래대금' : '거래대금', formatCompact(q.turnover24h, 'ko')]);
  if (q.openInterest !== undefined) items.push(['미체결약정', formatCompact(q.openInterest, 'ko')]);
  if (q.fundingRate !== undefined) {
    const rate = `${q.fundingRate >= 0 ? '+' : ''}${(q.fundingRate * 100).toFixed(4)}%`;
    const left = q.nextFundingTime !== undefined ? ` / ${countdown(q.nextFundingTime - Date.now())}` : '';
    items.push(['펀딩비 / 남은 시간', rate + left, dir(q.fundingRate)]);
  }
  const sign = (q.changePercent ?? 0) > 0 ? '+' : '';
  const head =
    q.price === undefined
      ? ''
      : `<div class="site-mb-price"><b class="${dir(q.changePercent)}">${price(q.price)}</b>${
          q.changePercent === undefined
            ? ''
            : `<span class="${dir(q.changePercent)}">${q.change !== undefined ? `${sign}${price(q.change)} ` : ''}${sign}${q.changePercent.toFixed(2)}%</span>`
        }</div>`;
  return head + items.map(([l, v, c]) => `<div class="site-mb-item"><span>${l}</span><b class="${c ?? ''}">${v}</b></div>`).join('');
}

export function mountMarketBar(widget: TradingChart): () => void {
  const { chart, slots } = widget;
  const inline = Object.assign(document.createElement('div'), { className: 'site-market site-market-inline' });
  const row = Object.assign(document.createElement('div'), { className: 'site-market site-market-row' });
  let info = chart.symbolInfo;
  let quote: Quote | null = null;
  let frame = 0;
  // Inline stats only on wide screens; attaching them hidden would keep the slot (and its
  // separator) visible on mobile, where the row variant is used instead.
  const wide = matchMedia('(min-width: 641px)');

  const render = () => {
    frame = 0;
    // Detached while empty, so the widget's slot collapses (no stray separator).
    if (!info || !quote) {
      inline.remove();
      row.remove();
      return;
    }
    const markup = html(info, quote);
    inline.innerHTML = markup;
    row.innerHTML = markup;
    if (wide.matches) {
      if (!inline.isConnected) slots.toolbar.appendChild(inline);
      row.remove();
    } else {
      if (!row.isConnected) slots.belowToolbar.appendChild(row);
      inline.remove();
    }
  };
  const schedule = () => (frame ||= requestAnimationFrame(render));

  // A vertical mouse wheel scrolls the inline stats sideways when they overflow.
  inline.addEventListener(
    'wheel',
    (e) => {
      if (inline.scrollWidth <= inline.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      inline.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );

  const offs = [
    chart.on('symbolChange', (next) => {
      info = next;
      quote = null;
      schedule();
    }),
    chart.on('quoteChange', (q) => {
      quote = q;
      schedule();
    }),
  ];
  wide.addEventListener('change', schedule);
  const ticker = setInterval(() => quote?.nextFundingTime !== undefined && schedule(), 1000);
  return () => {
    offs.forEach((off) => off());
    clearInterval(ticker);
    wide.removeEventListener('change', schedule);
    cancelAnimationFrame(frame);
    inline.remove();
    row.remove();
  };
}
