/**
 * LinkUp App — Theme Store (dark/light)
 * وضع السمة مخزَّن محلياً في AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'linkup.themeMode';

type ThemeState = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },
  toggleMode: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
}));

// ترطيب أولي من التخزين المحلي عند تحميل الوحدة.
AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v === 'light' || v === 'dark') {
      useThemeStore.setState({ mode: v, hydrated: true });
    } else {
      useThemeStore.setState({ hydrated: true });
    }
  })
  .catch(() => useThemeStore.setState({ hydrated: true }));

/** وضع السمة الحالي + مبدّل — للاستخدام في الشاشات. */
export const useThemeMode = () => {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return { mode, isDark: mode === 'dark', setMode };
};
