"use client";

import * as React from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "cb-theme";

function getStoredTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return defaultTheme;
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
  isDark: true,
});

export interface ThemeProviderProps {
  defaultTheme?: Theme;
  children: React.ReactNode;
}

function ThemeProvider({ defaultTheme = "dark", children }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => getStoredTheme(defaultTheme));

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggle = () => setThemeState(prev => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return React.useContext(ThemeContext);
}

export { ThemeProvider, useTheme };
