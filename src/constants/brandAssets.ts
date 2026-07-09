/** شعار LinkUp الرسمي (أيقونة مستقلة) */
export const LINKUP_ID_LOGO = require('../../assets/images/linkup-icon-standalone.png');

/** شعار LinkUp كامل — خلفية سوداء (يُستخدم على خلفيات فاتحة) */
export const LINKUP_FULL_LOGO_BLACK = require('../../assets/images/linkup-full-logo-black.png');

/** أيقونة التطبيق المستقلة (بدون نص) */
export const LINKUP_ICON_STANDALONE = require('../../assets/images/linkup-icon-standalone.png');

/** أيقونة LinkUp الرئيسية — إطار أحمر واضح على خلفية داكنة */
export const LINKUP_MAIN_LOGO = require('../../assets/Main Logo.png');

/** شعار LinkUp الكامل لشاشة البداية (Link أبيض + Up أحمر) */
export const LINKUP_SPLASH_WORDMARK = require('../../assets/23.jpeg');

/** صورة السبلاش الأصلية (Native) — أيقونة + شعار */
export const LINKUP_NATIVE_SPLASH = require('../../assets/linkup-native-splash.png');

/** نسبة عرض/ارتفاع شعار السبلاش */
export const LINKUP_SPLASH_WORDMARK_ASPECT = 2098 / 564;

/** أصول تُحمَّل مسبقاً قبل إخفاء شاشة البداية */
export const SPLASH_PRELOAD_ASSETS = [
  LINKUP_MAIN_LOGO,
  LINKUP_ICON_STANDALONE,
  LINKUP_SPLASH_WORDMARK,
] as const;

/** أيقونة عملة الماسة في التطبيق */
export const PEARL_CURRENCY_ICON = require('../../assets/masa.png');

/** أيقونة عملة الكوينز (العملات الذهبية) */
export const COIN_CURRENCY_ICON = require('../../assets/Coin.png');

/** أيقونة عملة الكازينو */
export const CASINO_CURRENCY_ICON = require('../../assets/casino.png');

/** مدة شاشة البداية (مللي ثانية) */
export const APP_SPLASH_DURATION_MS = 3000;
