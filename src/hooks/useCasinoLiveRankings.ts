import { useEffect, useMemo, useState } from 'react';
import { subscribeToCasinoLiveActivity } from '@/services/firebase/casinoLiveActivity';
import {
  buildCasinoLiveRankings,
  type CasinoLivePlayer,
} from '@/services/firebase/casinoLiveRankings';

export function useCasinoLiveRankings() {
  const [items, setItems] = useState<Parameters<typeof buildCasinoLiveRankings>[0]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCasinoLiveActivity((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const players = useMemo(() => buildCasinoLiveRankings(items), [items]);
  const activeCount = useMemo(
    () => players.filter((p) => p.isPlayingNow).length,
    [players],
  );

  return { players, activeCount, loading };
};

export type { CasinoLivePlayer };
