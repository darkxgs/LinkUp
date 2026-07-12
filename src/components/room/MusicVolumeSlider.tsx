/**
 * MusicVolumeSlider — شريط صوت موحّد لموسيقى الروم (0–100)
 *
 * أفقي RTL-صديق: الاتجاه يتبع I18nManager (في العربية التعبئة من اليمين —
 * السحب يمين = أعلى)، ويعتمد إحداثيات النافذة (pageX) بدل locationX التي
 * تقفز حين يخرج الإصبع عن الشريط. يدعم السحب والنقر معاً، مع haptic عند
 * 0/50/100 وقنص أي قيمة تحت 5% إلى صفر (أيقونة الكتم تظهر تحت 5% —
 * لا «مكتوم» في الواجهة وصوت 1–4% مسموع فعلياً).
 *
 * الاستدعاء فوري مع كل حركة — من يريد debounce للكتابة (RTDB) يضعه في
 * onChange عنده (مدير الخلط يكتب بـdebounce 250ms).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  I18nManager,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/components/ui';

type Props = {
  /** القيمة 0..1 */
  value: number;
  /** تُستدعى فوراً مع كل حركة (0..1) */
  onChange: (v: number) => void;
  /** تسمية فوق الشريط (اختياري) */
  label?: string;
  /** تلميح صغير تحت الشريط (اختياري) — للتسمية الصادقة عند المستمع */
  hint?: string;
  disabled?: boolean;
  /** لون التعبئة — افتراضي وردي العلامة */
  fillColor?: string;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function MusicVolumeSlider({
  value,
  onChange,
  label,
  hint,
  disabled = false,
  fillColor = '#FF6B35',
}: Props) {
  const trackRef = useRef<View>(null);
  const trackStart = useRef(0);
  const trackW = useRef(1);
  const lastHapticMark = useRef<number | null>(null);
  // قيمة عرض متفائلة: أثناء السحب تُرسم القيمة المحلية فوراً — value قد
  // يصل عبر RTDB بعد debounce 250ms + رحلة شبكة (كان الامتلاء يتأخر خلف
  // الإصبع فيرتعش)؛ تحديث الخارج يُزامَن فقط حين لا سحب جارياً
  const [localValue, setLocalValue] = useState(value);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!draggingRef.current) setLocalValue(value);
  }, [value]);
  const lastValueRef = useRef(value);
  lastValueRef.current = localValue;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const maybeHaptic = useCallback((next: number, prev: number) => {
    // haptic عند بلوغ الأطراف (0/100) أو عبور المنتصف (50)
    let mark: number | null = null;
    if (next === 0) mark = 0;
    else if (next === 1) mark = 100;
    else if (prev < 0.5 !== next < 0.5) mark = 50;
    if (mark === null || lastHapticMark.current === mark) return;
    lastHapticMark.current = mark;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const setFromPageX = useCallback(
    (pageX: number) => {
      if (disabledRef.current) return;
      const w = trackW.current;
      if (w <= 0) return;
      let ratio = (pageX - trackStart.current) / w;
      // RTL: التعبئة من اليمين — الحافة اليمنى = 100%
      if (I18nManager.isRTL) ratio = 1 - ratio;
      let next = clamp01(ratio);
      // قنص للصفر: تحت عتبة أيقونة الكتم (5%) = كتم حقيقي
      if (next < 0.05) next = 0;
      next = Math.round(next * 100) / 100;
      const prev = lastValueRef.current;
      if (next === prev) return;
      maybeHaptic(next, prev);
      lastValueRef.current = next;
      setLocalValue(next);
      onChangeRef.current(next);
    },
    [maybeHaptic],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (evt) => {
        draggingRef.current = true;
        const pageX = evt.nativeEvent.pageX;
        // قياس موضع الشريط في النافذة عند بدء اللمسة — يدعم النقر المباشر
        trackRef.current?.measureInWindow((x, _y, w) => {
          trackStart.current = x;
          if (w > 0) trackW.current = w;
          setFromPageX(pageX);
        });
      },
      onPanResponderMove: (evt) => setFromPageX(evt.nativeEvent.pageX),
      onPanResponderRelease: () => {
        draggingRef.current = false;
        lastHapticMark.current = null;
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        lastHapticMark.current = null;
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    if (e.nativeEvent.layout.width > 0) trackW.current = e.nativeEvent.layout.width;
  };

  const progress = Math.round(clamp01(localValue) * 100);
  const isRTL = I18nManager.isRTL;
  const fillPos: import('react-native').ViewStyle = isRTL
    ? { right: 0, width: `${progress}%` }
    : { left: 0, width: `${progress}%` };
  const thumbPos: import('react-native').ViewStyle = isRTL
    ? { right: `${progress}%`, marginRight: -8 }
    : { left: `${progress}%`, marginLeft: -8 };

  return (
    <View style={[styles.wrap, disabled ? styles.disabled : null]}>
      {label ? (
        <View style={styles.labelRow}>
          {localValue < 0.05 ? (
            <VolumeX size={14} color="rgba(255,255,255,0.6)" />
          ) : (
            <Volume2 size={14} color="rgba(255,255,255,0.85)" />
          )}
          <Text variant="caption" color="rgba(255,255,255,0.65)" style={styles.label}>
            {label}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.pct}>
            {progress}%
          </Text>
        </View>
      ) : null}
      <View
        ref={trackRef}
        collapsable={false}
        onLayout={onLayout}
        style={styles.touch}
        {...pan.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { backgroundColor: fillColor }, fillPos]} />
          <View style={[styles.thumb, { borderColor: fillColor }, thumbPos]} />
        </View>
      </View>
      {hint ? (
        <Text variant="caption" color="rgba(255,255,255,0.4)" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  label: {
    flex: 1,
    fontSize: 11,
  },
  pct: {
    width: 40,
    textAlign: 'center',
    fontSize: 11,
  },
  touch: {
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -5,
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  hint: {
    marginTop: 2,
    fontSize: 10,
  },
});
