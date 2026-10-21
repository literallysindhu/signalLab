import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage';

interface AppSettings {
  showTechnical: boolean;
  setShowTechnical: (v: boolean) => void;
  reducedMotion: boolean;
}

const Ctx = createContext<AppSettings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [showTechnical, setShowTechnical] = useState<boolean>(() => loadJSON(STORAGE_KEYS.settings, { showTechnical: false }).showTechnical);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.settings, { showTechnical });
  }, [showTechnical]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReducedMotion(mq.matches);
    const on = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  return <Ctx.Provider value={{ showTechnical, setShowTechnical, reducedMotion }}>{children}</Ctx.Provider>;
}

export function useSettings(): AppSettings {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
