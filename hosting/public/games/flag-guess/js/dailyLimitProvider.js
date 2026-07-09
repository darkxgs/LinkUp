/*
 * dailyLimitProvider.js
 * -----------------------------------------------------------------------------
 * SHARED, REUSABLE across the whole Intelligence Games suite.
 *
 * Enforces "each game is playable once per calendar day, per user account".
 * The limit is PER GAME, not shared across the suite — the storage key includes
 * gameId, so Game #1 and Game #2 have independent daily counters.
 *
 *   DailyLimitProvider interface:
 *     hasPlayedToday(userId, gameId) -> boolean
 *     recordPlay(userId, gameId)     -> void
 *
 * Plus a shared helper for the "come back tomorrow" countdown:
 *     IG.timeUntilNextReset() -> { ms, hours, minutes, seconds }
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};
  var policyConfig = IG.policyConfig;

  // Local calendar-day string, e.g. "2026-06-21". Because the storage key embeds
  // this date, the counter "resets" automatically each day with NO extra logic.
  function todayDateString(date) {
    var d = date || new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  /**
   * LocalDailyLimitProvider — localStorage-backed stub.
   */
  function LocalDailyLimitProvider(options) {
    options = options || {};
    this._storageKey = options.storageKey || 'ig_daily_limit';
    this._cache = this._load();
  }

  LocalDailyLimitProvider.prototype._load = function () {
    try {
      return JSON.parse(global.localStorage.getItem(this._storageKey)) || {};
    } catch (e) {
      return {};
    }
  };

  LocalDailyLimitProvider.prototype._save = function () {
    try {
      global.localStorage.setItem(this._storageKey, JSON.stringify(this._cache));
    } catch (e) {
      /* storage unavailable — in-memory only for this session */
    }
  };

  LocalDailyLimitProvider.prototype._key = function (userId, gameId) {
    return userId + '_' + gameId + '_' + todayDateString();
  };

  LocalDailyLimitProvider.prototype.hasPlayedToday = function (userId, gameId) {
    return this._cache[this._key(userId, gameId)] === true;
  };

  LocalDailyLimitProvider.prototype.recordPlay = function (userId, gameId) {
    this._cache[this._key(userId, gameId)] = true;
    this._save();
  };

  // Demo/testing helper only — lets the dev "reset" button clear today's lock.
  LocalDailyLimitProvider.prototype.resetForTesting = function (userId, gameId) {
    delete this._cache[this._key(userId, gameId)];
    this._save();
  };

  /*
   * SECURITY NOTE (leave in code, per spec):
   * This client-side check is for DEMO / UX purposes ONLY. A technical user can
   * bypass it by clearing storage or changing their device clock. A real-money
   * production version MUST enforce this limit SERVER-SIDE, validated against a
   * SERVER clock — never the client's clock.
   *
   * >>> FUTURE: RemoteDailyLimitProvider plugs in here, same interface, async. <<<
   */

  // Shared countdown helper to the next local reset (default: midnight).
  IG.timeUntilNextReset = function (now) {
    now = now || new Date();
    var resetHour = policyConfig ? policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL : 0;
    var next = new Date(now);
    next.setHours(resetHour, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1); // already past today's reset -> go to tomorrow
    }
    var ms = next - now;
    var totalSeconds = Math.floor(ms / 1000);
    return {
      ms: ms,
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  };

  IG.todayDateString = todayDateString;
  IG.LocalDailyLimitProvider = LocalDailyLimitProvider;

})(typeof window !== 'undefined' ? window : this);
