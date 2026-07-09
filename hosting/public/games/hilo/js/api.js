/* ============================================================
   Linkup — Hilo Data layer
   ------------------------------------------------------------
   Shares the wallet balance with Limbo via "linkup_limbo_state_v1".
   Saves Hilo history and active game states in "linkup_hilo_state_v1".
   Supports restoring game state after page refresh (extremely premium).
   ============================================================ */
(function (global) {
  "use strict";

  const LIMBO_STORAGE_KEY = "linkup_limbo_state_v1";
  const HILO_STORAGE_KEY = "linkup_hilo_state_v1";
  const STARTING_BALANCE = 1000;
  const MAX_HISTORY = 50;

  function isEmbedded() {
    return !!(global.CasinoBridge && global.CasinoBridge.isEmbedded());
  }

  function bridgeBalance() {
    return global.CasinoBridge ? global.CasinoBridge.getBalance() : 0;
  }

  const HiloAPI = {
    _limboState: null,
    _hiloState: null,

    /* ---------- local persistence ---------- */
    _loadLimbo() {
      if (this._limboState) return this._limboState;
      try {
        const raw = localStorage.getItem(LIMBO_STORAGE_KEY);
        this._limboState = raw ? JSON.parse(raw) : null;
      } catch (e) {
        this._limboState = null;
      }
      if (!this._limboState) {
        this._limboState = { balance: STARTING_BALANCE, history: [], nonce: 0 };
        this._saveLimbo();
      }
      return this._limboState;
    },

    _saveLimbo() {
      try {
        localStorage.setItem(LIMBO_STORAGE_KEY, JSON.stringify(this._limboState));
      } catch (e) {}
    },

    _loadHilo() {
      if (this._hiloState) return this._hiloState;
      try {
        const raw = localStorage.getItem(HILO_STORAGE_KEY);
        this._hiloState = raw ? JSON.parse(raw) : null;
      } catch (e) {
        this._hiloState = null;
      }
      if (!this._hiloState) {
        this._hiloState = { history: [], nonce: 0, activeRound: null };
        this._saveHilo();
      }
      return this._hiloState;
    },

    _saveHilo() {
      try {
        localStorage.setItem(HILO_STORAGE_KEY, JSON.stringify(this._hiloState));
      } catch (e) {}
    },

    /* ---------- read API ---------- */
    async getBalance() {
      if (isEmbedded()) return bridgeBalance();
      return this._loadLimbo().balance;
    },

    async getHistory(limit = MAX_HISTORY) {
      return this._loadHilo().history.slice(0, limit);
    },

    async getActiveRound() {
      return this._loadHilo().activeRound;
    },

    async resetBalance() {
      if (isEmbedded()) {
        const hilo = this._loadHilo();
        hilo.history = [];
        hilo.nonce = 0;
        hilo.activeRound = null;
        this._saveHilo();
        return bridgeBalance();
      }

      const limbo = this._loadLimbo();
      limbo.balance = STARTING_BALANCE;
      this._saveLimbo();

      const hilo = this._loadHilo();
      hilo.history = [];
      hilo.nonce = 0;
      hilo.activeRound = null;
      this._saveHilo();

      return limbo.balance;
    },

    /* ---------- Hilo Gameplay Write API ---------- */
    /**
     * Start a round by placing a bet and selecting a start card.
     */
    async startRound({ amount, startCard }) {
      const limbo = this._loadLimbo();
      const hilo = this._loadHilo();

      if (hilo.activeRound) {
        const e = new Error("An active round is already in progress.");
        e.code = "ACTIVE_ROUND_EXISTS";
        throw e;
      }

      amount = Number(amount);
      if (!(amount > 0)) {
        const e = new Error("Bet amount must be greater than 0.");
        e.code = "INVALID_AMOUNT";
        throw e;
      }
      const availableBalance = isEmbedded() ? bridgeBalance() : limbo.balance;
      if (amount > availableBalance) {
        const e = new Error("Insufficient balance.");
        e.code = "INSUFFICIENT_BALANCE";
        throw e;
      }

      if (isEmbedded()) {
        await global.CasinoBridge.placeBet(amount);
        limbo.balance = bridgeBalance();
      } else {
        // Deduct bet amount
        limbo.balance -= amount;
      }
      this._saveLimbo();

      // Initialize active round
      hilo.activeRound = {
        amount,
        currentCard: startCard,
        cumulativeMultiplier: 1.0,
        isFirstGuess: true,
        historyCards: [
          {
            rank: startCard.rank,
            suit: startCard.suit,
            label: "Start Card",
            multiplier: 1.0,
            won: true,
          },
        ],
      };
      this._saveHilo();

      return {
        activeRound: hilo.activeRound,
        balance: isEmbedded() ? bridgeBalance() : limbo.balance,
      };
    },

    /**
     * Skip the card.
     */
    async skipCard(newCard) {
      const hilo = this._loadHilo();
      if (hilo.activeRound) {
        hilo.activeRound.currentCard = newCard;
        // In the history stack, update the *last* item's card to show it was skipped
        const lastCardIdx = hilo.activeRound.historyCards.length - 1;
        hilo.activeRound.historyCards[lastCardIdx].rank = newCard.rank;
        hilo.activeRound.historyCards[lastCardIdx].suit = newCard.suit;
        this._saveHilo();
      }
      return newCard;
    },

    /**
     * Make a guess ('higher' or 'lower').
     */
    async makeGuess({ guess, nextCard }) {
      const limbo = this._loadLimbo();
      const hilo = this._loadHilo();
      const round = hilo.activeRound;

      if (!round) {
        const e = new Error("No active round to guess on.");
        e.code = "NO_ACTIVE_ROUND";
        throw e;
      }

      const currentCard = round.currentCard;
      const won = Hilo.verifyGuess(currentCard.rank, nextCard.rank, guess);

      if (won) {
        // Calculate new compounded multiplier
        const winRanks =
          guess === "higher"
            ? Hilo.getHigherCount(currentCard.rank)
            : Hilo.getLowerCount(currentCard.rank);

        round.cumulativeMultiplier = Hilo.compoundMultiplier(
          round.cumulativeMultiplier,
          winRanks,
          round.isFirstGuess
        );
        round.isFirstGuess = false;
        round.currentCard = nextCard;

        round.historyCards.push({
          rank: nextCard.rank,
          suit: nextCard.suit,
          multiplier: round.cumulativeMultiplier,
          guess: guess,
          won: true,
        });

        this._saveHilo();

        return {
          won: true,
          activeRound: round,
          nextCard,
        };
      } else {
        if (isEmbedded()) {
          global.CasinoBridge.reportGameResult({
            isWin: false,
            stake: round.amount,
            winAmount: 0,
            multiplier: 0,
            result: { game: "hilo", guess, nextCard },
          });
          limbo.balance = bridgeBalance();
        }

        // Lost! Save result to history and clear active round
        limbo.nonce += 1;
        hilo.nonce += 1;
        this._saveLimbo();

        const record = {
          betId: hilo.nonce,
          ts: Date.now(),
          amount: round.amount,
          won: false,
          payout: 0,
          profit: -round.amount,
          balance: isEmbedded() ? bridgeBalance() : limbo.balance,
          historyCards: [
            ...round.historyCards,
            {
              rank: nextCard.rank,
              suit: nextCard.suit,
              multiplier: 0,
              guess: guess,
              won: false,
            },
          ],
        };

        hilo.history.unshift(record);
        if (hilo.history.length > MAX_HISTORY) hilo.history.length = MAX_HISTORY;

        hilo.activeRound = null;
        this._saveHilo();

        return {
          won: false,
          record,
          nextCard,
          balance: isEmbedded() ? bridgeBalance() : limbo.balance,
        };
      }
    },

    /**
     * Cash out the active round.
     */
    async cashout() {
      const limbo = this._loadLimbo();
      const hilo = this._loadHilo();
      const round = hilo.activeRound;

      if (!round) {
        const e = new Error("No active round to cashout.");
        e.code = "NO_ACTIVE_ROUND";
        throw e;
      }

      const payout = round.amount * round.cumulativeMultiplier;
      const profit = payout - round.amount;
      if (isEmbedded()) {
        global.CasinoBridge.reportGameResult({
          isWin: true,
          stake: round.amount,
          winAmount: payout,
          multiplier: round.cumulativeMultiplier,
          result: { game: "hilo", historyCards: round.historyCards },
        });
        limbo.balance = bridgeBalance();
      } else {
        limbo.balance += payout;
      }
      limbo.nonce += 1;
      hilo.nonce += 1;
      this._saveLimbo();

      const record = {
        betId: hilo.nonce,
        ts: Date.now(),
        amount: round.amount,
        won: true,
        payout,
        profit,
        balance: isEmbedded() ? bridgeBalance() : limbo.balance,
        historyCards: [...round.historyCards],
      };

      hilo.history.unshift(record);
      if (hilo.history.length > MAX_HISTORY) hilo.history.length = MAX_HISTORY;

      hilo.activeRound = null;
      this._saveHilo();

      return {
        record,
        balance: isEmbedded() ? bridgeBalance() : limbo.balance,
      };
    },
  };

  global.HiloAPI = HiloAPI;
})(typeof window !== "undefined" ? window : this);
