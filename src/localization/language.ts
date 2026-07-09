/**
 * Language helpers — منفصلة عن i18n.ts لتفادي تعارض التصدير مع default export
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import i18n from './instance';

const LANGUAGE_KEY = '@linkup:language';
const RTL_KEY = '@linkup:rtl-applied';

export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: SupportedLanguage = 'ar';

export const isRTLLanguage = (lang: SupportedLanguage): boolean => lang === 'ar';

const applyRTL = (lang: SupportedLanguage): boolean => {
  const shouldBeRTL = isRTLLanguage(lang);
  const isCurrentRTL = I18nManager.isRTL;

  if (shouldBeRTL !== isCurrentRTL) {
    try {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      return true;
    } catch (e) {
      console.warn('Failed to apply RTL:', e);
    }
  }
  return false;
};

export const setAppLanguage = async (
  lang: SupportedLanguage,
): Promise<{ needsReload: boolean }> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    await i18n.changeLanguage(lang);

    const needsReload = applyRTL(lang);
    if (needsReload) {
      await AsyncStorage.setItem(RTL_KEY, '1');
    }
    return { needsReload };
  } catch (e) {
    console.error('Failed to set language:', e);
    return { needsReload: false };
  }
};

export const getCurrentLanguage = (): SupportedLanguage => {
  const current = i18n.language;
  if (SUPPORTED_LANGUAGES.includes(current as SupportedLanguage)) {
    return current as SupportedLanguage;
  }
  return DEFAULT_LANGUAGE;
};

export const resolveStoredLanguage = async (): Promise<SupportedLanguage> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
};

export { DEFAULT_LANGUAGE, LANGUAGE_KEY, RTL_KEY, applyRTL };
