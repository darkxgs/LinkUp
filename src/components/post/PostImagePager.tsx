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
  onPressImage?: (index: number) => void;
  /** خصائص تُمرَّر لكل صورة (كاش/انتقال…) */
  imageProps?: Record<string, unknown>;
};

export function PostImagePager({ images, aspectRatio = 1.5, onPressImage, imageProps }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

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
                style={{ width, aspectRatio }}
                contentFit="cover"
                recyclingKey={item}
                {...imageProps}
              />
            </Pressable>
          )}
        />
      ) : (
        // نقيس العرض أولاً — عنصر بنفس الارتفاع حتى لا يقفز التخطيط
        <View style={{ width: '100%', aspectRatio }} />
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
