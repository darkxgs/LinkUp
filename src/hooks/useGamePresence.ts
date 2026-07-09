import { useEffect, useState } from 'react';
import {
  enterGamePresence,
  subscribeToGamePresenceCounts,
  EMPTY_GAME_PRESENCE,
  type GameCategory,
  type GamePresenceCounts,
} from '@/services/firebase/gamePresence';

/** يشترك في عدّاد المتصلين لكل قسم لعبة (للعرض على الكروت) */
export function useGamePresenceCounts(): GamePresenceCounts {
  const [counts, setCounts] = useState<GamePresenceCounts>(EMPTY_GAME_PRESENCE);

  useEffect(() => {
    const unsub = subscribeToGamePresenceCounts(setCounts);
    return unsub;
  }, []);

  return counts;
}

/** يسجّل حضور المستخدم في قسم لعبة طوال بقائه على الشاشة */
export function useMarkGamePresence(category: GameCategory | null | undefined): void {
  useEffect(() => {
    if (!category) return;
    const leave = enterGamePresence(category);
    return leave;
  }, [category]);
}
