/**
 * ضبط RTL/LTR من AsyncStorage قبل أول render (في index.js)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_KEY,
  SUPPORTED_LANGUAGES,
  isRTLLanguage,
  type SupportedLanguage,
} from './language';

export async function bootstrapRtlFromStorage(): Promise<SupportedLanguage> {
  let lang: SupportedLanguage = DEFAULT_LANGUAGE;

  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      lang = stored as SupportedLanguage;
    }
  } catch {
    // ignore
  }

  const shouldRTL = isRTLLanguage(lang);

  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(shouldRTL);
    if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
      I18nManager.swapLeftAndRightInRTL(true);
    }
  } catch (e) {
    console.warn('bootstrapRtlFromStorage:', e);
  }

  return lang;
}
