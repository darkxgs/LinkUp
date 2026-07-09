/* =============================================================================
 * wallet.js — the BalanceProvider seam for the casino/wager layer.
 *
 * All balance reads and writes go through a BalanceProvider so the storage
 * mechanism is swappable. Today we ship ONLY LocalBalanceProvider (in-memory).
 *
 * >>> TO CONNECT A REAL WALLET / MONEY BACKEND <<<
 * Implement a RemoteBalanceProvider with the SAME method signatures
 * (getBalance / placeWager / settle) that calls your wallet API instead of
 * mutating a local object. Then in main.js change the single line:
 *       const wallet = new LocalBalanceProvider({ ... });
 *   to: const wallet = new RemoteBalanceProvider({ apiBaseUrl, authToken });
 * Nothing else in the game needs to change — state.js only talks to this
 * interface, never to the storage directly.
 * ========================================================================== */

(function (global) {
  'use strict';

  // High local sandbox balance so challenge bets from app (10k+) never block gameplay UI.
  const STARTING_BALANCE = 100000000;
  const RAKE_PERCENT = 0;        // house cut on the pot; 0 = none (one-line change later)

  /**
   * BalanceProvider interface (documented for implementors):
   *   getBalance(playerId)            -> number
   *   placeWager(playerId, amount)    -> deducts amount, throws if insufficient
   *   settle(winnerId, pot)           -> credits the (post-rake) pot to winner;
   *                                      returns the actual amount credited
   */

  class LocalBalanceProvider {
    /**
     * @param {Object<string, number>} [initial] map of playerId -> starting balance
     */
    constructor(initial) {
      this._balances = Object.assign(
        { P1: STARTING_BALANCE, P2: STARTING_BALANCE },
        initial || {}
      );
    }

    getBalance(playerId) {
      return this._balances[playerId];
    }

    /** Deduct `amount` from a player. Throws if they can't cover it. */
    placeWager(playerId, amount) {
      if (amount <= 0) throw new Error('Wager must be positive');
      if (this._balances[playerId] < amount) {
        throw new Error(playerId + ' has insufficient balance');
      }
      this._balances[playerId] -= amount;
      return this._balances[playerId];
    }

    /**
     * Pay out the pot to the winner, minus the configured rake.
     * @returns {number} amount actually credited to the winner.
     */
    settle(winnerId, pot) {
      const rake = Math.floor(pot * (RAKE_PERCENT / 100));
      const payout = pot - rake;
      this._balances[winnerId] += payout;
      return payout;
    }
  }

  global.Wallet = {
    STARTING_BALANCE,
    RAKE_PERCENT,
    LocalBalanceProvider,
  };
})(window);
