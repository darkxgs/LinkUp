/**
 * LinkUp App — Typography System
 * يستخدم خطوط Cairo من @expo-google-fonts/cairo
 */

import { TextStyle } from 'react-native';

// === Font families ===
// مطابق لـ brand.css في التصميم:
//   Cairo — الخط الأساسي للنصوص العربية (body)
//   Baloo Bhaijaan 2 — خط العرض (.disp): الشعار، الأرقام الكبيرة، العناوين البطولية
//   Tajawal — خط بديل ثانوي (خيار الخط في لوحة التصميم)
export const fontFamilies = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
} as const;

// Baloo Bhaijaan 2 — display
export const displayFamilies = {
  medium: 'BalooBhaijaan2_500Medium',
  semibold: 'BalooBhaijaan2_600SemiBold',
  bold: 'BalooBhaijaan2_700Bold',
  extrabold: 'BalooBhaijaan2_800ExtraBold',
} as const;

// Tajawal — alternate body
export const altFamilies = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  extrabold: 'Tajawal_800ExtraBold',
} as const;

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

// === Get font family helper ===
export const getFontFamily = (weight: Weight = 'regular'): string => {
  return fontFamilies[weight] ?? fontFamilies.regular;
};

// === Display font helper (Baloo Bhaijaan 2) ===
export const getDisplayFamily = (
  weight: 'medium' | 'semibold' | 'bold' | 'extrabold' = 'bold',
): string => {
  return displayFamilies[weight] ?? displayFamilies.bold;
};

// === Font sizes ===
export const fontSizes = {
  xs: 11,
  caption: 12,
  bodySmall: 13,
  body: 14,
  label: 13,
  labelSmall: 11,
  button: 15,
  buttonSmall: 13,
  h4: 16,
  h3: 18,
  h2: 22,
  h1: 28,
  display1: 36,
  display2: 48,
} as const;

// === Line heights ===
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// === Font weights (React Native compatible) ===
export const fontWeights: Record<
  'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black',
  TextStyle['fontWeight']
> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

// === Predefined text styles ===
// ⚠️ lineHeight مضبوط بنسبة ≥1.5× من fontSize لأن العربية (الحركات + النوازل
//    مثل ج/ح/ع + الصواعد) تُقصّ على أندرويد مع lineHeight ضيّق. لا تُنقِص هذه القيم.
export const textStyles = {
  display1: { fontSize: 40, lineHeight: 52 },
  display2: { fontSize: 32, lineHeight: 42 },
  h1: { fontSize: 26, lineHeight: 38 },
  h2: { fontSize: 22, lineHeight: 32 },
  h3: { fontSize: 19, lineHeight: 28 },
  h4: { fontSize: 17, lineHeight: 26 },
  bodyLarge: { fontSize: 17, lineHeight: 27 },
  body: { fontSize: 15, lineHeight: 24 },
  bodySmall: { fontSize: 13, lineHeight: 21 },
  label: { fontSize: 13, lineHeight: 21 },
  labelSmall: { fontSize: 11, lineHeight: 17 },
  button: { fontSize: 15, lineHeight: 23 },
  buttonSmall: { fontSize: 13, lineHeight: 20 },
  caption: { fontSize: 11, lineHeight: 17 },
} as const;

export type TextStyleName = keyof typeof textStyles;
