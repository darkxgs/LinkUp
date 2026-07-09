// =============================================================================
// wallet.js — Casino wager layer (LOCAL / SIMULATED ONLY).
//
// All balance reads/writes go through the BalanceProvider interface so the
// in-memory simulation can later be swapped for a real wallet/API with ZERO
// changes to game logic. state.js/main.js only ever call this interface — they
// never touch a balances object directly.
//
//   interface BalanceProvider {
//     getBalance(playerId): number
//     placeWager(playerId, amount): boolean   // returns false if insufficient
//     settle(winnerId, pot): void             // credit the pot to the winner
//   }
//
// ►► TO GO LIVE WITH REAL MONEY:  write a RemoteBalanceProvider that implements
//    the same three methods backed by your wallet API (async fetch calls), then
//    swap the one line in main.js:  `const wallet = new LocalBalanceProvider()`.
//    Nothing else in the codebase needs to change. A sketch is at the bottom.
// =============================================================================

const WALLET_CONFIG = {
  // High local sandbox balance so challenge bets from app (10k+) never block gameplay UI.
  STARTING_BALANCE: 100000000,
  RAKE_PERCENT: 0,        // house cut on the pot; 0 = none. Future: one-line change.
};

class LocalBalanceProvider {
  constructor(starting = WALLET_CONFIG.STARTING_BALANCE) {
    // In-memory only — no persistence by design (see "Out of Scope").
    this._balances = { 0: starting, 1: starting };
  }

  getBalance(playerId) {
    return this._balances[playerId] ?? 0;
  }

  // Deduct a wager into the pot. Returns false if the player can't cover it.
  placeWager(playerId, amount) {
    if (amount < 0) return false;
    if (this._balances[playerId] < amount) return false;
    this._balances[playerId] -= amount;
    return true;
  }

  // Credit the (post-rake) pot to the winner.
  settle(winnerId, pot) {
    const rake = Math.floor(pot * (WALLET_CONFIG.RAKE_PERCENT / 100));
    const payout = pot - rake;
    this._balances[winnerId] += payout;
    return { payout, rake };
  }

  // Convenience for resetting a fresh match's balances in dev/testing.
  setBalance(playerId, value) { this._balances[playerId] = value; }
}

// -----------------------------------------------------------------------------
// FUTURE: real wallet. Same interface, async under the hood. main.js would
// `await` these; the wager screen already gates Start behind a balance check.
//
// export class RemoteBalanceProvider {
//   constructor(apiBase, authToken) { ... }
//   async getBalance(playerId)        { return (await api.get(`/wallet/${playerId}`)).coins; }
//   async placeWager(playerId, amount){ return (await api.post('/wager', {playerId, amount})).ok; }
//   async settle(winnerId, pot)       { await api.post('/settle', {winnerId, pot}); }
// }
// -----------------------------------------------------------------------------
