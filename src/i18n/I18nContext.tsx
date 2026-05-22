// KB Chat i18n — port of the web app's I18nContext, swapped to MMKV for RN.
// Default language is Chinese, since the primary client base is zh.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { storage } from '../services/api';
import { STRINGS, interpolate } from './strings';
import type { Lang, StringKey } from './strings';

const LANG_KEY = 'pref.lang';
const DEFAULT_LANG: Lang = 'zh';

const loadLang = (): Lang => {
  const stored = storage.getString(LANG_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  return DEFAULT_LANG;
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  useEffect(() => {
    storage.set(LANG_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>): string => {
      const entry = STRINGS[key];
      if (!entry) return key;
      const template = entry[lang] ?? entry.en;
      return interpolate(template, vars);
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useT = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
};
