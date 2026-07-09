// Global Configurations — aligned with LinkUp intelligence games economy
window.policyConfig = {
  ALLOWED_BETS: [5000, 10000, 25000, 50000],
  SEQUENCE_LENGTH_BY_BET: {
    5000: 8,
    10000: 10,
    25000: 10,
    50000: 12,
  },
  /** وقت الحفظ والترتيب حسب الدخولية — يُحدَّث من لوحة التحكم */
  TIMING_BY_BET: {
    5000: { memorize: 5, reconstruct: 15 },
    10000: { memorize: 6, reconstruct: 18 },
    25000: { memorize: 8, reconstruct: 20 },
    50000: { memorize: 10, reconstruct: 25 },
  },
  REWARD_MULTIPLIER: 20,
  /** مرحلة حفظ التسلسل (ثوان) — يُحدَّث من لوحة التحكم */
  DISPLAY_SECONDS: 5,
  /** مرحلة إعادة الترتيب (ثوان) — يُحدَّث من لوحة التحكم */
  RECONSTRUCT_SECONDS: 15,
  DEFAULT_BALANCE: 100000,
  DAILY_LIMIT_RESET_HOUR_LOCAL: 0,
};

const ALLOWED_BETS = window.policyConfig.ALLOWED_BETS;
const SEQUENCE_LENGTH_BY_BET = window.policyConfig.SEQUENCE_LENGTH_BY_BET;
const DEFAULT_BALANCE = window.policyConfig.DEFAULT_BALANCE;
const DAILY_LIMIT_RESET_HOUR_LOCAL = window.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL;

function getRewardMultiplier() {
  if (window.IG && window.IG.AppBridge && typeof window.IG.AppBridge.getState === 'function') {
    var mult = Number(window.IG.AppBridge.getState().winMultiplier);
    if (mult > 0) return mult;
  }
  if (window.policyConfig && Number(window.policyConfig.REWARD_MULTIPLIER) > 0) {
    return Number(window.policyConfig.REWARD_MULTIPLIER);
  }
  if (window.GamesConfigUtils && window.GamesConfigUtils.INTELLIGENCE_WIN_MULTIPLIER) {
    return window.GamesConfigUtils.INTELLIGENCE_WIN_MULTIPLIER;
  }
  return 20;
}

function getMemorizeSeconds(bet) {
  var key = bet != null && bet !== '' ? String(Math.floor(Number(bet))) : '';
  if (key && window.policyConfig && window.policyConfig.TIMING_BY_BET && window.policyConfig.TIMING_BY_BET[key]) {
    return Number(window.policyConfig.TIMING_BY_BET[key].memorize);
  }
  if (window.GamesConfigUtils && typeof window.GamesConfigUtils.resolveSequenceMemoryTiming === 'function') {
    return window.GamesConfigUtils.resolveSequenceMemoryTiming(null, null, bet).memorizeSeconds;
  }
  if (window.policyConfig && Number(window.policyConfig.DISPLAY_SECONDS) > 0) {
    return Number(window.policyConfig.DISPLAY_SECONDS);
  }
  return 5;
}

function getSequenceLengthForBet(bet) {
  var key = bet != null && bet !== '' ? String(Math.floor(Number(bet))) : '';
  var map = window.policyConfig && window.policyConfig.SEQUENCE_LENGTH_BY_BET;
  if (key && map && map[key] != null) {
    return Math.max(4, Number(map[key]) || 8);
  }
  if (bet != null && map && map[bet] != null) {
    return Math.max(4, Number(map[bet]) || 8);
  }
  if (SEQUENCE_LENGTH_BY_BET && SEQUENCE_LENGTH_BY_BET[bet] != null) {
    return Number(SEQUENCE_LENGTH_BY_BET[bet]) || 8;
  }
  return 8;
}

function getReconstructSeconds(bet) {
  var key = bet != null && bet !== '' ? String(Math.floor(Number(bet))) : '';
  if (key && window.policyConfig && window.policyConfig.TIMING_BY_BET && window.policyConfig.TIMING_BY_BET[key]) {
    return Number(window.policyConfig.TIMING_BY_BET[key].reconstruct);
  }
  if (window.GamesConfigUtils && typeof window.GamesConfigUtils.resolveSequenceMemoryTiming === 'function') {
    return window.GamesConfigUtils.resolveSequenceMemoryTiming(null, null, bet).reconstructSeconds;
  }
  if (window.policyConfig && Number(window.policyConfig.RECONSTRUCT_SECONDS) > 0) {
    return Number(window.policyConfig.RECONSTRUCT_SECONDS);
  }
  return 15;
}
