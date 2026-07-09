import { useEffect, useState } from 'react';
import {
  CasinoActivityItem,
  subscribeToCasinoLiveActivity,
} from '@/services/firebase/casinoLiveActivity';

export function useCasinoLiveActivity() {
  const [items, setItems] = useState<CasinoActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCasinoLiveActivity((data) => {
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { items, loading };
}
