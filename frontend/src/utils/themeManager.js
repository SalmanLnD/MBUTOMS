const THEME_STORAGE_KEY = 'toms_theme';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const getStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  } catch {
    return THEMES.LIGHT;
  }
};

export const applyTheme = (theme) => {
  const resolved = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.documentElement.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    // ignore storage errors
  }
  return resolved;
};

export const initTheme = () => applyTheme(getStoredTheme());

export const toggleTheme = () => {
  const next = getStoredTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  return applyTheme(next);
};
