/**
 * يبقي الاستماع للمؤثرات الصوتية أثناء تصغير الروم
 */
import React from 'react';
import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { useAuth } from '@/hooks/useAuth';
import { SoundEffectsPlayer } from '@/components/room/SoundEffectsPanel';

export function RoomSessionHost() {
  const { isMinimized, roomId } = useRoomSessionStore();
  const { user } = useAuth();

  if (!isMinimized || !roomId) return null;

  return <SoundEffectsPlayer roomId={roomId} myUid={user?.uid} muted={false} />;
}
