/**
 * RTL/LTR Bootstrap — يضبط الاتجاه حسب اللغة المحفوظة قبل أول render
 *
 * المنطق:
 *   1) اقرأ اللغة المحفوظة من AsyncStorage (sync via cached value)
 *   2) إذا 'ar' → forceRTL(true)
 *   3) إذا 'en' → forceRTL(false) (مهم: false وليس default)
 *   4) إذا لا شيء محفوظ → 'ar' افتراضياً (RTL)
 *
 * لاحظ: I18nManager.forceRTL يحتاج reload للتفعيل الفعلي،
 * فعند تبديل اللغة من الإعدادات، نتعامل مع الـ reload عبر expo-updates.
 */

import { I18nManager } from 'react-native';

let _enforced = false;

/**
 * يُستدعى مرة واحدة عند بدء التطبيق (في index.js قبل expo-router).
 * متزامن — يقرأ من cached storage value المحقون قبل الـ entry.
 *
 * بما أنه sync ولا يقدر يقرأ AsyncStorage، نعتمد على القاعدة:
 * الافتراضي = RTL (عربي)، وعند تبديل اللغة يحدث reload فيُعاد ضبط الاتجاه.
 */
export function enforceRTL(): void {
  if (_enforced) return;
  _enforced = true;

  try {
    // افتراضياً: السماح بـ RTL مفعّل دائماً
    I18nManager.allowRTL(true);

    // لا نفرض RTL هنا — i18n.ts يستدعي applyRTL() حسب اللغة المحفوظة
    // فقط نضمن swapLeftAndRightInRTL مفعّل عشان left/right styles تنقلب صح
    if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
      I18nManager.swapLeftAndRightInRTL(true);
    }
  } catch (e) {
    console.warn('enforceRTL:', (e as Error)?.message);
  }
}

/** فحص ما إذا كان الاتجاه RTL حالياً */
export function isRTLActive(): boolean {
  return I18nManager.isRTL === true;
}

/** نطاقات الأحرف قوية الاتجاه RTL: عبري + عربي + ملحقاته + أشكال العرض */
const RTL_CHAR_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR_RE = /[A-Za-zÀ-ɏ]/;

/**
 * اتجاه النص حسب أول حرف قوي الاتجاه في المحتوى — للنصوص الديناميكية
 * (رسالة الترحيب، أسماء…) التي قد تكون عربية بينما تخطيط التطبيق LTR.
 * #14: العربية تُعرض RTL دائماً بصرف النظر عن لغة الجهاز/التطبيق.
 */
export function detectTextDirection(text: string | null | undefined): 'rtl' | 'ltr' {
  const value = String(text ?? '');
  for (const ch of value) {
    if (RTL_CHAR_RE.test(ch)) return 'rtl';
    if (LTR_CHAR_RE.test(ch)) return 'ltr';
  }
  return isRTLActive() ? 'rtl' : 'ltr';
}

/** أنماط جاهزة للنص الديناميكي: اتجاه الكتابة + المحاذاة حسب المحتوى */
export function textDirectionStyle(text: string | null | undefined): {
  writingDirection: 'rtl' | 'ltr';
  textAlign: 'right' | 'left';
} {
  const dir = detectTextDirection(text);
  return { writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' };
}

export { reloadApp as reloadForRTLIfNeeded } from './reloadApp';
