import { useEffect, useState } from 'react';
import {
  CasinoTopWinner,
  CasinoWinnerPeriod,
  subscribeToCasinoTopWinners,
} from '@/services/firebase/casinoLeaderboard';

export function useCasinoTopWinners(period: CasinoWinnerPeriod) {
  const [winners, setWinners] = useState<CasinoTopWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCasinoTopWinners(period, (data) => {
      setWinners(data);
      setLoading(false);
    });
    return unsub;
  }, [period]);

  return { winners, loading };
}
