/**
 * شيت سفلي للروم — ينزلق من الأسفل بأنيميشن نظيف.
 * طبقة عائمة (absolute) فوق الشات فقط: لا تُزحزح المقاعد ولا تُعتّم التصميم،
 * وتُغلق باللمس خارجها. تبقى مركّبة أثناء أنيميشن الخروج ثم تُزال.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** المسافة من أسفل الشاشة (ارتفاع الشريط السفلي) */
  bottom: number;
  /** ارتفاع محتوى الشيت — يُستخدم لانزلاقه من الأسفل */
  height: number;
  children: React.ReactNode;
}

export function RoomBottomSheet({ visible, onClose, bottom, height, children }: Props) {
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.setValue(height);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 0, duration: 170, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, height]);

  if (!rendered) return null;

  return (
    <>
      {/* خلفية شفافة لالتقاط اللمس فقط — بلا تعتيم حتى لا تتأثّر المقاعد/التصميم */}
      <Animated.View
        style={[styles.backdrop, { bottom, opacity: backdrop }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { bottom, transform: [{ translateY }] }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    zIndex: 45,
  },
});
