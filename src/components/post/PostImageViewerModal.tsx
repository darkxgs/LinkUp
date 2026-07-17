/**
 * PostImageViewerModal — عارض صور المنشور بالحجم الكامل (ملء الشاشة).
 * تقليب أفقي بين الصور + تكبير بالقرص (iOS) + عدّاد، ويبدأ من الصورة المضغوطة.
 * مشترك بين بطاقة اللحظات (تفتحه مباشرة) وصفحة تفاصيل المنشور.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  FlatList,
  ScrollView,
  Pressable,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui';

type Props = {
  images: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function PostImageViewerModal({ images, initialIndex, visible, onClose }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const safeInitial = Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1));
  const [index, setIndex] = useState(safeInitial);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') setIndex(first.index);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bg}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitial}
          getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
          keyExtractor={(url, i) => `${i}_${url}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.zoomScroll}
              style={{ width: winW }}
            >
              <Image
                source={{ uri: item }}
                style={{ width: winW, height: winH * 0.8 }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        />
        {images.length > 1 ? (
          <View style={styles.counterPill} pointerEvents="none">
            <Text weight="bold" style={styles.counterText}>
              {index + 1}/{images.length}
            </Text>
          </View>
        ) : null}
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  zoomScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPill: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 12,
    includeFontPadding: false,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    end: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
