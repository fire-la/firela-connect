import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext(null);
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(null);
export const useSetTheme = () => useContext(SetThemeContext);

// Detect system theme preference
const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, _setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme-mode') || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [systemTheme, setSystemTheme] = useState(getSystemTheme());

  // Calculate the actual applied theme
  const actualTheme = theme === 'auto' ? systemTheme : theme;

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleSystemThemeChange = (e) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, []);

  // Apply theme to DOM
  useEffect(() => {
    const body = document.body;
    if (actualTheme === 'dark') {
      body.setAttribute('theme-mode', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      body.removeAttribute('theme-mode');
      document.documentElement.classList.remove('dark');
    }
  }, [actualTheme]);

  const setTheme = useCallback((newTheme) => {
    let themeValue;

    if (typeof newTheme === 'boolean') {
      // Backward compatibility with original boolean parameter
      themeValue = newTheme ? 'dark' : 'light';
    } else if (typeof newTheme === 'string') {
      // New string parameter supports 'light', 'dark', 'auto'
      themeValue = newTheme;
    } else {
      themeValue = 'auto';
    }

    _setTheme(themeValue);
    localStorage.setItem('theme-mode', themeValue);
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
