/*
 * walletProvider.js
 * -----------------------------------------------------------------------------
 * SHARED, REUSABLE across the whole Intelligence Games suite.
 *
 * Defines the BalanceProvider INTERFACE and ships a single in-memory
 * implementation (LocalBalanceProvider) for the demo. A future
 * RemoteBalanceProvider (real wallet / payment API) implements the SAME
 * interface and drops in with zero changes to game code.
 *
 *   BalanceProvider interface:
 *     getBalance(userId)        -> number
 *     debit(userId, amount)     -> number (new balance)   [place a wager / spend]
 *     credit(userId, amount)    -> number (new balance)   [pay out winnings]
 *     setBalance(userId, amount)-> number (new balance)   [ADMIN: set coins outright]
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};
  var policyConfig = IG.policyConfig;

  /**
   * LocalBalanceProvider — in-memory + localStorage-backed stub.
   * Persists to localStorage so the balance survives a page refresh during demo.
   * NOT secure and NOT authoritative — see security note below.
   */
  function LocalBalanceProvider(options) {
    options = options || {};
    this._storageKey = options.storageKey || 'ig_wallet';
    this._startingBalance =
      typeof options.startingBalance === 'number'
        ? options.startingBalance
        : (policyConfig ? policyConfig.STARTING_BALANCE : 1000);
    this._cache = this._load();
  }

  LocalBalanceProvider.prototype._load = function () {
    try {
      return JSON.parse(global.localStorage.getItem(this._storageKey)) || {};
    } catch (e) {
      return {};
    }
  };

  LocalBalanceProvider.prototype._save = function () {
    try {
      global.localStorage.setItem(this._storageKey, JSON.stringify(this._cache));
    } catch (e) {
      /* storage unavailable (private mode / file://) — fall back to in-memory only */
    }
  };

  LocalBalanceProvider.prototype.getBalance = function (userId) {
    if (typeof this._cache[userId] !== 'number') {
      this._cache[userId] = this._startingBalance;
      this._save();
    }
    return this._cache[userId];
  };

  LocalBalanceProvider.prototype.debit = function (userId, amount) {
    var current = this.getBalance(userId);
    this._cache[userId] = Math.max(0, current - amount);
    this._save();
    return this._cache[userId];
  };

  LocalBalanceProvider.prototype.credit = function (userId, amount) {
    var current = this.getBalance(userId);
    this._cache[userId] = current + amount;
    this._save();
    return this._cache[userId];
  };

  // ADMIN: set a player's coin balance outright (top-up / adjust). A real build
  // routes this through an authenticated server endpoint — clients must never set
  // their own balance in production.
  LocalBalanceProvider.prototype.setBalance = function (userId, amount) {
    this._cache[userId] = Math.max(0, Math.round(Number(amount) || 0));
    this._save();
    return this._cache[userId];
  };

  /*
   * ----------------------------------------------------------------------------
   * >>> FUTURE: RemoteBalanceProvider plugs in RIGHT HERE <<<
   * ----------------------------------------------------------------------------
   * Implement the same three methods against your real wallet/payment API, e.g.:
   *
   *   function RemoteBalanceProvider(apiClient) { this.api = apiClient; }
   *   RemoteBalanceProvider.prototype.getBalance = function (userId) {
   *     return this.api.get('/wallet/' + userId);          // returns a Promise
   *   };
   *   RemoteBalanceProvider.prototype.debit  = function (userId, amount) { ... };
   *   RemoteBalanceProvider.prototype.credit = function (userId, amount) { ... };
   *
   * NOTE: a real provider will be ASYNC (Promises). The game code awaits the
   * results, and all real-money balance mutations MUST be validated server-side.
   * Swap the instance created in main.js — nothing else changes.
   * ----------------------------------------------------------------------------
   *
   * SECURITY NOTE: LocalBalanceProvider is a demo stub. Balances stored on the
   * client can be edited by any technical user. A real-money build must treat the
   * server as the single source of truth for all balances and transactions.
   */

  IG.LocalBalanceProvider = LocalBalanceProvider;

})(typeof window !== 'undefined' ? window : this);
