/* ============================================================
   Linkup — Data layer  (the ONLY place that touches storage)
   ------------------------------------------------------------
   Demo mode keeps everything in localStorage and rolls the dice
   client-side. Every method is async (returns a Promise) so that
   switching to a real database/backend is a drop-in change:

   To go live, replace the bodies marked  >>> DB INTEGRATION POINT <<<
   with fetch() calls to your API, e.g.

     async placeBet({ amount, target }) {
       const res = await fetch('/api/limbo/bet', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         credentials: 'include',
         body: JSON.stringify({ amount, target }),
       });
       if (!res.ok) throw new Error((await res.json()).message);
       return res.json();   // { betId, result, target, amount, won, payout, balance, ... }
     }

   The server should: validate the balance, roll with a provably-fair
   RNG (see js/limbo.js), update the wallet, and persist the bet row.
   Never trust an amount/result computed on the client in production.
   ============================================================ */
(function (global) {
  "use strict";

  const STORAGE_KEY = "linkup_limbo_state_v1";
  const STARTING_BALANCE = 1000;
  const MAX_HISTORY = 50;

  function isEmbedded() {
    return !!(global.CasinoBridge && global.CasinoBridge.isEmbedded());
  }

  function bridgeBalance() {
    return global.CasinoBridge ? global.CasinoBridge.getBalance() : 0;
  }

  const LinkupAPI = {
    _state: null,

    /* ---------- local persistence (demo only) ---------- */
    _load() {
      if (this._state) return this._state;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this._state = raw ? JSON.parse(raw) : null;
      } catch (e) {
        this._state = null;
      }
      if (!this._state) {
        this._state = { balance: STARTING_BALANCE, history: [], nonce: 0 };
        this._save();
      }
      return this._state;
    },
    _save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
      } catch (e) { /* ignore quota errors in demo */ }
    },

    /* ---------- read API ---------- */
    async getBalance() {
      if (isEmbedded()) return bridgeBalance();
      return this._load().balance;
    },

    async getHistory(limit = MAX_HISTORY) {
      return this._load().history.slice(0, limit);
    },

    async resetBalance() {
      if (isEmbedded()) {
        const state = this._load();
        state.history = [];
        state.nonce = 0;
        state.balance = bridgeBalance();
        this._save();
        return state.balance;
      }
      this._state = { balance: STARTING_BALANCE, history: [], nonce: 0 };
      this._save();
      return this._state.balance;
    },

    /* ---------- write API ---------- */
    /**
     * Place a single bet.
     * @returns {Promise<object>} resolved bet record incl. new balance.
     */
    async placeBet({ amount, target }) {
      const state = this._load();

      // --- validation (mirror this on the server too) ---
      // Errors carry a .code so the UI can translate the message.
      amount = Number(amount);
      target = Limbo.clampTarget(Number(target));
      if (!(amount > 0)) {
        const e = new Error("Bet amount must be greater than 0.");
        e.code = "INVALID_AMOUNT";
        throw e;
      }
      const availableBalance = isEmbedded() ? bridgeBalance() : state.balance;
      if (amount > availableBalance) {
        const e = new Error("Insufficient balance.");
        e.code = "INSUFFICIENT_BALANCE";
        throw e;
      }

      if (isEmbedded()) {
        await global.CasinoBridge.placeBet(amount);
      }

      // >>> DB INTEGRATION POINT <<<
      // In production this whole block lives on the server.
      const result = Limbo.roll();                         // crash multiplier
      const { won, payout, profit } = Limbo.resolve({ amount, target, result });

      if (isEmbedded()) {
        global.CasinoBridge.reportGameResult({
          isWin: won,
          stake: amount,
          winAmount: payout,
          multiplier: won ? target : 0,
          result: { game: "limbo", target, result },
        });
        state.balance = bridgeBalance();
      } else {
        state.balance = state.balance - amount + payout;
      }
      state.nonce += 1;

      const record = {
        betId: state.nonce,
        ts: Date.now(),
        amount,
        target,
        result,
        won,
        payout,
        profit,
        balance: isEmbedded() ? bridgeBalance() : state.balance,
      };

      state.history.unshift(record);
      if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
      this._save();
      // >>> end integration point <<<

      return record;
    },
  };

  global.LinkupAPI = LinkupAPI;
})(typeof window !== "undefined" ? window : this);
