/** Per-computer display preferences (not part of the project): digits, theme, last project. */
import { create } from 'zustand';

export type DigitMode = 'fa' | 'latin';
export type ThemeMode = 'light' | 'dark';

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable: the preference lasts for this session only */
  }
};

const systemDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

interface Prefs {
  digits: DigitMode;
  theme: ThemeMode;
  showNames: boolean;
  setDigits: (d: DigitMode) => void;
  setTheme: (t: ThemeMode) => void;
  setShowNames: (v: boolean) => void;
}

export const usePrefs = create<Prefs>((set) => ({
  digits: read('dp.digits') === 'latin' ? 'latin' : 'fa',
  theme: (read('dp.theme') as ThemeMode | null) ?? (systemDark() ? 'dark' : 'light'),
  showNames: read('dp.showNames') !== '0',
  setDigits: (digits) => {
    write('dp.digits', digits);
    set({ digits });
  },
  setTheme: (theme) => {
    write('dp.theme', theme);
    set({ theme });
  },
  setShowNames: (showNames) => {
    write('dp.showNames', showNames ? '1' : '0');
    set({ showNames });
  },
}));

export const lastProjectId = {
  get: () => read('dp.lastProject'),
  set: (id: string) => write('dp.lastProject', id),
};
