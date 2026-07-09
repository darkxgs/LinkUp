/**
 * زر أداة البروفايل — خلفية PNG + أيقونة سداسية
 */
import React, { useId } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { lu } from '@/theme/lu-brand';
import { PROFILE_THEME } from './profileTheme';
import { PROFILE_HEX_ICON_PATH } from './profileWaistedShape';

type Props = {
  label: string;
  width: number;
  height?: number;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  /** اتجاه RTL حسب اللغة (الأيقونة في جهة البداية) */
  rtl?: boolean;
};

const TOOL_ICON_COLOR = PROFILE_THEME.purple;

export function ProfileToolButton({ label, width, height = 56, Icon, onPress, rtl }: Props) {
  const hexGradId = useId().replace(/:/g, '');
  const isRtl = rtl ?? I18nManager.isRTL;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width, height, opacity: pressed ? 0.78 : 1 }]}
    >
      <View style={[styles.wrap, { width, height }]}>
        <View style={[styles.row, { flexDirection: 'row' }]}>
          <View style={styles.hexWrap}>
            <Svg width={32} height={32} viewBox="0 0 41 41">
              <Defs>
                <LinearGradient id={hexGradId} x1="82" y1="83" x2="-19" y2="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#FECACA" />
                  <Stop offset="1" stopColor="#E11414" />
                </LinearGradient>
              </Defs>
              <Path d={PROFILE_HEX_ICON_PATH} fill={`url(#${hexGradId})`} fillOpacity={0.22} />
            </Svg>
            <View style={styles.iconCenter}>
              <Icon size={17} color={TOOL_ICON_COLOR} strokeWidth={1.6} />
            </View>
          </View>
          {/* سطران كحد أقصى ليظهر النص كاملاً (مثل: الشخص الغامض / محفظة الماسة) */}
          <Text
            style={[styles.label, { textAlign: isRtl ? 'right' : 'left' }]}
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(235, 33, 33, 0.08)',
    ...lu.shadows.card,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    gap: 5,
  },
  hexWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: PROFILE_THEME.ink,
    fontFamily: lu.fonts.bodyMedium,
  },
});
