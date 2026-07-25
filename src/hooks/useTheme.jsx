import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const settingsStr = localStorage.getItem('dayscore_settings');
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        return settings.theme || 'dark';
      } catch (e) {
        return 'dark';
      }
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const settingsStr = localStorage.getItem('dayscore_settings');
    let settings = {};
    if (settingsStr) {
      try {
        settings = JSON.parse(settingsStr);
      } catch (e) {}
    }
    settings.theme = theme;
    localStorage.setItem('dayscore_settings', JSON.stringify(settings));
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
