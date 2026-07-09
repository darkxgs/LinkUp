import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** أيقونة كوينز الكازينو */
export function CasinoCoinIcon({ size = 14, style }: Props) {
  return (
    <Image
      source={WALLET_ASSETS.casino}
      style={[styles.img, { width: size, height: size }, style]}
      contentFit="contain"
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  img: { flexShrink: 0 },
});
