import { browserLocale, directionColors } from '@funnest/charts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STRINGS, stringsOf } from './i18n';

describe('language', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to Korean only for a Korean browser, English otherwise (and outside a browser)', () => {
    vi.stubGlobal('navigator', { languages: ['ko-KR', 'en'], language: 'ko-KR' });
    expect(browserLocale()).toBe('ko');
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
    expect(browserLocale()).toBe('en');
    vi.stubGlobal('navigator', { languages: ['ja-JP'], language: 'ja-JP' });
    expect(browserLocale()).toBe('en');
    vi.stubGlobal('navigator', undefined);
    expect(browserLocale()).toBe('en');
  });

  it('strings: built-in words for the locale, the app’s on top, one object per locale', () => {
    expect(stringsOf({ locale: 'en' })).toBe(STRINGS.en);
    const strings = { indicators: 'Studies' };
    const en = stringsOf({ locale: 'en', strings });
    expect(en.indicators).toBe('Studies');
    expect(en.searchSymbol).toBe(STRINGS.en.searchSymbol);
    expect(stringsOf({ locale: 'en', strings })).toBe(en); // memoized: no new object per render
    expect(stringsOf({ locale: 'ko', strings }).indicators).toBe('Studies');
    expect(stringsOf({ locale: 'ko', strings }).searchSymbol).toBe(STRINGS.ko.searchSymbol);
  });

  it('up/down presets: Korean red up · blue down, global green up · red down', () => {
    expect(directionColors('kr')).toEqual({ up: '#F04452', down: '#3182F6' });
    expect(directionColors('global')).toEqual({ up: '#12B886', down: '#F04452' });
  });
});
