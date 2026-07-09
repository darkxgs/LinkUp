/* ============================================================
   Linkup — Hilo game engine
   ------------------------------------------------------------
   Pure math, no DOM. Identical logic can run on a server.
   ============================================================ */
(function (global) {
  "use strict";

  const Hilo = {
    HOUSE_EDGE: 0.01,
    SUITS: ["C", "S", "H", "D"], // Clubs, Spades, Hearts, Diamonds

    /**
     * Draw a random card (rank 1-13, random suit).
     * @param {function} rng - returns a float in [0, 1). Defaults to Math.random.
     */
    drawCard(rng) {
      const _rng = rng || Math.random;
      const rank = Math.floor(_rng() * 13) + 1; // 1 to 13
      const suitIdx = Math.floor(_rng() * 4);
      const suit = this.SUITS[suitIdx];
      return { rank, suit };
    },

    /**
     * Map card rank integer to display string.
     */
    getRankLabel(rank) {
      if (rank === 1) return "A";
      if (rank === 11) return "J";
      if (rank === 12) return "Q";
      if (rank === 13) return "K";
      return rank.toString();
    },

    /** Get the number of ranks >= currentRank */
    getHigherCount(rank) {
      return 14 - rank;
    },

    /** Get the number of ranks <= currentRank */
    getLowerCount(rank) {
      return rank;
    },

    /** Get individual multiplier for guessing Higher or Same (includes house edge) */
    getHigherMultiplier(rank) {
      const winRanks = this.getHigherCount(rank);
      return Math.round((12.87 / winRanks) * 100) / 100;
    },

    /** Get individual multiplier for guessing Lower or Same (includes house edge) */
    getLowerMultiplier(rank) {
      const winRanks = this.getLowerCount(rank);
      return Math.round((12.87 / winRanks) * 100) / 100;
    },

    /** Get probability (%) for guessing Higher or Same */
    getHigherProbability(rank) {
      return (this.getHigherCount(rank) / 13) * 100;
    },

    /** Get probability (%) for guessing Lower or Same */
    getLowerProbability(rank) {
      return (this.getLowerCount(rank) / 13) * 100;
    },

    /**
     * Check if guess is correct.
     * @param {number} currentRank
     * @param {number} nextRank
     * @param {string} guess - 'higher' or 'lower'
     */
    verifyGuess(currentRank, nextRank, guess) {
      if (guess === "higher") {
        return nextRank >= currentRank;
      }
      if (guess === "lower") {
        return nextRank <= currentRank;
      }
      return false;
    },

    /**
     * Compound multiplier calculation.
     * The first step has house edge: 12.87 / N1
     * Subsequent steps compound at fair odds: currentMultiplier * (13 / N_i)
     */
    compoundMultiplier(currentMultiplier, winningRanks, isFirstStep) {
      if (isFirstStep || currentMultiplier === 0) {
        return 12.87 / winningRanks;
      }
      return currentMultiplier * (13 / winningRanks);
    }
  };

  global.Hilo = Hilo;
})(typeof window !== "undefined" ? window : this);
