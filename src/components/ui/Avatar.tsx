/**
 * Sada App — Avatar Component
 * Supports frames, online status, level badges
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Text as RNText } from 'react-native';
import { Image, ImageSource } from 'expo-image';

import { colors, radius } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { BLUR_PLACEHOLDER } from '@/utils/imageConfig';
import { FramedAvatar } from './FramedAvatar';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;

interface AvatarProps {
  uri?: string;
  source?: ImageSource;
  size?: AvatarSize;
  showStatus?: boolean;
  isOnline?: boolean;
  frameUri?: string;
  borderColor?: string;
  borderWidth?: number;
  fallbackInitials?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<Exclude<AvatarSize, number>, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 56,
  xl: 80,
  xxl: 120,
};

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  source,
  size = 'md',
  showStatus = false,
  isOnline = false,
  frameUri,
  borderColor,
  borderWidth = 0,
  fallbackInitials,
  style,
}) => {
  const sizeValue = typeof size === 'number' ? size : SIZE_MAP[size];
  const statusSize = sizeValue * 0.25;

  if (frameUri) {
    return (
      <View style={style}>
        <FramedAvatar
          avatarUri={uri}
          frameUri={frameUri}
          avatarSize={sizeValue}
          fallbackLetter={fallbackInitials}
        />
        {showStatus && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: isOnline ? colors.status.online : colors.status.offline,
              borderWidth: 2,
              borderColor: colors.white,
            }}
          />
        )}
      </View>
    );
  }
  
  const containerStyle: ViewStyle = {
    width: sizeValue,
    height: sizeValue,
    position: 'relative',
  };
  
  const imageStyle: ViewStyle = {
    width: sizeValue,
    height: sizeValue,
    borderRadius: sizeValue / 2,
    borderWidth,
    borderColor: borderColor ?? colors.white,
    backgroundColor: colors.brand.primaryLightest,
    overflow: 'hidden',
  };
  
  const statusStyle: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: statusSize,
    height: statusSize,
    borderRadius: statusSize / 2,
    backgroundColor: isOnline ? colors.status.online : colors.status.offline,
    borderWidth: 2,
    borderColor: colors.white,
  };
  
  return (
    <View style={[containerStyle, style]}>
      <View style={imageStyle}>
        {(uri || source) ? (
          <Image
            source={uri ? { uri } : source}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            transition={150}
            placeholder={{ blurhash: BLUR_PLACEHOLDER }}
            placeholderContentFit="cover"
          />
        ) : fallbackInitials ? (
          // اسم/حرف بخط Baloo Bhaijaan 2 (مطابق للتصميم)
          <View style={[styles.initialsBg, { backgroundColor: lu.colors.purple }]}>
            <RNText
              style={{
                fontFamily: 'BalooBhaijaan2_800ExtraBold',
                color: '#fff',
                fontSize: sizeValue * 0.42,
                textShadowColor: 'rgba(0,0,0,0.18)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
                includeFontPadding: false,
              }}
            >
              {fallbackInitials.charAt(0).toUpperCase()}
            </RNText>
          </View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {showStatus && <View style={statusStyle} />}
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.brand.primaryLightest,
  },
  initialsBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
