import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const COIN_SIZES: Record<Size, number> = { xs: 12, sm: 14, md: 16, lg: 20 };
const FONT_SIZES: Record<Size, number> = { xs: 11, sm: 12, md: 14, lg: 16 };

type Props = {
  amount: number;
  size?: Size;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function CoinAmount({ amount, size = 'md', color = '#F59E0B', style }: Props) {
  const coinSize = COIN_SIZES[size];
  return (
    <View style={[styles.row, style]}>
      <Text weight="bold" style={{ color, fontSize: FONT_SIZES[size] }} numberOfLines={1}>
        {Math.floor(amount).toLocaleString('en-US')}
      </Text>
      <Image
        source={WALLET_ASSETS.coin}
        style={{ width: coinSize, height: coinSize }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
