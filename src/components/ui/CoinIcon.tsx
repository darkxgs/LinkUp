import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** أيقونة الكوينز الرسمية للتطبيق */
export function CoinIcon({ size = 14, style }: Props) {
  return (
    <Image
      source={WALLET_ASSETS.coin}
      style={[styles.img, { width: size, height: size }, style]}
      contentFit="contain"
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  img: {
    flexShrink: 0,
  },
});
