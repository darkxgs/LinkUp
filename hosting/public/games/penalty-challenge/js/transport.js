/* =============================================================================
 * transport.js — THE KEY SEAM FOR MULTIPLAYER.
 *
 * A "Pick" is one player's submission for the current kick:
 *     { playerId, role: 'SHOOTER'|'KEEPER', zone }
 *
 * The GameTransport interface decouples "how the two picks arrive" from "how a
 * kick is resolved". A kick only resolves once BOTH picks for it exist.
 *
 *   GameTransport:
 *     submitPick(pick)                 - register one player's pick
 *     onKickReady(callback)            - callback(shooterPick, keeperPick)
 *                                        fires exactly once both picks are in
 *     reset()                          - clear picks for the next kick
 *
 * LocalTransport (shipped): both picks come from the same device. The
 * pass-and-play HANDOFF screen (driven by state.js/render.js) is what keeps the
 * keeper from seeing the shooter's pick — the transport itself just buffers.
 *
 * >>> TO CONNECT REAL ONLINE MULTIPLAYER <<<
 * Implement SocketTransport / FirebaseTransport / WebRTCTransport with the SAME
 * three methods. submitPick() sends YOUR pick over the wire; when the OPPONENT's
 * pick arrives over the network you call the same internal "store + maybe fire"
 * logic. The onKickReady callback then fires identically. Swap it in main.js:
 *       const transport = new LocalTransport();
 *   ->  const transport = new SocketTransport(socket, matchId);
 * state.js and rules.js never change — they only know about this interface.
 * ========================================================================== */

(function (global) {
  'use strict';

  class LocalTransport {
    constructor() {
      this._shooterPick = null;
      this._keeperPick = null;
      this._readyCb = null;
    }

    /** Register the callback fired when both picks for a kick are present. */
    onKickReady(callback) {
      this._readyCb = callback;
    }

    /**
     * Submit one pick. In the local build both calls happen on this device,
     * separated by the handoff screen. In a remote build, one of these would
     * instead be triggered by a message arriving from the opponent's client.
     * @param {{playerId:string, role:'SHOOTER'|'KEEPER', zone:number}} pick
     */
    submitPick(pick) {
      if (pick.role === 'SHOOTER') {
        this._shooterPick = pick;
      } else {
        this._keeperPick = pick;
      }
      this._maybeFire();
    }

    _maybeFire() {
      if (this._shooterPick && this._keeperPick && this._readyCb) {
        // Hand both picks to the resolver. This is the moment that is identical
        // whether the second pick came from a handoff tap or from the network.
        this._readyCb(this._shooterPick, this._keeperPick);
      }
    }

    /** Clear buffered picks so the next kick starts fresh. */
    reset() {
      this._shooterPick = null;
      this._keeperPick = null;
    }
  }

  global.Transport = { LocalTransport };
})(window);
