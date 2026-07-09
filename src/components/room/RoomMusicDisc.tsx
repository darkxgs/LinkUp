/**
 * نبض موسيقى داخل الروم — موجات فقط، الضغط يلغي الصوت
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MusicPulseWidget } from '@/components/room/MusicPulseWidget';
import { useRoomMusicPlayback } from '@/hooks/useRoomMusicPlayback';
import { removeMusicFromRoom, type RoomMusic } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';

const PULSE = 64;

interface Props {
  roomId: string;
  music: RoomMusic;
  userUid?: string | null;
}

export function RoomMusicDisc({ roomId, music, userUid }: Props) {
  const { t } = useTranslation();
  const dismissLocally = useRoomMusicUiStore((s) => s.dismissLocally);

  const { isController, localPlaying, pauseLocal } = useRoomMusicPlayback(
    roomId,
    music,
    userUid,
    true,
  );

  const handleStopAudio = async () => {
    if (isController) {
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

  return (
    <View style={styles.host} pointerEvents="box-none">
      <MusicPulseWidget
        size={PULSE}
        playing={localPlaying}
        onPress={() => void handleStopAudio()}
        accessibilityLabel={t('room.musicStopListening', 'إيقاف موسيقى الروم')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    zIndex: 45,
  },
});
