/* ============================================================
   Linkup — Limbo engine
   ------------------------------------------------------------
   Pure math, no DOM. Identical logic can run on a server.
   ============================================================ */
(function (global) {
  "use strict";

  const Limbo = {
    // 1% house edge, same as the original game.
    HOUSE_EDGE: 0.01,

    MIN_TARGET: 1.01,
    MAX_TARGET: 1000000,

    /**
     * Roll a crash multiplier.
     *
     * Distribution: P(result >= t) = (1 - houseEdge) / t
     *   -> with a 1% edge, a target of 2.00x wins 49.5% of the time.
     *
     * @param {function} rng - returns a float in [0, 1). Defaults to Math.random.
     *                         A server would pass a provably-fair generator here
     *                         (e.g. derived from serverSeed + clientSeed + nonce).
     * @returns {number} multiplier, floored to 2 decimals, min 1.00
     */
    roll(rng) {
      const r = (rng || Math.random)();
      const raw = (1 - this.HOUSE_EDGE) / (1 - r);
      return Math.max(1, Math.floor(raw * 100) / 100);
    },

    /** Win chance (%) for a given target multiplier. */
    targetToWinChance(target) {
      return ((1 - this.HOUSE_EDGE) * 100) / target; // 99 / target
    },

    /** Target multiplier needed for a given win chance (%). */
    winChanceToTarget(chance) {
      return ((1 - this.HOUSE_EDGE) * 100) / chance;
    },

    /** Clamp a target multiplier into the valid range. */
    clampTarget(target) {
      if (isNaN(target)) return this.MIN_TARGET;
      return Math.min(this.MAX_TARGET, Math.max(this.MIN_TARGET, target));
    },

    /**
     * Resolve a bet against an already-rolled result.
     * Kept separate from roll() so a server can roll once and resolve trustfully.
     */
    resolve({ amount, target, result }) {
      const won = result >= target;
      const payout = won ? amount * target : 0;       // total returned to player
      const profit = payout - amount;                  // net change
      return { won, payout, profit };
    },
  };

  global.Limbo = Limbo;
})(typeof window !== "undefined" ? window : this);
