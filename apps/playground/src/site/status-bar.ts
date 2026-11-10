/**
 * SITE CODE (not part of the library): bottom status line in the widget's footer slot.
 * Right-aligned: `● KRX 4시간 33분 후 마감 · 11.10 (화) 10:56:02 KST | 📶 29ms`.
 * Uses only public APIs: `sessionStatus()`, `chart.symbolInfo`, `chart.on('connectionChange')`.
 */
import { sessionStatus, type ConnectionState } from '@funnest/charts';
import type { TradingChart } from '@funnest/charts-ui';

const CLOCK_ICON =
  '<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/></svg>';
const wifiIcon = (bars: number) =>
  `<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">` +
  `<path d="M3 8.5a10 10 0 0 1 14 0" opacity="${bars >= 3 ? 1 : 0.25}"/>` +
  `<path d="M5.5 11a6.5 6.5 0 0 1 9 0" opacity="${bars >= 2 ? 1 : 0.25}"/>` +
  `<path d="M8 13.5a3 3 0 0 1 4 0" opacity="${bars >= 1 ? 1 : 0.25}"/>` +
  `<circle cx="10" cy="16" r="0.9" fill="currentColor"/></svg>`;

function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분 ${pad2(s)}초`;
}
const pad2 = (n: number) => String(n).padStart(2, '0');

export interface StatusBarOptions {
  /** Clock timezone. Korean users: KST. */
  timeZone?: string;
  /** Label shown after the clock. */
  zoneLabel?: string;
}

export function mountStatusBar(widget: TradingChart, { timeZone = 'Asia/Seoul', zoneLabel = 'KST' }: StatusBarOptions = {}): () => void {
  const { chart, slots } = widget;
  const bar = Object.assign(document.createElement('div'), { className: 'site-status' });
  bar.setAttribute('role', 'status');
  slots.footer.appendChild(bar);
  const clock = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let connection: ConnectionState | null = null;

  const render = () => {
    const now = Date.now();
    const info = chart.symbolInfo;
    let session = '';
    let open = false;
    if (info) {
      const st = sessionStatus(info.session, info.timezone, now);
      open = st.open;
      session =
        st.nextChange === null
          ? `${info.exchange} 24시간 거래`
          : st.open
            ? `${info.exchange} ${duration(st.nextChange - now)} 후 마감`
            : `${info.exchange} 휴장 · ${duration(st.nextChange - now)} 후 개장`;
    }
    const latency = connection?.latency;
    const status = connection?.status;
    const quality = status !== 'connected' ? 'bad' : latency === undefined || latency < 150 ? 'good' : latency < 400 ? 'ok' : 'bad';
    const bars = status !== 'connected' ? 0 : quality === 'good' ? 3 : quality === 'ok' ? 2 : 1;
    const connText =
      status === 'connected'
        ? latency !== undefined
          ? `${latency}ms`
          : '연결됨'
        : status === 'reconnecting'
          ? '재연결 중'
          : status === 'connecting'
            ? '연결 중'
            : '연결 끊김';

    bar.innerHTML =
      (info ? `<span class="site-session${open ? ' is-open' : ''}"><i></i>${session}</span>` : '') +
      `<span class="site-clock">${CLOCK_ICON}${clock.format(now)} ${zoneLabel}</span>` +
      (connection ? `<span class="site-divider" aria-hidden="true"></span><span class="site-conn site-conn-${quality}" title="응답 지연">${wifiIcon(bars)}${connText}</span>` : '');
  };

  const offs = [
    chart.on('symbolChange', render),
    chart.on('connectionChange', (c) => {
      connection = c;
      render();
    }),
  ];
  render();
  const timer = setInterval(render, 1000);
  return () => {
    offs.forEach((off) => off());
    clearInterval(timer);
    bar.remove();
  };
}
