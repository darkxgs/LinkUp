/**
 * شريط ترحيب متحرك عند دخول مستخدم جديد لغرفة الوكالة
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Sparkles, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { resolveDisplayName } from '@/utils/displayName';
import { textDirectionStyle } from '@/utils/rtl';

const SCREEN_W = Dimensions.get('window').width;

interface Props {
  name: string;
  /** صورة الداخل — تُعرض بدل أيقونة الشرارة */
  avatar?: string | null;
  visible: boolean;
  onDone: () => void;
  isPrince?: boolean;
  isStaff?: boolean;
  entryImageUrl?: string | null;
}

export function RoomEntryWelcomeBanner({ name, avatar, visible, onDone, isPrince, isStaff, entryImageUrl }: Props) {
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const displayName = resolveDisplayName({ displayName: name });

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(SCREEN_W);
    opacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -SCREEN_W * 0.35,
          duration: isPrince ? 4200 : 3200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [visible, name, onDone, opacity, translateX, isPrince]);

  if (!visible) return null;

  const colors = isPrince
    ? (['rgba(245,158,11,0.95)', 'rgba(180,83,9,0.92)'] as const)
    : isStaff
      ? (['rgba(237, 68, 68, 0.92)', 'rgba(225, 20, 20,0.92)'] as const)
      : (['rgba(225, 20, 20,0.92)', 'rgba(225, 20, 20,0.92)'] as const);

  const showEntryThumb = Boolean(entryImageUrl?.startsWith('http'));
  const showAvatar = !showEntryThumb && Boolean(avatar?.startsWith('http'));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.banner, { opacity, transform: [{ translateX }] }]}>
        <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        {showEntryThumb ? (
          <Image source={{ uri: entryImageUrl! }} style={styles.entryThumb} contentFit="contain" />
        ) : showAvatar ? (
          // صورة الداخل بدل الأيقونة — «إيموجي بدل صورة واسم»
          <Image source={{ uri: avatar! }} style={styles.entryAvatar} contentFit="cover" />
        ) : isPrince ? (
          <Crown size={14} color="#fff" />
        ) : (
          <Sparkles size={14} color="#fff" />
        )}
        <Text
          variant="caption"
          weight="bold"
          color="#fff"
          numberOfLines={1}
          // #14: الاتجاه من قالب العبارة المترجم لا من الاسم — اسم لاتيني كان يقلب الجملة
          style={textDirectionStyle(
            isPrince
              ? t('room.agencyEntryPrinceBanner', { name: '' })
              : isStaff
                ? t('room.staffEntryBanner', { name: '' })
                : t('room.agencyEntryBanner', { name: '' }),
          )}
        >
          {isPrince
            ? t('room.agencyEntryPrinceBanner', { name: displayName })
            : isStaff
              ? t('room.staffEntryBanner', { name: displayName })
              : t('room.agencyEntryBanner', { name: displayName })}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 108,
    start: 0,
    end: 0,
    zIndex: 40,
    overflow: 'hidden',
    height: 38,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    minWidth: SCREEN_W * 0.72,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  entryThumb: { width: 22, height: 22 },
  entryAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
});
