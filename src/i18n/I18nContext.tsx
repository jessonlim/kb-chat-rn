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

/**
 * Non-React translation helper. Reads the current language directly
 * from MMKV and picks the right string. Useful in non-component code
 * (axios interceptors, event handlers, native module callbacks) that
 * can't call the `useT` hook but still needs to surface a translated
 * string to the user.
 *
 * NOTE: this snapshots the language at call time. If the user changes
 * language mid-session the result reflects the new language on the
 * NEXT call, not retroactively. That's fine for one-shot toasts.
 */
export const tStatic = (
  key: StringKey,
  vars?: Record<string, string | number>
): string => {
  const entry = STRINGS[key];
  if (!entry) return key;
  const lang = loadLang();
  const template = entry[lang] ?? entry.en;
  return interpolate(template, vars);
};
