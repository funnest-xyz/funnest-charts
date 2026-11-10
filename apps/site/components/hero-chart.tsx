'use client';

import { FnChart, FnChartSlot } from '@funnest/charts-react';
import { useEffect, useMemo, useState } from 'react';
import { MockDatafeed } from '../lib/mock-datafeed';

type Scheme = 'dark' | 'light';
type CandleStyle = 'kr' | 'global';

const CANDLES: Record<CandleStyle, { up: string; down: string; label: string }> = {
  kr: { up: '#F04452', down: '#3182F6', label: '한국식 (상승 빨강 · 하락 파랑)' },
  global: { up: '#12B886', down: '#F04452', label: '글로벌 (상승 초록 · 하락 빨강)' },
};

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

/** Two candles drawn in the current up/down colors. */
const CandleIcon = ({ up, down }: { up: string; down: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3v18" stroke={up} strokeWidth="1.6" />
    <rect x="4" y="7" width="6" height="9" rx="1.2" fill={up} />
    <path d="M17 3v18" stroke={down} strokeWidth="1.6" />
    <rect x="14" y="9" width="6" height="8" rx="1.2" fill={down} />
  </svg>
);

/**
 * The real trading widget (candles, toolbar, search, indicators) on simulated data, with
 * two landing-only buttons placed in the widget's `toolbarEnd` slot next to the gear:
 * light/dark and candle colours. It tilts up into place once on load.
 */
export function HeroChart() {
  const [mounted, setMounted] = useState(false);
  const [scheme, setScheme] = useState<Scheme>('dark');
  const [candles, setCandles] = useState<CandleStyle>('kr');
  useEffect(() => setMounted(true), []);
  const datafeed = useMemo(() => (mounted ? new MockDatafeed() : null), [mounted]);
  const colors = CANDLES[candles];
  const theme = useMemo(() => ({ up: colors.up, down: colors.down }), [colors]);
  const nextScheme = scheme === 'dark' ? 'light' : 'dark';
  const nextCandles: CandleStyle = candles === 'kr' ? 'global' : 'kr';

  return (
    <div className="tilt-stage">
      <div className={mounted ? 'tilt is-flat' : 'tilt'}>
        <div className={`product-frame product-${scheme}`}>
          {datafeed ? (
            <FnChart
              datafeed={datafeed}
              symbol="005930"
              resolution="1D"
              colorScheme={scheme}
              theme={theme}
              storageKey={null}
              style={{ height: '100%' }}
            >
              <FnChartSlot name="toolbarEnd">
                <button
                  type="button"
                  className="fnc-btn"
                  title={nextScheme === 'light' ? '라이트 모드로' : '다크 모드로'}
                  aria-label={nextScheme === 'light' ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'}
                  onClick={() => setScheme(nextScheme)}
                >
                  {scheme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <button
                  type="button"
                  className="fnc-btn"
                  title={`캔들 색상: ${colors.label}`}
                  aria-label={`캔들 색상 바꾸기. 지금은 ${colors.label}`}
                  onClick={() => setCandles(nextCandles)}
                >
                  <CandleIcon up={colors.up} down={colors.down} />
                </button>
              </FnChartSlot>
            </FnChart>
          ) : (
            <div className="chart-skeleton" />
          )}
        </div>
      </div>
    </div>
  );
}
