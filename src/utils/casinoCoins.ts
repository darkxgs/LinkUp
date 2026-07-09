/**
 * عملة الكازينو — التخزين الداخلي بوحدات دقيقة (micro):
 * 10,000 وحدة مخزنة = 1 عملة كازينو للعرض
 * مثال: ربح 1,000 كوين → +1,000 مخزنة → 0.1 عملة كازينو
 */
export const COINS_PER_CASINO_COIN = 10_000;

/** قيمة مخزنة في Firestore → عملة كازينو للعرض */
export function toDisplayCasinoCoins(stored: number): number {
  return (Number(stored) || 0) / COINS_PER_CASINO_COIN;
}

/** عملة كازينو (عرض) → وحدات مخزنة */
export function toStoredCasinoCoins(display: number): number {
  return Math.floor((Number(display) || 0) * COINS_PER_CASINO_COIN);
}

/** ربح بالكوينز → وحدات تُضاف لرصيد الكازينو */
export function coinWinToStoredCasino(coinWin: number): number {
  return Math.floor(Number(coinWin) || 0);
}

/** تنسيق رصيد الكازينو للعرض (يدعم الكسور حتى 4 منازل) */
export function formatCasinoCoins(stored: number, maxDecimals = 4): string {
  const display = toDisplayCasinoCoins(stored);
  if (!Number.isFinite(display) || display === 0) return '0';

  const abs = Math.abs(display);
  if (abs >= 1e9) {
    const v = display / 1e9;
    return `${v >= 10 ? Math.floor(v) : v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1e6) {
    const v = display / 1e6;
    return `${v >= 10 ? Math.floor(v) : v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1000) return Math.floor(display).toLocaleString('en-US');

  const fixed = display.toFixed(maxDecimals).replace(/\.?0+$/, '');
  return fixed;
}
