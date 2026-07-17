/**
 * LinkUp App — useRooms Hook
 */

import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import {
  subscribeToRooms,
  subscribeToRoom,
  subscribeToHostPrivateRoom,
  Room,
} from '@/services/firebase/rooms';
import { readListCache, writeListCache } from '@/utils/persistentListCache';

// cache على مستوى الموديول — عرض فوري للغرف عند العودة للشاشة دون سبينر حاجب
let roomsCache: Room[] = [];

export const useRooms = (limit: number = 20) => {
  const [rooms, setRooms] = useState<Room[]>(roomsCache);
  const [hostPrivateRoom, setHostPrivateRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(roomsCache.length === 0);

  useEffect(() => {
    let mounted = true;

    // أُزيل زرع الغرف التجريبية نهائياً (2026-07-17): جلسات التطوير متوصلة
    // بمشروع الإنتاج نفسه، ولو فرغت rooms لحظةً كان سيُزرع غرف وهمية
    // بمضيفين وعدادات مزيفة في الإنتاج — دالة seedDemoRooms باقية للنداء اليدوي فقط.

    // فتح بارد: اعرض آخر غرف مخزّنة قرصياً فوراً ريثما يصل الاشتراك الحي
    if (roomsCache.length === 0) {
      readListCache<Room>('rooms').then((disk) => {
        if (mounted && disk?.length && roomsCache.length === 0) {
          roomsCache = disk;
          setRooms(disk);
          setLoading(false);
        }
      });
    }

    const unsubList = subscribeToRooms((data) => {
      roomsCache = data;
      writeListCache('rooms', data);
      if (!mounted) return;
      setRooms(data);
      setLoading(false);
    }, limit);

    const unsubPrivate = subscribeToHostPrivateRoom(setHostPrivateRoom);

    return () => {
      mounted = false;
      unsubList();
      unsubPrivate();
    };
  }, [limit]);

  const roomsWithMyHostFirst = useMemo(() => {
    if (!hostPrivateRoom || hostPrivateRoom.isActive === false) return rooms;
    const rest = rooms.filter((r) => r.id !== hostPrivateRoom.id);
    return [hostPrivateRoom, ...rest];
  }, [rooms, hostPrivateRoom]);

  return { rooms: roomsWithMyHostFirst, loading, hostPrivateRoom };
};

export const useRoom = (roomId: string | undefined) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToRoom(roomId, (data) => {
      setRoom(data);
      setLoading(false);
    });
    return unsub;
  }, [roomId]);

  return { room, loading };
};
