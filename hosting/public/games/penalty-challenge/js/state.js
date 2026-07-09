/* =============================================================================
 * state.js — SINGLE SOURCE OF TRUTH + finite state machine.
 *
 * Owns: whose turn is Shooter/Keeper, goals/kicks per player, the current
 * kick's two picks, wager/pot, sudden-death flag, and the phase machine:
 *
 *   WAGER -> SHOOTER_AIMING -> HANDOFF -> KEEPER_DIVING -> RESOLVING
 *         -> KICK_RESULT -> (next kick | SUDDEN_DEATH | MATCH_OVER)
 *
 * state.js talks to the world only through:
 *   - Rules   (pure logic)
 *   - Wallet  (balance provider interface)
 *   - Transport (pick delivery interface)
 *   - a single onChange() subscriber (render.js redraws from whatever is here)
 *
 * It never touches the DOM and never reads input directly.
 * ========================================================================== */

(function (global) {
  'use strict';

  const PHASE = {
    WAGER: 'WAGER',
    SHOOTER_AIMING: 'SHOOTER_AIMING',
    HANDOFF: 'HANDOFF',
    KEEPER_DIVING: 'KEEPER_DIVING',
    RESOLVING: 'RESOLVING',
    KICK_RESULT: 'KICK_RESULT',
    SUDDEN_DEATH: 'SUDDEN_DEATH', // transient marker; play continues via the kick phases
    MATCH_OVER: 'MATCH_OVER',
  };

  class GameState {
    /**
     * @param {Object} deps { wallet, transport }
     */
    constructor(deps) {
      this.wallet = deps.wallet;
      this.transport = deps.transport;
      this._subscriber = null;

      // Resolve a kick the instant both picks have arrived (local or remote).
      this.transport.onKickReady((shooterPick, keeperPick) => {
        this._resolveKick(shooterPick, keeperPick);
      });

      this.reset();
    }

    /** Fresh match-agnostic state (used on first load). */
    reset() {
      this.phase = PHASE.WAGER;
      this.names = { P1: 'Player 1', P2: 'Player 2' };
      this.bet = 100;
      this.pot = 0;
      this.suddenDeath = false;
      this.sdPair = { P1: null, P2: null }; // scored? per player in current SD pair

      this.stats = {
        P1: { goals: 0, kicks: 0 },
        P2: { goals: 0, kicks: 0 },
      };

      // The kick currently in progress.
      this.currentKick = {
        shooter: 'P1',  // who shoots this kick
        keeper: 'P2',   // who keeps this kick
        shooterPick: null,
        keeperPick: null,
        outcome: null,  // 'GOAL' | 'SAVE'
      };

      this.lastResult = null; // { outcome, shooterZone, keeperZone, shooter, keeper }
      this.winner = null;     // 'P1' | 'P2'
      this.payout = 0;
    }

    subscribe(fn) { this._subscriber = fn; }
    _emit() { if (this._subscriber) this._subscriber(this); }

    // ---- Wager screen --------------------------------------------------------
    setName(playerId, name) {
      this.names[playerId] = name || playerId;
      this._emit();
    }

    setBet(amount) {
      this.bet = Math.max(1, Math.floor(amount) || 0);
      this._emit();
    }

    getBalance(playerId) { return this.wallet.getBalance(playerId); }

    /** Both players agreed: deduct wagers, build pot, start kicking. */
    startMatch() {
      // Pull wagers through the BalanceProvider interface (throws if short).
      this.wallet.placeWager('P1', this.bet);
      this.wallet.placeWager('P2', this.bet);
      this.pot = this.bet * 2;

      // P1 always shoots first kick of the match.
      this.currentKick = {
        shooter: 'P1', keeper: 'P2',
        shooterPick: null, keeperPick: null, outcome: null,
      };
      this.transport.reset();
      this.phase = PHASE.SHOOTER_AIMING;
      this._emit();
    }

    // ---- Pick flow -----------------------------------------------------------
    /**
     * Called by input.js with a Pick. We forward to the transport, which buffers
     * and (once both are in) triggers _resolveKick via the onKickReady callback.
     * We also advance the local FSM (aiming -> handoff -> diving) so the UI knows
     * which screen to show. In a remote build this FSM advance still holds; only
     * the opponent's submitPick would come from the network instead.
     */
    submitPick(pick) {
      if (pick.role === 'SHOOTER') {
        this.currentKick.shooterPick = pick.zone;
        // Shooter done -> hand the device to the keeper. The transport buffers
        // this pick but won't fire onKickReady yet (the keeper pick is missing).
        this.phase = PHASE.HANDOFF;
        this.transport.submitPick(pick);
        this._emit();
      } else {
        this.currentKick.keeperPick = pick.zone;
        // Mark RESOLVING, THEN submit. The transport now has both picks, so it
        // fires onKickReady synchronously -> _resolveKick advances us to
        // KICK_RESULT and emits. (Order matters: submit must come after we set
        // RESOLVING so we don't clobber the KICK_RESULT phase it produces.)
        this.phase = PHASE.RESOLVING;
        this.transport.submitPick(pick);
      }
    }

    /** Handoff screen "I'm Ready" pressed -> show the keeper's diving grid. */
    confirmHandoff() {
      this.phase = PHASE.KEEPER_DIVING;
      this._emit();
    }

    // ---- Resolution (driven by transport.onKickReady) ------------------------
    _resolveKick(shooterPick, keeperPick) {
      const outcome = Rules.resolveKick(shooterPick.zone, keeperPick.zone);
      this.currentKick.outcome = outcome;

      const shooter = this.currentKick.shooter;
      const keeper = this.currentKick.keeper;

      this.stats[shooter].kicks += 1;
      if (outcome === 'GOAL') this.stats[shooter].goals += 1;

      // Track sudden-death pair results.
      if (this.suddenDeath) {
        this.sdPair[shooter] = outcome === 'GOAL';
      }

      this.lastResult = {
        outcome,
        shooterZone: shooterPick.zone,
        keeperZone: keeperPick.zone,
        shooter,
        keeper,
      };
      this.phase = PHASE.KICK_RESULT;
      this._emit();
    }

    /**
     * Advance after the KICK_RESULT beat has been shown (render.js / main.js
     * calls this once the result animation has played).
     */
    advanceAfterResult() {
      if (this.suddenDeath) return this._advanceSuddenDeath();
      return this._advanceMain();
    }

    _advanceMain() {
      // Early finish if the result is already mathematically decided.
      if (Rules.isMatchClinched(this.stats)) {
        return this._endMatch(Rules.decideWinner(this.stats));
      }

      if (Rules.isMainPhaseComplete(this.stats)) {
        const winner = Rules.decideWinner(this.stats);
        if (winner) return this._endMatch(winner);
        // السيناريو المعتمد: التعادل النهائي = استرداد الرهان للطرفين.
        return this._endMatch(null);
      }
      return this._startNextKick();
    }

    _advanceSuddenDeath() {
      // A sudden-death pair completes when both players have kicked once in it.
      const bothKicked = this.sdPair.P1 !== null && this.sdPair.P2 !== null;
      if (bothKicked) {
        const winner = Rules.resolveSuddenDeathPair(this.sdPair.P1, this.sdPair.P2);
        if (winner) return this._endMatch(winner);
        // Tie pair -> reset and play another pair.
        this.sdPair = { P1: null, P2: null };
      }
      return this._startNextKick();
    }

    /** Swap roles and set up the next kick. */
    _startNextKick() {
      const prevShooter = this.currentKick.shooter;
      const prevKeeper = this.currentKick.keeper;
      this.currentKick = {
        shooter: prevKeeper,
        keeper: prevShooter,
        shooterPick: null,
        keeperPick: null,
        outcome: null,
      };
      this.transport.reset();
      this.phase = PHASE.SHOOTER_AIMING;
      this._emit();
    }

    _endMatch(winner) {
      this.winner = winner;
      // In challenge mode settlement is handled by app/Firestore.
      // For local play, keep payout 0 on tie to avoid crediting a wrong side.
      if (winner === null) {
        this.payout = 0;
      } else {
        this.payout = this.wallet.settle(winner, this.pot);
      }
      this.phase = PHASE.MATCH_OVER;
      this._emit();
    }

    /** Play again with the same names/balances; back to the wager screen. */
    rematch() {
      const names = Object.assign({}, this.names);
      this.reset();
      this.names = names;
      this._emit();
    }

    /** Full reset to main menu / wager screen. */
    toMenu() {
      const names = Object.assign({}, this.names);
      this.reset();
      this.names = names;
      this._emit();
    }
  }

  global.State = { GameState, PHASE };
})(window);
