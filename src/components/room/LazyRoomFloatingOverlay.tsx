import React, { useEffect, useState } from 'react';
import { useRoomSessionStore } from '@/stores/roomSessionStore';

/**
 * فقاعة الروم العائمة — تُحمَّل مبكراً عند إقلاع التطبيق لتظهر فور «ابقَ في الروم»
 */
export function LazyRoomFloatingOverlay() {
  const isMinimized = useRoomSessionStore((s) => s.isMinimized);
  const roomId = useRoomSessionStore((s) => s.roomId);
  const [Overlay, setOverlay] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;
    import('./RoomFloatingOverlay')
      .then((m) => {
        if (mounted) setOverlay(() => m.RoomFloatingOverlay);
      })
      .catch((e) => console.warn('RoomFloatingOverlay:', e));
    return () => {
      mounted = false;
    };
  }, []);

  if (!isMinimized || !roomId || !Overlay) return null;
  return <Overlay />;
}
