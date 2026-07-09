/**
 * موسيقى + فيديو الروم أثناء «احتفظ» — يبقيان يعملان مع الصوت خارج شاشة الروم
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { RoomMusicPlaybackHost } from '@/components/room/RoomMusicPlaybackHost';
import { RoomVideoPlayer } from '@/components/room/RoomVideoPlayer';
import { subscribeToRoomMusic, type RoomMusic } from '@/services/roomMusic';
import { subscribeToRoomVideo, type RoomVideo, canControlRoomVideo, isAgencyManagerForRoom } from '@/services/roomVideo';
import { ref, onValue, off, type DataSnapshot } from 'firebase/database';
import { realtimeDb } from '@/services/firebase';
import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { useRoomVideoUiStore } from '@/stores/roomVideoUiStore';

export function RoomPinnedMediaHost() {
  const { user } = useAuth();
  const pinned =
    useRoomSessionStore((s) => s.audioPinned && s.isMinimized && !!s.roomId);
  const roomId = useRoomSessionStore((s) => s.roomId);
  const [music, setMusic] = useState<RoomMusic | null>(null);
  const [video, setVideo] = useState<RoomVideo | null>(null);
  const [hostUid, setHostUid] = useState('');
  const [coHosts, setCoHosts] = useState<string[]>([]);
  const [roomMeta, setRoomMeta] = useState<Record<string, unknown>>({});
  const videoMuted = useRoomVideoUiStore((s) => s.localMuted);

  const staffProfile = useMemo(
    () =>
      user
        ? {
            staffRole: user.staffRole ?? null,
            staffCountries: user.staffCountries,
            staffActive: user.staffActive,
          }
        : null,
    [user?.staffRole, user?.staffCountries, user?.staffActive],
  );

  const canControlVideo = useMemo(() => {
    if (!user?.uid) return false;
    const roomAgencyId = roomMeta.agencyId != null ? String(roomMeta.agencyId) : '';
    const isAgencyManager = isAgencyManagerForRoom(user, roomAgencyId || undefined);
    return canControlRoomVideo(user.uid, roomMeta, {
      staff: staffProfile,
      isAgencyManager,
    });
  }, [user, roomMeta, staffProfile]);

  useEffect(() => {
    if (!pinned || !roomId) {
      setMusic(null);
      setVideo(null);
      return undefined;
    }

    useRoomMusicUiStore.getState().setActive(roomId);
    useRoomMusicUiStore.getState().resetDismiss();
    useRoomVideoUiStore.getState().setPinned(roomId, { unmuted: true });

    const unsubMusic = subscribeToRoomMusic(roomId, setMusic);
    const unsubVideo = subscribeToRoomVideo(roomId, setVideo);

    const roomRef = ref(realtimeDb, `rooms/${roomId}`);
    const onRoom = (snap: DataSnapshot) => {
      const raw = (snap.val() ?? {}) as Record<string, unknown>;
      setRoomMeta(raw);
      setHostUid(String(raw.hostUid ?? ''));
      const ch = raw.coHosts;
      setCoHosts(Array.isArray(ch) ? ch.map(String) : []);
    };
    onValue(roomRef, onRoom);

    return () => {
      unsubMusic();
      unsubVideo();
      off(roomRef, 'value', onRoom);
    };
  }, [pinned, roomId]);

  if (!pinned || !roomId) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {music ? (
        <RoomMusicPlaybackHost roomId={roomId} music={music} userUid={user?.uid} />
      ) : null}
      {video ? (
        <RoomVideoPlayer
          roomId={roomId}
          video={video}
          userUid={user?.uid}
          canControl={canControlVideo}
          roomHostUid={hostUid}
          coHosts={coHosts}
          defaultMuted={videoMuted}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99980,
    elevation: 99980,
  },
});
