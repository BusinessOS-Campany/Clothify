"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const ACCENTS = [
  "violet",
  "blue",
  "emerald",
  "rose",
  "amber",
  "teal",
] as const;
export type Accent = (typeof ACCENTS)[number];

export type Density = "comfortable" | "compact";

export type AppPreferences = {
  accent: Accent;
  density: Density;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = "clothify-preferences";
const DEFAULTS: AppPreferences = {
  accent: "violet",
  density: "comfortable",
  sidebarCollapsed: false,
  reducedMotion: false,
};

type PreferencesContextValue = AppPreferences & {
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const accent = ACCENTS.includes(parsed.accent as Accent)
      ? (parsed.accent as Accent)
      : DEFAULTS.accent;
    return {
      accent,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return DEFAULTS;
  }
}

export function AppPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<AppPreferences>(loadPreferences);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = prefs.accent;
    root.dataset.density = prefs.density;
    if (prefs.reducedMotion) root.dataset.motion = "reduced";
    else delete root.dataset.motion;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setAccent = useCallback((accent: Accent) => {
    setPrefs((p) => ({ ...p, accent }));
  }, []);
  const setDensity = useCallback((density: Density) => {
    setPrefs((p) => ({ ...p, density }));
  }, []);
  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setPrefs((p) => ({ ...p, sidebarCollapsed }));
  }, []);
  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    setPrefs((p) => ({ ...p, reducedMotion }));
  }, []);

  const value = useMemo(
    () => ({ ...prefs, setAccent, setDensity, setSidebarCollapsed, setReducedMotion }),
    [prefs, setAccent, setDensity, setSidebarCollapsed, setReducedMotion],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error(
      "useAppPreferences must be used inside <AppPreferencesProvider>",
    );
  }
  return ctx;
}