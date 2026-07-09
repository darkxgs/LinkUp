import React, { useEffect, useState } from 'react';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';

export function LazyRoomMusicOverlay() {
  const activeRoomId = useRoomMusicUiStore((s) => s.activeRoomId);
  const showSharePicker = useRoomMusicUiStore((s) => s.showSharePicker);
  const [Overlay, setOverlay] = useState<React.ComponentType | null>(null);

  const shouldMount = Boolean(activeRoomId) || showSharePicker;

  useEffect(() => {
    if (!shouldMount || Overlay) return;
    let mounted = true;
    import('./RoomMusicFloatingOverlay')
      .then((m) => {
        if (mounted) setOverlay(() => m.RoomMusicFloatingOverlay);
      })
      .catch((e) => console.warn('RoomMusicFloatingOverlay:', e));
    return () => {
      mounted = false;
    };
  }, [shouldMount, Overlay]);

  if (!shouldMount || !Overlay) return null;
  return <Overlay />;
}
