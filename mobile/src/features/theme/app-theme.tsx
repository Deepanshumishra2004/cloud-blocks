import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

type AppThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      toggleTheme: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }
  return context;
}
