/**
 * LinkUp App — Smart Text Component
 * Auto-handles RTL, Arabic fonts (Cairo from Google Fonts), and theme colors
 */

import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/colors';
import {
  fontWeights,
  fontSizes,
  getFontFamily,
  getDisplayFamily,
  textStyles,
} from '@/theme/typography';

type Variant =
  | 'display1' | 'display2'
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'bodyLarge' | 'body' | 'bodySmall'
  | 'label' | 'labelSmall'
  | 'button' | 'buttonSmall'
  | 'caption';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

interface TextProps extends RNTextProps {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  size?: keyof typeof fontSizes;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  numberOfLines?: number;
  children: React.ReactNode;
}

// Default weights per variant
const DEFAULT_WEIGHTS: Record<Variant, Weight> = {
  display1: 'bold',
  display2: 'bold',
  h1: 'bold',
  h2: 'semibold',
  h3: 'semibold',
  h4: 'semibold',
  bodyLarge: 'regular',
  body: 'regular',
  bodySmall: 'regular',
  label: 'medium',
  labelSmall: 'medium',
  button: 'semibold',
  buttonSmall: 'semibold',
  caption: 'regular',
};

// Fallback styles if textStyles is missing (مطابقة لـ typography.ts)
const FALLBACK_STYLES: Record<Variant, TextStyle> = {
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
};

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight,
  color,
  size,
  align,
  style,
  children,
  ...rest
}) => {
  const effectiveWeight: Weight = weight ?? DEFAULT_WEIGHTS[variant] ?? 'regular';

  // ⭐ display1/display2 يستخدمان خط العرض (Baloo Bhaijaan 2) لمطابقة هوية التصميم
  //   باقي variants تستخدم Cairo عبر getFontFamily
  const isDisplay = variant === 'display1' || variant === 'display2';
  const fontFamily = isDisplay
    ? getDisplayFamily(effectiveWeight === 'bold' ? 'extrabold' : 'bold')
    : getFontFamily(effectiveWeight);

  const variantStyle = textStyles?.[variant] ?? FALLBACK_STYLES[variant];
  const computedFontWeight = fontWeights?.[effectiveWeight] ?? '400';
  const textColor = color ?? colors?.text?.primary ?? '#1A0A0C';

  const { i18n } = useTranslation();
  const rtl = I18nManager.isRTL || i18n.language?.startsWith('ar') === true;

  const computedStyle: TextStyle = {
    ...variantStyle,
    fontFamily,
    fontWeight: computedFontWeight,
    color: textColor,
    textAlign: align ?? (rtl ? 'right' : 'left'),
    writingDirection: rtl ? 'rtl' : 'ltr',
    // ⚠️ لا تضع includeFontPadding:false هنا — الحشو الافتراضي يحمي حركات/نوازل
    //    العربية من القص على أندرويد، مع lineHeight السخيّ في typography.ts.
    textAlignVertical: 'center',
    ...(size && fontSizes?.[size] && { fontSize: fontSizes[size] }),
  };

  return (
    <RNText style={[computedStyle, style]} {...rest}>
      {children}
    </RNText>
  );
};

// Convenience exports
export const Heading: React.FC<TextProps> = (props) => <Text variant="h2" {...props} />;
export const Body: React.FC<TextProps> = (props) => <Text variant="body" {...props} />;
export const Caption: React.FC<TextProps> = (props) => (
  <Text variant="caption" color={colors?.text?.tertiary ?? '#9A9AA5'} {...props} />
);
export const Label: React.FC<TextProps> = (props) => <Text variant="label" {...props} />;
