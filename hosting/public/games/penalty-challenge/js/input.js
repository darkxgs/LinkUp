/* =============================================================================
 * input.js — turns a zone-grid tap into a Pick and hands it to the transport
 * (via state.submitPick). It knows whose turn it is from the state's phase and
 * currentKick, and NOTHING else. No rendering, no rule logic, no resolution.
 *
 * A Pick is the unit a remote client would also submit:
 *     { playerId, role: 'SHOOTER'|'KEEPER', zone }
 * ========================================================================== */

(function (global) {
  'use strict';

  const PHASE = State.PHASE;

  class InputController {
    constructor(state) {
      this.state = state;
    }

    /**
     * Handle a tap on grid zone `zone`. Builds the correct Pick for whoever is
     * currently picking and submits it. Ignored if it isn't a picking phase.
     */
    handleZoneTap(zone) {
      const s = this.state;
      const ck = s.currentKick;

      if (s.phase === PHASE.SHOOTER_AIMING) {
        s.submitPick({ playerId: ck.shooter, role: 'SHOOTER', zone });
      } else if (s.phase === PHASE.KEEPER_DIVING) {
        s.submitPick({ playerId: ck.keeper, role: 'KEEPER', zone });
      }
      // Any other phase: not this player's moment to pick — ignore.
    }
  }

  global.Input = { InputController };
})(window);
