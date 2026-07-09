/* =============================================================================
 * rules.js — PURE game rules. No DOM, no state mutation, no input, no rendering.
 *
 * Everything here is a pure function of its arguments. This file has zero
 * knowledge of the handoff UI, the wager layer, or how picks "arrive". That is
 * exactly why it never needs to change when local hotseat is swapped for real
 * online multiplayer.
 * ========================================================================== */

(function (global) {
  'use strict';

  // ---- Tunable constants ----------------------------------------------------
  // The goal is split into GRID_SIZE horizontal zones: 0=LEFT, 1=CENTER, 2=RIGHT.
  const GRID_SIZE = 3;                  // number of aim/dive zones across the goal
  const KICKS_PER_PLAYER = 5;           // kicks each player takes as Shooter

  /**
   * Resolve a single kick. PURE.
   * @param {number} shooterZone - 0..(GRID_SIZE - 1)
   * @param {number} keeperZone  - 0..(GRID_SIZE - 1)
   * @returns {'GOAL'|'SAVE'} keeper guesses the same zone => SAVE, else GOAL.
   */
  function resolveKick(shooterZone, keeperZone) {
    return shooterZone === keeperZone ? 'SAVE' : 'GOAL';
  }

  /**
   * Has the main (non-sudden-death) phase finished? PURE.
   * Both players must have taken all KICKS_PER_PLAYER kicks.
   * @param {{P1:{kicks:number}, P2:{kicks:number}}} stats
   */
  function isMainPhaseComplete(stats) {
    return stats.P1.kicks >= KICKS_PER_PLAYER && stats.P2.kicks >= KICKS_PER_PLAYER;
  }

  /**
   * Given the current score and how many kicks remain, can the trailing player
   * still catch up? Used to allow an early finish ("clinched"). PURE.
   * @returns {boolean} true if the match outcome is already mathematically decided.
   */
  function isMatchClinched(stats) {
    const p1Remaining = KICKS_PER_PLAYER - stats.P1.kicks;
    const p2Remaining = KICKS_PER_PLAYER - stats.P2.kicks;
    const lead = Math.abs(stats.P1.goals - stats.P2.goals);
    // The player who is behind can score at most all their remaining kicks.
    const maxCatchup = (stats.P1.goals > stats.P2.goals) ? p2Remaining : p1Remaining;
    return lead > maxCatchup;
  }

  /**
   * Evaluate a finished pair of sudden-death kicks. PURE.
   * @param {boolean} p1Scored
   * @param {boolean} p2Scored
   * @returns {'P1'|'P2'|null} winner, or null if the pair was a tie (continue).
   */
  function resolveSuddenDeathPair(p1Scored, p2Scored) {
    if (p1Scored && !p2Scored) return 'P1';
    if (p2Scored && !p1Scored) return 'P2';
    return null; // both scored or both missed -> another pair
  }

  /**
   * Decide the match winner from final stats. PURE.
   * @returns {'P1'|'P2'|null} null means tied (caller should go to sudden death).
   */
  function decideWinner(stats) {
    if (stats.P1.goals > stats.P2.goals) return 'P1';
    if (stats.P2.goals > stats.P1.goals) return 'P2';
    return null;
  }

  global.Rules = {
    GRID_SIZE,
    KICKS_PER_PLAYER,
    ZONE_COUNT: GRID_SIZE,
    resolveKick,
    isMainPhaseComplete,
    isMatchClinched,
    resolveSuddenDeathPair,
    decideWinner,
  };
})(window);
