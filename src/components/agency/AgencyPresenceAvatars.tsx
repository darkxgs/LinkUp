/**
 * صور المتصلين داخل غرفة الوكالة — ريل تايم
 */
import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Image } from 'expo-image';
import { Mic2 } from 'lucide-react-native';

import { LiveAudioIndicator } from '@/components/room/LiveAudioIndicator';
import type { AgencyPresenceFace } from '@/services/agencyRoomPresence';
import { lu } from '@/theme/lu-brand';

type Variant = 'overlay' | 'inline';

type Props = {
  faces: AgencyPresenceFace[];
  totalCount: number;
  micCount?: number;
  audienceCount?: number;
  variant?: Variant;
  maxVisible?: number;
};

export function AgencyPresenceAvatars({
  faces,
  totalCount,
  micCount = 0,
  audienceCount = 0,
  variant = 'overlay',
  maxVisible = 3,
}: Props) {
  const visible = faces.slice(0, maxVisible);
  const extra = Math.max(0, totalCount - visible.length);
  const isOverlay = variant === 'overlay';

  if (totalCount <= 0 && visible.length === 0) return null;

  return (
    <View style={[styles.wrap, isOverlay ? styles.wrapOverlay : styles.wrapInline]}>
      {isOverlay ? <LiveAudioIndicator /> : null}
      <View style={styles.stack}>
        {visible.map((face, index) => (
          <View
            key={face.uid}
            style={[styles.avatarWrap, index > 0 && styles.avatarOverlap]}
          >
            {face.avatar?.startsWith('http') ? (
              <Image
                source={{ uri: face.avatar }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={face.uid}
                transition={120}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <RNText style={styles.avatarInitial}>
                  {(face.name || '?').charAt(0).toUpperCase()}
                </RNText>
              </View>
            )}
            {face.onMic ? (
              <View style={styles.micBadge}>
                <Mic2 size={7} color="#fff" strokeWidth={2.8} />
              </View>
            ) : null}
          </View>
        ))}
        {extra > 0 ? (
          <View style={[styles.moreBadge, visible.length > 0 && styles.avatarOverlap]}>
            <RNText style={styles.moreText}>+{extra > 99 ? '99' : extra}</RNText>
          </View>
        ) : null}
      </View>
      <RNText style={[styles.countText, isOverlay ? styles.countOverlay : styles.countInline]}>
        {micCount} | {Math.max(audienceCount, Math.max(0, totalCount - micCount))}
      </RNText>
    </View>
  );
}

const AVATAR = 22;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wrapOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  wrapInline: {
    gap: 6,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarOverlap: {
    marginStart: -7,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#374151',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  micBadge: {
    position: 'absolute',
    bottom: -1,
    end: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  moreBadge: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  countOverlay: {
    color: '#fff',
  },
  countInline: {
    color: '#374151',
  },
});
