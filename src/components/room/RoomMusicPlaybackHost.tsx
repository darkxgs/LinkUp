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
  /**
   * قد تكون null حين لا موسيقى نشطة — يبقى المضيف مركّباً دائماً كي لا
   * تُعاد صفحة الموسيقى (Modal) تركيباً عند بدء/إيقاف التشغيل (كانت تومض
   * تفتح وتقفل لأن الفرع الشرطي في شاشة الروم كان يفكّها ويركّب أخرى).
   */
  music: RoomMusic | null;
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
  // enabled=false حين لا موسيقى أو ألغى المستمع الاستماع — الـhook يعطّل
  // كل تأثيراته حينها فلا محرك يعمل، لكن السياق يظل متاحاً للأبناء الثابتين.
  const playback = useRoomMusicPlayback(
    roomId,
    music,
    userUid,
    !localDismissed && !!music,
    canManageMusic,
  );

  return (
    <RoomMusicPlaybackProvider value={playback}>{children ?? null}</RoomMusicPlaybackProvider>
  );
}

export { useRoomMusicPlayback };
