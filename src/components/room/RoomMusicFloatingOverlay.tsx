import React, { useEffect, useState } from 'react';
import { subscribeToRoomMusic, type RoomMusic } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { FloatingMusicBubble } from './FloatingMusicBubble';

export function RoomMusicFloatingOverlay() {
  const activeRoomId = useRoomMusicUiStore((s) => s.activeRoomId);
  const [music, setMusic] = useState<RoomMusic | null>(null);

  useEffect(() => {
    if (!activeRoomId) {
      setMusic(null);
      return;
    }
    return subscribeToRoomMusic(activeRoomId, (m) => {
      setMusic(m);
      if (!m) {
        useRoomMusicUiStore.getState().clearIfRoom(activeRoomId);
      }
    });
  }, [activeRoomId]);

  if (!activeRoomId || !music) return null;

  return <FloatingMusicBubble roomId={activeRoomId} music={music} />;
}
