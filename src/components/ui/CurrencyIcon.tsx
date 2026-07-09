/**
 * LinkUp App — Currency Icons
 * شعارات العملات الذهبية للتطبيق
 */

import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

import { COIN_CURRENCY_ICON, CASINO_CURRENCY_ICON, PEARL_CURRENCY_ICON } from '@/constants/brandAssets';

interface CurrencyIconProps {
  type: 'coin' | 'pearl' | 'casino';
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const SOURCES = {
  coin: COIN_CURRENCY_ICON,
  pearl: PEARL_CURRENCY_ICON,
  casino: CASINO_CURRENCY_ICON,
};

export const CurrencyIcon: React.FC<CurrencyIconProps> = ({
  type,
  size = 24,
  style,
}) => {
  return (
    <Image
      source={SOURCES[type]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
};
