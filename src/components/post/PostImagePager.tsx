/**
 * PostImagePager — عارض صور المنشور بالتقليب الأفقي.
 * البوستات متعددة الصور كانت تعرض أول صورة فقط بلا أي طريقة لرؤية الباقي —
 * الآن سحب أفقي بين الصور مع نقاط وعدّاد «1/N».
 */
import React, { useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, type ViewToken } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';

type Props = {
  images: string[];
  /** نسبة عرض الصورة لارتفاعها — نفس مقاس البطاقة السابق افتراضياً */
  aspectRatio?: number;
  /**
   * تكيّف بنسبة أبعاد الصورة الأولى (ضمن حدود) بحيث تظهر الصورة كاملة بلا
   * قصّ داخل البطاقة (طلب المالك) — والصور المختلفة النسبة تُحتوى بلا اقتصاص
   */
  adaptiveAspect?: boolean;
  onPressImage?: (index: number) => void;
  /** خصائص تُمرَّر لكل صورة (كاش/انتقال…) */
  imageProps?: Record<string, unknown>;
};

// حدود نسبة البطاقة المتكيفة — أعرض من 1.91 أو أطول من 0.7 يُقصّ لأقرب حد
const ADAPTIVE_MAX_RATIO = 1.91;
const ADAPTIVE_MIN_RATIO = 0.7;

export function PostImagePager({
  images,
  aspectRatio = 1.5,
  adaptiveAspect = false,
  onPressImage,
  imageProps,
}: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const effectiveRatio = adaptiveAspect ? (naturalRatio ?? aspectRatio) : aspectRatio;
  const fit = adaptiveAspect ? 'contain' : 'cover';

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') setIndex(first.index);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  if (images.length === 0) return null;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (Math.abs(w - width) > 1) setWidth(w);
      }}
    >
      {width > 0 ? (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(url, i) => `${i}_${url}`}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index: i }) => (
            <Pressable disabled={!onPressImage} onPress={() => onPressImage?.(i)}>
              <Image
                source={{ uri: item }}
                style={{ width, aspectRatio: effectiveRatio }}
                contentFit={fit}
                recyclingKey={item}
                onLoad={
                  adaptiveAspect && i === 0
                    ? (e) => {
                        const w = e.source?.width ?? 0;
                        const h = e.source?.height ?? 0;
                        if (w > 0 && h > 0) {
                          const r = Math.min(
                            ADAPTIVE_MAX_RATIO,
                            Math.max(ADAPTIVE_MIN_RATIO, w / h),
                          );
                          setNaturalRatio((prev) =>
                            prev == null || Math.abs(prev - r) > 0.01 ? r : prev,
                          );
                        }
                      }
                    : undefined
                }
                {...imageProps}
              />
            </Pressable>
          )}
        />
      ) : (
        // نقيس العرض أولاً — عنصر بنفس الارتفاع حتى لا يقفز التخطيط
        <View style={{ width: '100%', aspectRatio: effectiveRatio }} />
      )}
      {images.length > 1 ? (
        <>
          <View style={styles.counterPill} pointerEvents="none">
            <Text weight="bold" style={styles.counterText}>
              {index + 1}/{images.length}
            </Text>
          </View>
          <View style={styles.dotsRow} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  counterPill: {
    position: 'absolute',
    top: 10,
    end: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 11,
    includeFontPadding: false,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
