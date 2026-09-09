import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Tungi/kunduzgi rejim. Tanlov <html data-theme="..."> orqali qo'llaniladi
// va localStorage'da saqlanadi — sahifa qayta ochilganda eslab qolinadi.
//
// Oshpaz paneli (Kitchen Display) bu kontekstdan foydalanmaydi — u
// funksional sabablarga ko'ra DOIM qorong'i (o'z CSS'ida qat'iy ranglar).

const STORAGE_KEY = 'bazm.theme';
const ThemeContext = createContext({ theme: 'dark', toggle: () => {} });

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'dark';
  } catch (_) {
    return 'dark';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {
      /* localStorage yopiq bo'lsa ham rejim ishlashda davom etadi */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
      title={theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
    >
      <span className="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
