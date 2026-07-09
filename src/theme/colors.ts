/**
 * LinkUp App — Color System
 * أحمر قانٍ / أسود فاخر (مبني على لوجو LinkUp) مع لمسات ذهبية
 */

export const colors = {
  // ============ Brand Colors ============
  brand: {
    primary: '#E11414',          // أحمر LinkUp الرئيسي
    primaryDark: '#B00E0E',
    primaryLight: '#F26161',
    primaryLighter: '#FCA5A5',
    primaryLightest: '#FEE2E2',

    secondary: '#1C1C22',        // أسود فحمي (مكمّل من خلفية اللوجو)
    secondaryDark: '#0E0E11',
    secondaryLight: '#3A3A42',

    accent: '#F59E0B',           // ذهبي للـ VIP/Premium (يبقى كما هو)
    accentDark: '#D97706',

    pink: '#FF4D6D',             // أحمر-وردي للقلوب/الإعجاب
  },

  // ============ Gradients ============
  gradients: {
    // تدرّج التطبيق الرئيسي (خلفية، splash) — رمادي فاتح محايد
    primary: ['#FAFAFB', '#F2F1F4'],

    // تدرّج الهيدر (أحمر اللوجو)
    header: ['#FF2D2D', '#E11414', '#8A0E0E'],

    // Video Match card
    videoMatch: ['#E11414', '#8A0E0E'],

    // Voice Match card
    voiceMatch: ['#FF3838', '#B00E0E'],

    // تدرّج اللوجو
    logo: ['#FF2D2D', '#8A0E0E'],

    // زر الإعجاب (قلب أحمر)
    heart: ['#FF6B6B', '#FF4D6D'],

    // Premium/VIP
    gold: ['#FCD34D', '#F59E0B'],

    // Lucky game
    luckyGame: ['#FF6B6B', '#FF8E53'],

    // Aristocracy / royal — أحمر داكن فاخر
    royal: ['#E11414', '#3A0A0A'],

    // Sunset (للبطاقات)
    sunset: ['#F59E0B', '#E11414'],

    // Avatar placeholders (تبقى ملوّنة للتنوّع)
    avatar1: ['#FFB6C1', '#FFA07A'],
    avatar2: ['#F87171', '#B91C1C'],
    avatar3: ['#EB8787', '#4682B4'],
    avatar4: ['#98FB98', '#3CB371'],
    avatar5: ['#FFE4B5', '#DEB887'],
  },

  // ============ Backgrounds ============
  background: {
    primary: '#FFFFFF',
    secondary: '#F7F7F9',
    tertiary: '#EFEFF2',
    card: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
    blur: 'rgba(255, 255, 255, 0.85)',

    // tint للهيدر — أحمر فاتح جداً بدل اللافندر
    lavender: '#FDECEC',
    skyBlue: '#F6F6F8',
  },

  // ============ Surfaces ============
  surface: {
    elevated: '#FFFFFF',
    pressed: '#EFEFF2',
    highlighted: '#FEE2E2',
  },

  // ============ Text ============
  text: {
    primary: '#15151A',          // حبر أسود (من اللوجو) بدل الكحلي
    secondary: '#56565F',
    tertiary: '#9A9AA5',
    disabled: '#C7C7CF',
    inverse: '#FFFFFF',
    link: '#E11414',
    placeholder: '#9A9AA5',
  },

  // ============ Borders ============
  border: {
    light: '#EFEFF2',
    medium: '#E2E2E7',
    dark: '#C7C7CF',
    focus: '#E11414',
  },

  // ============ Status Colors ============
  status: {
    online: '#4ADE80',
    offline: '#9CA3AF',
    busy: '#EF4444',
    away: '#F59E0B',
  },

  // ============ Semantic ============
  semantic: {
    success: '#10B981',
    successBg: '#D1FAE5',
    warning: '#F59E0B',
    warningBg: '#FEF3C7',
    error: '#EF4444',
    errorBg: '#FEE2E2',
    info: '#ED4444',
    infoBg: '#FCDDDD',
  },

  // ============ Gender ============
  gender: {
    male: '#ED4444',
    maleBg: '#FCDDDD',
    female: '#E11414',
    femaleBg: '#FFE6E9',
  },

  // ============ Special Features ============
  vip: '#F59E0B',
  vipBg: '#FEF3C7',
  aristocracy: '#E11414',
  aristocracyBg: '#FEE2E2',
  verified: '#E11414',           // شارة توثيق حمراء
  level: '#C61414',

  // ============ Generic ============
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // ============ Common Action Buttons ============
  actions: {
    like: '#FF4D6D',
    likeBg: 'rgba(255, 77, 109, 0.1)',
    bookmark: '#F59E0B',
    share: '#ED4444',
    follow: '#E11414',
    unfollow: '#9A9AA5',
    block: '#EF4444',
  },
} as const;

export type ColorTokens = typeof colors;

export const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};
