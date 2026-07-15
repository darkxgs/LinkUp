/**
 * رأس شاشة البروفايل — PNG من profile-header.svg + محتوى فوق الموجة
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

import { lu } from '@/theme/lu-brand';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui/FramedAvatar';
import { PROFILE_HEADER_ASPECT, PROFILE_HEADER_IMAGE } from './profileCardAssets';

const AVATAR_SIZE = 92;
const AVATAR_RING = 3;
/** موقع خط الموجة في viewBox (161 / 195) */
const WAVE_Y_RATIO = 161 / 195;

type Props = {
  width: number;
  paddingTop: number;
  horizontalPad: number;
  title: string;
  avatarUri?: string | null;
  /** إطار الملف الشخصي المفعّل (PNG شفاف حول الصورة) */
  frameUri?: string | null;
  avatarFallbackLetter: string;
  onSettingsPress: () => void;
  onAvatarPress: () => void;
  onEditPress?: () => void;
  settingsIcon: React.ReactNode;
};

export function ProfileHeaderBanner({
  width,
  paddingTop,
  horizontalPad,
  title,
  avatarUri,
  frameUri,
  avatarFallbackLetter,
  onSettingsPress,
  onAvatarPress,
  onEditPress,
  settingsIcon,
}: Props) {
  const rotation = useSharedValue(0);
  // زخرفة دوّارة — نوقف الحلقة اللانهائية عندما لا تكون شاشة البروفايل ظاهرة
  // حتى لا تدور على خيط الواجهة بينما المستخدم في شاشة أخرى (توفير معالج/حرارة).
  const isFocused = useIsFocused();
  React.useEffect(() => {
    if (!isFocused) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [isFocused]);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }, { scale: 1.5 }],
    };
  });

  const headerH = Math.round(width * PROFILE_HEADER_ASPECT);
  const frameAvatarInner = AVATAR_SIZE - AVATAR_RING * 2;
  const avatarBlockSize = frameUri
    ? getFramedAvatarContainerSize(frameAvatarInner)
    : AVATAR_SIZE;
  const avatarTop = Math.round(headerH * WAVE_Y_RATIO - avatarBlockSize / 2);
  const blockH = avatarTop + avatarBlockSize;

  return (
    <View style={{ width, height: blockH, marginBottom: 10 }}>
      <Image
        source={PROFILE_HEADER_IMAGE}
        style={{ width, height: headerH, position: 'absolute', top: 0, left: 0 }}
        contentFit="fill"
        cachePolicy="memory-disk"
      />

      <View style={[styles.topBar, { paddingTop: paddingTop + 6, paddingHorizontal: horizontalPad }]}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={onSettingsPress}
          hitSlop={12}
          style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.72 }]}
        >
          {settingsIcon}
        </Pressable>
      </View>

      <View
        style={[
          styles.avatarWrap,
          {
            top: avatarTop,
            left: (width - avatarBlockSize) / 2,
            width: avatarBlockSize,
            height: avatarBlockSize,
          },
        ]}
      >
        <Pressable
          onPress={onAvatarPress}
          style={({ pressed }) => [
            styles.avatarPressable,
            pressed && { opacity: 0.88 }
          ]}
        >
          {frameUri ? (
            <FramedAvatar
              avatarUri={avatarUri ?? undefined}
              frameUri={frameUri}
              avatarSize={frameAvatarInner}
              fallbackLetter={avatarFallbackLetter}
            />
          ) : (
            <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden' }}>
              <AnimatedGradient
                colors={['#FFD700', '#E11414', '#FFD700']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, animatedStyle]}
              />
              <View style={[styles.avatarRing, { backgroundColor: 'transparent', position: 'absolute' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <LinearGradient colors={['#FECACA', TAB_DESIGN.purple]} style={styles.avatarImg}>
                    <Text style={styles.avatarLetter}>{avatarFallbackLetter}</Text>
                  </LinearGradient>
                )}
              </View>
            </View>
          )}
        </Pressable>

        {onEditPress && (
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => [
              styles.editBtn,
              pressed && { opacity: 0.85 }
            ]}
            hitSlop={8}
          >
            <LinearGradient
              colors={['#FF3340', '#B00E0E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.editBtnGradient}
            >
              <Pencil size={12} color="#FFFFFF" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const PROFILE_HEADER_AVATAR_SIZE = AVATAR_SIZE;

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.displayHeavy,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...lu.shadows.card,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    zIndex: 3,
  },
  avatarPressable: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E11414',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  editBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    padding: AVATAR_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: AVATAR_SIZE - AVATAR_RING * 2,
    height: AVATAR_SIZE - AVATAR_RING * 2,
    borderRadius: (AVATAR_SIZE - AVATAR_RING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    fontFamily: lu.fonts.displayHeavy,
  },
});
