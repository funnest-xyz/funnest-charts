import { describe, expect, it } from 'vitest';
import { sessionStatus } from './session';

const kst = (iso: string) => Date.parse(`${iso}+09:00`);

describe('sessionStatus', () => {
  it('KRX weekday: before open, during, after close', () => {
    // 2026-11-10 is a Tuesday
    expect(sessionStatus('0900-1530', 'Asia/Seoul', kst('2026-11-10T08:00:00'))).toEqual({ open: false, nextChange: kst('2026-11-10T09:00:00') });
    expect(sessionStatus('0900-1530', 'Asia/Seoul', kst('2026-11-10T14:00:00'))).toEqual({ open: true, nextChange: kst('2026-11-10T15:30:00') });
    expect(sessionStatus('0900-1530', 'Asia/Seoul', kst('2026-11-10T16:00:00'))).toEqual({ open: false, nextChange: kst('2026-11-11T09:00:00') });
  });

  it('skips the weekend', () => {
    // Friday 16:00 → Monday 09:00
    expect(sessionStatus('0900-1530', 'Asia/Seoul', kst('2026-11-13T16:00:00')).nextChange).toBe(kst('2026-11-16T09:00:00'));
  });

  it('works across timezones (NASDAQ seen from Korea)', () => {
    // 2026-11-10 22:00 KST = 08:00 EST → opens 09:30 EST = 23:30 KST
    const s = sessionStatus('0930-1600', 'America/New_York', kst('2026-11-10T22:00:00'));
    expect(s).toEqual({ open: false, nextChange: kst('2026-11-10T23:30:00') });
  });

  it('24x7 is always open', () => {
    expect(sessionStatus('24x7', 'UTC')).toEqual({ open: true, nextChange: null });
  });
});
