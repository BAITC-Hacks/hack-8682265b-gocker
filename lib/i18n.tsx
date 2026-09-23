"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import en, { Translations } from "@/locales/en";
import ru from "@/locales/ru";

type Locale = "en" | "ru";

const LOCALES: Record<Locale, Translations> = { en, ru };

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: en,
  toggleLocale: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mg_locale") as Locale | null;
      if (stored && (stored === "en" || stored === "ru")) {
        setLocale(stored);
      }
    } catch {}
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: Locale = prev === "en" ? "ru" : "en";
      try {
        localStorage.setItem("mg_locale", next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t: LOCALES[locale], toggleLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
