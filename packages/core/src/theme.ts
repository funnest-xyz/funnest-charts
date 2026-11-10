/**
 * Design tokens shared by the canvas engine and the DOM UI.
 * Values may be any CSS color, including `var(--my-token)`; the engine
 * resolves CSS variables against the chart container before painting.
 */
export interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  accent: string;
  fontFamily: string;
  fontSize: number;
  radius: number;
}

export type DirectionPreset = 'kr' | 'global';

const FONT_STACK =
  "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', Roboto, sans-serif";

const DIRECTION_COLORS: Record<DirectionPreset, Pick<ThemeTokens, 'up' | 'down'>> = {
  kr: { up: '#F04452', down: '#3182F6' },
  global: { up: '#12B886', down: '#F04452' },
};

export const lightTheme: ThemeTokens = {
  background: '#FFFFFF',
  surface: '#F2F4F6',
  text: '#191F28',
  textSecondary: '#8B95A1',
  grid: '#F2F4F6',
  border: '#E5E8EB',
  crosshair: '#8B95A1',
  ...DIRECTION_COLORS.kr,
  accent: '#3182F6',
  fontFamily: FONT_STACK,
  fontSize: 12,
  radius: 8,
};

export const darkTheme: ThemeTokens = {
  ...lightTheme,
  background: '#17171C',
  surface: '#202027',
  text: '#E4E4E5',
  textSecondary: '#7E7E87',
  grid: '#202027',
  border: '#2C2C35',
  crosshair: '#7E7E87',
};

export function createTheme(
  base: ThemeTokens,
  overrides: Partial<ThemeTokens> = {},
  direction?: DirectionPreset,
): ThemeTokens {
  return { ...base, ...(direction ? DIRECTION_COLORS[direction] : {}), ...overrides };
}
