import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Lang = 'ar' | 'en';

type LangContextValue = {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem('linkup_lang');
    return stored === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const dir = lang === 'en' ? 'ltr' : 'rtl';

  const setLang = (nextLang: Lang) => {
    const next = nextLang === 'en' ? 'en' : 'ar';
    try {
      localStorage.setItem('linkup_lang', next);
    } catch {
      /* ignore */
    }
    setLangState(next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return (
    <LangContext.Provider value={{ lang, dir, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

export const langBtn = {
  active: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
    color: '#fff',
    background: 'linear-gradient(120deg,#b00814,#e11212,#8b0000)',
  },
  inactive: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
    color: '#7c6e6e',
    background: 'transparent',
  },
} as const;
