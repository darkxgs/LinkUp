/*
 * policyConfig.js
 * -----------------------------------------------------------------------------
 * SHARED, REUSABLE across the whole "Intelligence Games" (ألعاب الذكاء) suite.
 * Contains ONLY cross-cutting policy constants that ANY future game would also
 * need. Keep this file free of Game #1-specific logic.
 *
 * ES-module equivalent (for when this is later served over http and converted):
 *     export const ALLOWED_BETS = [5000, 10000, 25000, 50000];
 *     export const REWARD_MULTIPLIER = 5;
 *     export const DAILY_LIMIT_RESET_HOUR_LOCAL = 0;
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var policyConfig = {
    // -------------------------------------------------------------------------
    // Suite-wide constants. Edit these values to tune coins, bets, the multiplier,
    // and the GeoNames username. The rest of the game reads IG.policyConfig.*.
    // -------------------------------------------------------------------------

    // Preset bet chips (coins). The player may also enter a CUSTOM bet (below).
    ALLOWED_BETS: [5000, 10000, 25000, 50000],
    // — never below MIN_BET. (MIN_BET defaults to the smallest preset.)
    ALLOW_CUSTOM_BET: true,
    MIN_BET: 5000,

    // Win => net profit = bet × REWARD_MULTIPLIER (total returned = bet + net profit).
    REWARD_MULTIPLIER: 20,

    // Daily counter resets at local midnight. Exposed so the reset logic and the
    // "come back tomorrow" countdown both read from one place.
    DAILY_LIMIT_RESET_HOUR_LOCAL: 0, // midnight, local time

    // The in-game currency is COINS (كوين) — an abstract unit, NOT real money.
    // There is NO real payment / credit card anywhere; coins are simulated.
    CURRENCY_LABEL: 'كوين',   // shown next to amounts in the UI
    CURRENCY_ICON: '◎',       // coin glyph

    // Starting coin balance for a new player.
    STARTING_COINS: 100000,
    // Back-compat alias (older code referenced STARTING_BALANCE).
    STARTING_BALANCE: 100000,

    // Live place source (GeoNames). Free account, NO key/credit card — but the
    // username MUST have "free web services" enabled on the GeoNames account
    // page, and the 'demo' account is forbidden.
    GEONAMES_USERNAME: 'gsdark',
    GEONAMES_BASE: 'https://secure.geonames.org'
  };

  // Attach to the shared Intelligence-Games namespace.
  var IG = global.IG = global.IG || {};
  IG.policyConfig = policyConfig;

})(typeof window !== 'undefined' ? window : this);
