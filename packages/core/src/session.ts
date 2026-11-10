import { timeZoneOffset } from './realtime';

const DAY = 86_400_000;
const MINUTE = 60_000;

export interface SessionStatus {
  /** Trading right now. Always true for '24x7'. */
  open: boolean;
  /** Next open/close transition (UTC ms); null for 24x7 markets. */
  nextChange: number | null;
}

/**
 * Parses sessions like '0900-1530' (weekdays, exchange-local time) or '24x7'.
 * An optional day list may follow a colon using ISO weekdays: '0900-1530:12345'.
 * Holidays aren't known here — feed them via a calendar adapter later (see ROADMAP).
 */
export function sessionStatus(session: string, timeZone: string, now = Date.now()): SessionStatus {
  if (session.trim().toLowerCase() === '24x7') return { open: true, nextChange: null };
  const match = /^(\d{2})(\d{2})-(\d{2})(\d{2})(?::([1-7]+))?$/.exec(session.trim());
  if (!match) return { open: true, nextChange: null };
  const openMin = Number(match[1]) * 60 + Number(match[2]);
  const closeMin = Number(match[3]) * 60 + Number(match[4]);
  const days = new Set((match[5] ?? '12345').split('').map(Number));

  // Walk exchange-local days from yesterday forward and find the window around `now`.
  const offset = timeZoneOffset(now, timeZone);
  const localMidnight = Math.floor((now + offset) / DAY) * DAY;
  for (let d = -1; d <= 8; d++) {
    const dayStart = localMidnight + d * DAY;
    const isoWeekday = ((new Date(dayStart).getUTCDay() + 6) % 7) + 1;
    if (!days.has(isoWeekday)) continue;
    const open = dayStart + openMin * MINUTE - offset;
    const close = dayStart + closeMin * MINUTE - offset;
    if (now < open) return { open: false, nextChange: open };
    if (now < close) return { open: true, nextChange: close };
  }
  return { open: false, nextChange: null };
}
