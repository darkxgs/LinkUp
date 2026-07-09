/**
 * Hook موحّد لاستخدام اللغة في التطبيق
 *
 * import { useAppLanguage } from '@/localization/useAppLanguage';
 * const { t, lang, isRTL, changeLanguage } = useAppLanguage();
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  setAppLanguage,
  getCurrentLanguage,
  isRTLLanguage,
  type SupportedLanguage,
} from '@/localization/language';
import { reloadApp } from '@/utils/reloadApp';

export function useAppLanguage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as SupportedLanguage) ?? getCurrentLanguage();
  const isRTL = isRTLLanguage(lang);

  const changeLanguage = useCallback(
    async (newLang: SupportedLanguage) => {
      if (newLang === lang) return;
      const { needsReload } = await setAppLanguage(newLang);
      if (needsReload) {
        await reloadApp();
      }
    },
    [lang],
  );

  return {
    t,
    lang,
    isRTL,
    changeLanguage,
  };
}
