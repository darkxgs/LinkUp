/**
 * لوحة «أضف موسيقى» — رفع من الجهاز وإضافة للقائمة
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { Text, BackChevron } from '@/components/ui';
import {
  loadRoomMusicLibrary,
  subscribeToRoomMusicLibrary,
  type UserMusicTrack,
} from '@/services/roomMusicLibrary';
import { playOrQueueTrack } from '@/services/roomMusicQueue';
import type { RoomMusic } from '@/services/roomMusic';
type Props = {
  roomId: string;
  roomMusic: RoomMusic | null;
  onBack: () => void;
  onAdded?: () => void;
  /** يغلق Modal ثم يفتح منتقي الملفات — iOS */
  onPickFromDevice: () => Promise<void>;
  picking?: boolean;
};

export function RoomMusicAddPanel({
  roomId,
  roomMusic,
  onBack,
  onAdded,
  onPickFromDevice,
  picking = false,
}: Props) {
  const { t } = useTranslation();
  const [tracks, setTracks] = useState<UserMusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadRoomMusicLibrary(roomId);
    setTracks(list);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
    return subscribeToRoomMusicLibrary(roomId, setTracks);
  }, [roomId, refresh]);

  const handleAddTrack = async (track: UserMusicTrack) => {
    if (busyId) return;
    setBusyId(track.id);
    try {
      await playOrQueueTrack(roomId, track, roomMusic);
      onAdded?.();
      onBack();
    } catch (e) {
      console.warn('RoomMusicAddPanel add:', e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <BackChevron size={22} color="#fff" />
        </Pressable>
        <Text variant="body" weight="bold" color="#fff">
          {t('room.musicAddTitle')}
        </Text>
        <Pressable
          onPress={() => void onPickFromDevice()}
          hitSlop={10}
          disabled={picking}
        >
          {picking ? (
            <ActivityIndicator size="small" color="#FF4D4F" />
          ) : (
            <Text variant="body" weight="semibold" color="#FF4D4F">
              {t('room.musicUploadBtn')}
            </Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF4D4F" />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={tracks.length ? styles.list : styles.listEmpty}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text variant="body" color="rgba(255,255,255,0.55)" align="center">
                {t('room.musicLibraryEmpty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => void handleAddTrack(item)}
              disabled={busyId === item.id}
            >
              <View style={styles.plusCircle}>
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color="#888" />
                ) : (
                  <Plus size={18} color="#888" strokeWidth={2.5} />
                )}
              </View>
              <Text variant="body" color="#fff" numberOfLines={2} style={styles.rowTitle}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#200D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  list: {
    paddingVertical: 8,
  },
  listEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    textAlign: 'right',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
