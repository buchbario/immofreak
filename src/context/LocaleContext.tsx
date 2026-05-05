import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations, type Locale, type TranslationKey } from '../i18n/translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey | (string & {}), vars?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'immofreak_locale';

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'de',
  setLocale: () => {},
  t: (k) => k,
});

function readLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'de' || v === 'en') return v;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  return 'de';
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readLocale());

  // Wenn ein anderes Tab das Locale geändert hat, ziehen wir nach.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === 'de' || v === 'en') setLocaleState(v);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage unavailable */ }
    // <html lang="…"> aktualisieren — gut für Screen-Reader und Browser-Spellcheck
    document.documentElement.lang = l;
  }, []);

  // <html lang="…"> beim ersten Render setzen
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<LocaleContextValue['t']>((key, vars) => {
    const dict = translations[locale] as Record<string, string>;
    const fallback = translations.de as Record<string, string>;
    const value = dict[key] ?? fallback[key] ?? key;
    return interpolate(value, vars);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Hook für Übersetzungen.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   t('common.save')                              // → "Speichern" / "Save"
 *   t('contracts.status.daysLeft', { days: 12 }) // → "12T übrig" / "12d left"
 */
export function useTranslation() {
  return useContext(LocaleContext);
}
