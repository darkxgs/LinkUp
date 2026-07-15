/**
 * LinkUp App — i18n Setup
 *
 * - يدعم العربية والإنجليزية
 * - العربية هي اللغة الافتراضية لكل المستخدمين الجدد (مستقل عن لغة الجهاز)
 * - يحفظ اختيار المستخدم في AsyncStorage
 * - يطبّق RTL/LTR تلقائياً مع إعادة تحميل ضرورية
 */

import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import en from './locales/en.json';
import i18n from './instance';
import {
  applyRTL,
  resolveStoredLanguage,
  DEFAULT_LANGUAGE,
} from './language';

/**
 * فرض الأرقام اللاتينية (0-9) في كل التطبيق حتى في الواجهة العربية.
 * `Number.prototype.toLocaleString()` بلا locale كان يتبع لغة الجهاز (العربية)
 * فيعرض أرقاماً هندية (١٢٣). نجعل الافتراضي en-US مرة واحدة عند بدء التشغيل —
 * يصلح كل مواضع toLocaleString() دون تعديلها، ويحترم أي locale يُمرَّر صراحةً.
 */
{
  const _origNumberToLocaleString = Number.prototype.toLocaleString;
  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = function (
    this: number,
    locales?: string | string[],
    options?: Intl.NumberFormatOptions,
  ): string {
    return _origNumberToLocaleString.call(this, locales ?? 'en-US', options);
  } as typeof Number.prototype.toLocaleString;
}

export {
  SUPPORTED_LANGUAGES,
  isRTLLanguage,
  setAppLanguage,
  getCurrentLanguage,
  resolveStoredLanguage,
  type SupportedLanguage,
} from './language';

/**
 * تهيئة i18n — تُستدعى مرة واحدة في app/_layout
 */
export const initI18n = async (): Promise<void> => {
  const lng = await resolveStoredLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
    react: {
      useSuspense: false,
    },
  });

  applyRTL(lng);
};

export default i18n;
