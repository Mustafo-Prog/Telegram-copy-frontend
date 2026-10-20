import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ru from './locales/ru.js';
import en from './locales/en.js';
import uz from './locales/uz.js';

const STORAGE_KEY = 'tg_lang';
const DEFAULT_LANG = 'ru';

export const LANGUAGES = [
  { code: 'ru', label: 'RU', name: 'Русский', locale: 'ru-RU' },
  { code: 'en', label: 'EN', name: 'English', locale: 'en-US' },
  { code: 'uz', label: 'UZ', name: 'Oʻzbekcha', locale: 'uz-UZ' },
];

const DICTIONARIES = { ru, en, uz };

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTIONARIES[saved]) return saved;
  } catch {
    return DEFAULT_LANG;
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = tag?.slice(0, 2).toLowerCase();
    if (DICTIONARIES[code]) return code;
  }
  return DEFAULT_LANG;
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);
  const locale = useMemo(() => LANGUAGES.find((l) => l.code === lang).locale, [lang]);
  const pluralRules = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!DICTIONARIES[code]) return;
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      return;
    }
  }, []);

  const t = useCallback(
    (key, params = {}) => {
      const entry = DICTIONARIES[lang][key] ?? DICTIONARIES[DEFAULT_LANG][key];
      if (entry === undefined) return key;
      const template =
        typeof entry === 'string' ? entry : (entry[pluralRules.select(params.count ?? 0)] ?? entry.other);
      return interpolate(template, params);
    },
    [lang, pluralRules]
  );

  const tError = useCallback(
    (err) => {
      const key = err?.code ? `errors.${err.code}` : null;
      if (key && (key in DICTIONARIES[lang] || key in DICTIONARIES[DEFAULT_LANG])) {
        return t(key, err.params);
      }
      return err?.message || t('errors.server');
    },
    [lang, t]
  );

  const formatTime = useCallback((value) => timeFormat.format(new Date(value)), [timeFormat]);

  const formatDay = useCallback(
    (value) => {
      const date = new Date(value);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (date.toDateString() === today.toDateString()) return t('chat.today');
      if (date.toDateString() === yesterday.toDateString()) return t('chat.yesterday');
      const options = { day: 'numeric', month: 'long' };
      if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
      return new Intl.DateTimeFormat(locale, options).format(date);
    },
    [locale, t]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, tError, formatTime, formatDay }),
    [lang, setLang, t, tError, formatTime, formatDay]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
