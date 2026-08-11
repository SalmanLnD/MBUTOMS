import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  THEMES,
  toggleTheme as toggleStoredTheme,
} from '../utils/themeManager.js';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setAppTheme = useCallback((nextTheme) => {
    const resolved = applyTheme(nextTheme);
    setTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(toggleStoredTheme());
  }, []);

  const value = useMemo(() => ({
    theme,
    isDark: theme === THEMES.DARK,
    setTheme: setAppTheme,
    toggleTheme,
  }), [theme, setAppTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
