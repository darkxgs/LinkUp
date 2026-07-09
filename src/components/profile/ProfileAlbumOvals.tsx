/**
 * صور الألبوم — دوائر صغيرة على الغلاف، تكبر عند الضغط
 */
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { ProfileImagePreview } from './ProfileImagePreview';

const CIRCLE_SIZE = 36;

export type ProfileAlbumOvalsProps = {
  photos?: string[];
  style?: ViewStyle;
  maxVisible?: number;
};

export function ProfileAlbumOvals({
  photos,
  style,
  maxVisible = 8,
}: ProfileAlbumOvalsProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const list = (photos ?? [])
    .filter((p) => typeof p === 'string' && p.startsWith('http'))
    .slice(0, maxVisible);

  if (!list.length) return null;

  return (
    <>
      <View style={[styles.wrap, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {list.map((uri, idx) => (
            <Pressable
              key={`${uri}-${idx}`}
              onPress={() => setPreviewUri(uri)}
              style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ProfileImagePreview uri={previewUri} onClose={() => setPreviewUri(null)} />
    </>
  );
}

export const PROFILE_ALBUM_CIRCLE_SIZE = CIRCLE_SIZE;

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  circlePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
