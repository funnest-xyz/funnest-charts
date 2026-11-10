'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type Lang = 'ko' | 'en';

const LocaleContext = createContext<Lang>('ko');

/** Language of the current page, for client demos (chart labels, currency, months). */
export function LocaleProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>;
}

export const useLang = () => useContext(LocaleContext);
