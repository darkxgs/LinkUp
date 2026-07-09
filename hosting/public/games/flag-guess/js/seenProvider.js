/*
 * seenProvider.js
 * -----------------------------------------------------------------------------
 * SHARED, REUSABLE across the suite. Remembers which content a user has ALREADY
 * been shown, so a place/question never repeats for that user ("لو وحده جت لشخص
 * مترجعش تاني"). Per-user AND per-game (key includes gameId).
 *
 *   SeenProvider interface:
 *     getSeen(userId, gameId)            -> string[]  (seen keys)
 *     isSeen(userId, gameId, key)        -> boolean
 *     markSeen(userId, gameId, key)      -> void
 *     reset(userId, gameId)              -> void      (start a fresh cycle)
 *
 * For GeoNames the key is the place's stable id (Wikipedia page id / url);
 * for the static fallback it's the item id.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};

  function LocalSeenProvider(options) {
    options = options || {};
    this._prefix = options.storagePrefix || 'ig_seen';
  }

  LocalSeenProvider.prototype._key = function (userId, gameId) {
    return this._prefix + '_' + userId + '_' + gameId;
  };

  LocalSeenProvider.prototype.getSeen = function (userId, gameId) {
    try { return JSON.parse(global.localStorage.getItem(this._key(userId, gameId))) || []; }
    catch (e) { return []; }
  };

  LocalSeenProvider.prototype.isSeen = function (userId, gameId, key) {
    return this.getSeen(userId, gameId).indexOf(String(key)) !== -1;
  };

  LocalSeenProvider.prototype.markSeen = function (userId, gameId, key) {
    var seen = this.getSeen(userId, gameId);
    if (seen.indexOf(String(key)) === -1) {
      seen.push(String(key));
      try { global.localStorage.setItem(this._key(userId, gameId), JSON.stringify(seen)); } catch (e) {}
    }
  };

  LocalSeenProvider.prototype.reset = function (userId, gameId) {
    try { global.localStorage.removeItem(this._key(userId, gameId)); } catch (e) {}
  };

  /*
   * SECURITY/SCALE NOTE: client-side seen history can be cleared by the user and
   * grows unbounded over years of play. A real build tracks "seen" server-side
   * per account. Swap LocalSeenProvider for a RemoteSeenProvider, same interface.
   */

  IG.LocalSeenProvider = LocalSeenProvider;

})(typeof window !== 'undefined' ? window : this);
