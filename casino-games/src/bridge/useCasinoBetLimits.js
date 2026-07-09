import { useMemo, useCallback, useEffect } from 'react';

export function getCasinoBetLimits(gameConfig) {
  const minBet = Math.max(1, Math.floor(Number(gameConfig?.minBet) || 100));
  const maxBet = Math.max(minBet, Math.floor(Number(gameConfig?.maxBet) || 100000));
  return { minBet, maxBet };
}

export function clampCasinoBet(value, minBet, maxBet) {
  const n = Math.floor(Number(value) || minBet);
  return Math.min(maxBet, Math.max(minBet, n));
}

export function buildBetPresets(minBet, maxBet, count = 4) {
  const candidates = [minBet, minBet * 5, minBet * 10, minBet * 50, maxBet];
  const unique = [];
  candidates.forEach((v) => {
    const n = clampCasinoBet(v, minBet, maxBet);
    if (!unique.includes(n)) unique.push(n);
  });
  return unique.slice(0, count);
}

/** مزامنة حدود الرهان مع config/games من التطبيق (مثل Crash) */
export function useCasinoBetLimits(gameConfig, setBetAmount) {
  const { minBet, maxBet } = useMemo(() => getCasinoBetLimits(gameConfig), [gameConfig]);
  const betPresets = useMemo(() => buildBetPresets(minBet, maxBet), [minBet, maxBet]);
  const clampBet = useCallback((v) => clampCasinoBet(v, minBet, maxBet), [minBet, maxBet]);

  useEffect(() => {
    if (typeof setBetAmount === 'function') {
      setBetAmount((prev) => clampCasinoBet(prev, minBet, maxBet));
    }
  }, [minBet, maxBet, setBetAmount]);

  return { minBet, maxBet, betPresets, clampBet };
}
