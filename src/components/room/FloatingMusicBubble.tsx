/**
 * نبض موسيقى عائم — موجات فقط، الضغط يلغي الصوت
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { MusicPulseWidget } from '@/components/room/MusicPulseWidget';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { useRoomMusicPlayback } from '@/hooks/useRoomMusicPlayback';
import { removeMusicFromRoom, resolveCanManageRoomMusic, type RoomMusic } from '@/services/roomMusic';
import { useAuth } from '@/hooks/useAuth';

const PULSE = 64;
const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  roomId: string;
  music: RoomMusic;
}

export function FloatingMusicBubble({ roomId, music }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const localDismissed = useRoomMusicUiStore((s) => s.localDismissed);
  const dismissLocally = useRoomMusicUiStore((s) => s.dismissLocally);

  const playbackEnabled = !localDismissed;
  const [canManageMusic, setCanManageMusic] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveCanManageRoomMusic(roomId).then((ok) => {
      if (!cancelled) setCanManageMusic(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, user?.uid]);

  const { canStopMusic, localPlaying, pauseLocal } = useRoomMusicPlayback(
    roomId,
    music,
    user?.uid,
    playbackEnabled,
    canManageMusic,
  );

  const pan = useRef(
    new Animated.ValueXY({
      x: 14,
      y: SCREEN_H * 0.22,
    }),
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: () => pan.extractOffset(),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => pan.flattenOffset(),
    }),
  ).current;

  const handleStopAudio = async () => {
    if (canStopMusic) {
      try {
        await removeMusicFromRoom(roomId);
      } catch (e) {
        console.warn(e);
      }
      return;
    }
    await pauseLocal();
    dismissLocally();
  };

  // الضغط على الفقاعة يعيد فتح الروم (لا يوقف الموسيقى) — كما تفعل فقاعة الروم العائمة
  const reopenRoom = () => {
    router.navigate(`/room/${roomId}` as any);
  };

  if (localDismissed) return null;

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none" collapsable={false}>
      <Animated.View
        style={[styles.bubbleHost, pan.getTranslateTransform()]}
        {...panResponder.panHandlers}
        pointerEvents="box-none"
      >
        <MusicPulseWidget
          size={PULSE}
          playing={localPlaying}
          onPress={reopenRoom}
          accessibilityLabel={t('room.floatingTapReturn')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99990,
    elevation: 99990,
  },
  bubbleHost: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 99990,
    elevation: 99990,
  },
});
