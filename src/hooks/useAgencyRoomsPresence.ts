import { useEffect, useState } from 'react';

import {
  subscribeToAgencyRoomLivePresence,
  type AgencyRoomPresenceSnapshot,
} from '@/services/agencyRoomPresence';

const MAX_TRACKED_ROOMS = 28;

export function useAgencyRoomsPresence(roomIds: string[]): Record<string, AgencyRoomPresenceSnapshot> {
  const [byRoomId, setByRoomId] = useState<Record<string, AgencyRoomPresenceSnapshot>>({});

  useEffect(() => {
    const ids = [...new Set(roomIds.filter(Boolean))].slice(0, MAX_TRACKED_ROOMS);
    if (!ids.length) {
      setByRoomId({});
      return;
    }

    const unsubs = ids.map((roomId) =>
      subscribeToAgencyRoomLivePresence(roomId, (snapshot) => {
        setByRoomId((prev) => ({ ...prev, [roomId]: snapshot }));
      }),
    );

    setByRoomId((prev) => {
      const next: Record<string, AgencyRoomPresenceSnapshot> = {};
      for (const id of ids) {
        if (prev[id]) next[id] = prev[id]!;
      }
      return next;
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [roomIds.join('|')]);

  return byRoomId;
}
