import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { LuLogo, FULL_LOGO_ASPECT } from '@/components/brand/LuBrand';
import { lu } from '@/theme/lu-brand';

type HeaderMetricsOptions = {
  horizontalPad?: number;
  rightActionCount?: number;
};

function computeLogoDimensions(
  screenWidth: number,
  horizontalPad: number,
  rightActionCount: number,
  iconBtnSize: number,
  iconGap: number,
  rowGap: number,
  tight: boolean,
  compact: boolean,
) {
  const rightWidth =
    rightActionCount > 0
      ? rightActionCount * iconBtnSize + Math.max(0, rightActionCount - 1) * iconGap
      : 0;

  const available = screenWidth - horizontalPad * 2 - rightWidth - rowGap;
  const maxHeight = tight ? 30 : compact ? 36 : 42;
  const minWidth = tight ? 96 : 108;
  const maxWidth = Math.min(Math.floor(available * 0.94), Math.floor(screenWidth * 0.5));

  let logoWidth = Math.max(minWidth, maxWidth);
  let logoHeight = Math.round(logoWidth / FULL_LOGO_ASPECT);

  if (logoHeight > maxHeight) {
    logoHeight = maxHeight;
    logoWidth = Math.round(logoHeight * FULL_LOGO_ASPECT);
  }

  return { logoWidth, logoHeight };
}

export function useTabHeaderMetrics(
  screenWidth?: number,
  options?: HeaderMetricsOptions,
) {
  const { width } = useWindowDimensions();
  const W = screenWidth ?? width;
  const tight = W < 360;
  const compact = W < 400;
  const iconBtnSize = tight ? 34 : compact ? 38 : 44;
  const iconGap = tight ? 3 : compact ? 5 : 8;
  const rowGap = tight ? 4 : 6;
  const horizontalPad = options?.horizontalPad ?? (tight ? 14 : 16);
  const rightActionCount = options?.rightActionCount ?? 2;
  const { logoWidth, logoHeight } = computeLogoDimensions(
    W,
    horizontalPad,
    rightActionCount,
    iconBtnSize,
    iconGap,
    rowGap,
    tight,
    compact,
  );

  return {
    tight,
    compact,
    logoWidth,
    logoHeight,
    showSubtitle: !compact,
    iconBtnSize,
    iconSize: tight ? 18 : compact ? 20 : 22,
    iconGap,
    rowGap,
  };
}

export function HeaderIconButton({
  children,
  onPress,
  size,
  badge,
  dark,
}: {
  children: React.ReactNode;
  onPress: () => void;
  size?: number;
  badge?: boolean;
  dark?: boolean;
}) {
  const metrics = useTabHeaderMetrics();
  const btnSize = size ?? metrics.iconBtnSize;
  const radius = btnSize / 2;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        dark && styles.iconBtnDark,
        { width: btnSize, height: btnSize, borderRadius: radius },
        pressed && { opacity: 0.88 },
      ]}
    >
      {children}
      {badge ? <View style={[styles.circBadge, dark && styles.circBadgeDark]} /> : null}
    </Pressable>
  );
}

type TabScreenHeaderProps = {
  pad: number;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  dark?: boolean;
};

export function TabScreenHeader({
  pad,
  subtitle,
  children,
  style,
  dark,
}: TabScreenHeaderProps) {
  const rightActionCount = React.Children.count(children);
  const metrics = useTabHeaderMetrics(undefined, {
    horizontalPad: pad,
    rightActionCount,
  });
  const { logoWidth, logoHeight, showSubtitle, rowGap } = metrics;

  return (
    <View style={[styles.headerRow, { paddingHorizontal: pad, gap: rowGap }, style]}>
      <View style={styles.headerLeft}>
        <View style={styles.headerTitleColumn}>
          <LuLogo width={logoWidth} height={logoHeight} light={dark} />
          {showSubtitle && subtitle ? (
            <Text
              style={[
                styles.headerSubtitle,
                dark && styles.headerSubtitleDark,
                dark && { paddingStart: Math.round(logoHeight * 1.06) + 8 },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.headerRight, { gap: metrics.iconGap }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerTitleColumn: {
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  headerSubtitle: {
    fontSize: 9.5,
    color: '#9CA3AF',
    fontFamily: lu.fonts.body,
    marginTop: 1,
  },
  headerSubtitleDark: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: -1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  circBadge: {
    position: 'absolute',
    top: 7,
    end: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: lu.colors.live,
    borderWidth: 1.2,
    borderColor: '#fff',
  },
  iconBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  circBadgeDark: {
    borderColor: '#1D1317',
  },
});
