import { useEffect, useState } from 'react';
import {
  subscribeToMatchQueueOnlineCount,
  type MatchType,
} from '@/services/firebase/matching';

/** عدد من يبحثون عن مطابقة الآن (داخل قائمة الانتظار فقط) */
export function useMatchQueueOnlineCount(type: MatchType): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeToMatchQueueOnlineCount(type, setCount);
    return unsub;
  }, [type]);

  return count;
}
