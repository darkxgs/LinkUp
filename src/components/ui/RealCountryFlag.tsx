/**
 * علم دولة حقيقي من flagcdn — مستطيل (كامل) أو دائري للأفاتار الصغير
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

export type CountryFlagShape = 'rectangle' | 'circle';

interface CountryFlagProps {
  countryCode?: string;
  size?: number;
  /** rectangle = علم كامل بدون قصّ (افتراضي للقوائم) */
  shape?: CountryFlagShape;
  /** @deprecated استخدم shape */
  rounded?: boolean;
  style?: ViewStyle;
}

const getFlagUrl = (code: string, width: number): string => {
  const w = Math.max(Math.round(width), 40);
  return `https://flagcdn.com/w${w}/${code.toLowerCase()}.png`;
};

export const RealCountryFlag: React.FC<CountryFlagProps> = ({
  countryCode,
  size = 20,
  shape,
  rounded,
  style,
}) => {
  const resolvedShape: CountryFlagShape =
    shape ?? (rounded === false ? 'rectangle' : rounded === true ? 'circle' : 'rectangle');

  const height = size;
  const width = resolvedShape === 'rectangle' ? Math.round(size * 1.5) : size;
  const borderRadius = resolvedShape === 'circle' ? height / 2 : 4;

  // ⚠️ يصل countryCode أحياناً undefined/فارغ (مستخدم بلا دولة) — نحرس ضد
  //    انهيار toLowerCase ونعرض صندوقاً فارغاً بدل تعطّل الشاشة بالكامل.
  const code = (countryCode ?? '').trim();

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      {code ? (
        <Image
          source={{ uri: getFlagUrl(code, width) }}
          style={{ width, height }}
          contentFit={resolvedShape === 'rectangle' ? 'contain' : 'cover'}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#EEF0F4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
});
