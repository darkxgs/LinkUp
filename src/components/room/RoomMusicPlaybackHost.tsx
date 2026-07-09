/**
 * تشغيل موسيقى الروم — محرك صوت فقط (بدون لوحة عائمة في منتصف الشاشة)
 */
import type { ReactNode } from 'react';
import { useRoomMusicPlayback } from '@/hooks/useRoomMusicPlayback';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { RoomMusicPlaybackProvider } from '@/contexts/RoomMusicPlaybackContext';
import type { RoomMusic } from '@/services/roomMusic';

type Props = {
  roomId: string;
  music: RoomMusic;
  userUid?: string | null;
  canManageMusic?: boolean;
  children?: ReactNode;
};

export function RoomMusicPlaybackHost({
  roomId,
  music,
  userUid,
  canManageMusic = false,
  children,
}: Props) {
  const localDismissed = useRoomMusicUiStore((s) => s.localDismissed);
  const playback = useRoomMusicPlayback(
    roomId,
    music,
    userUid,
    !localDismissed,
    canManageMusic,
  );

  if (localDismissed) return null;

  return (
    <RoomMusicPlaybackProvider value={playback}>{children ?? null}</RoomMusicPlaybackProvider>
  );
}

export { useRoomMusicPlayback };
