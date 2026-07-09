/*
 * limboEngine.js
 * -----------------------------------------------------------------------------
 * GAME #2 ("Limbo") engine — the pure math + randomness for a Stake-style Limbo.
 *
 * Limbo rules (matching the real game):
 *   - The player picks a TARGET MULTIPLIER (e.g. 2.00x).
 *   - The round produces a random RESULT MULTIPLIER (the "crash point").
 *   - WIN  if result >= target  -> payout = bet * target  (profit = bet*(target-1)).
 *   - LOSE if result <  target  -> the bet is lost.
 *
 * House edge / fairness:
 *   With a 1% house edge the win chance for a given target is exactly
 *       winChance% = 99 / target
 *   so target 2.00 -> 49.5% (matches the reference UI), and the long-run RTP is
 *   99% for every target. The result multiplier is sampled so that
 *       P(result >= m) = 0.99 / m            (for m >= 1)
 *   which is achieved by  result = 0.99 / u  with u ~ Uniform(0,1].
 *
 * Provably-fair / DB seam:
 *   The ONLY source of randomness is a swappable `RandomSource` with a single
 *   method `nextFloat() -> number in (0,1)`. The demo ships CryptoRandomSource
 *   (browser CSPRNG). A real deployment swaps in a server-driven provably-fair
 *   source (HMAC-SHA256 over serverSeed:clientSeed:nonce) — see the commented
 *   ProvablyFairSource sketch at the bottom. Engine code never changes.
 *
 * Attaches to window.IG (shared) so any future casino game (Dice, Crash…) can
 * reuse the win-chance helpers.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};

  // ---- Tunables (a real build would read these from server config) -----------
  var DEFAULTS = {
    houseEdge: 0.01,        // 1% — bakes the edge into winChance and RTP
    minTarget: 1.01,        // smallest selectable target multiplier
    maxTarget: 1000000,     // 1,000,000.00x ceiling (matches the reference input)
    decimals: 2             // multipliers are quoted to 2 decimals
  };

  // ---------------------------------------------------------------------------
  // RandomSource: CSPRNG-backed uniform float in (0,1). Swappable.
  // ---------------------------------------------------------------------------
  function CryptoRandomSource() {
    this._crypto =
      (global.crypto && global.crypto.getRandomValues) ? global.crypto : null;
  }
  CryptoRandomSource.prototype.nextFloat = function () {
    if (this._crypto) {
      // 53-bit float in [0,1) assembled from two 32-bit words.
      var words = new Uint32Array(2);
      this._crypto.getRandomValues(words);
      var f = (words[0] * 4294967296 + words[1]) / 9007199254740992; // / 2^53
      // Exclude the exact 0 so 0.99/u can't divide by zero; (0,1).
      return f > 0 ? f : Number.MIN_VALUE;
    }
    // Last-resort fallback (non-crypto). Demo only.
    var r = Math.random();
    return r > 0 ? r : Number.MIN_VALUE;
  };

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------
  function LimboEngine(options) {
    options = options || {};
    this.houseEdge = typeof options.houseEdge === 'number' ? options.houseEdge : DEFAULTS.houseEdge;
    this.minTarget = options.minTarget || DEFAULTS.minTarget;
    this.maxTarget = options.maxTarget || DEFAULTS.maxTarget;
    this.decimals = options.decimals || DEFAULTS.decimals;
    this.source = options.source || new CryptoRandomSource();
    this._edgeFactor = 1 - this.houseEdge; // 0.99 with a 1% edge
  }

  // floor to N decimals (truncate — never round a result UP into a win)
  LimboEngine.prototype._floor = function (n) {
    var p = Math.pow(10, this.decimals);
    return Math.floor(n * p) / p;
  };

  // Clamp + snap a user-entered target into the valid 2-decimal range.
  LimboEngine.prototype.normalizeTarget = function (target) {
    target = Number(target);
    if (!isFinite(target)) target = this.minTarget;
    target = this._floor(target);
    if (target < this.minTarget) target = this.minTarget;
    if (target > this.maxTarget) target = this.maxTarget;
    return target;
  };

  // winChance% for a target (the value shown in the "Win Chance" field).
  LimboEngine.prototype.winChanceForTarget = function (target) {
    return (this._edgeFactor * 100) / this.normalizeTarget(target);
  };

  // Inverse: target for a desired win chance% (when the user edits Win Chance).
  LimboEngine.prototype.targetForWinChance = function (chance) {
    chance = Number(chance);
    if (!isFinite(chance) || chance <= 0) chance = this._edgeFactor * 100;
    return this.normalizeTarget((this._edgeFactor * 100) / chance);
  };

  // Convert a raw uniform float in (0,1) into a result multiplier.
  // Exposed (pure) so a provably-fair backend can produce the same number from
  // its own float and the result can be independently verified.
  LimboEngine.prototype.multiplierFromFloat = function (u) {
    if (!(u > 0)) u = Number.MIN_VALUE;
    var raw = this._edgeFactor / u;            // 0.99 / u
    var m = this._floor(raw);
    if (m < 1) m = 1;                           // display floor (always a loss vs any target)
    if (m > this.maxTarget) m = this.maxTarget; // cap the display
    return m;
  };

  /**
   * Play one round.
   * @param {number} target  desired target multiplier
   * @param {number} bet     wager amount (used only to compute the payout)
   * @returns {{target, result, win, payoutMultiplier, payout, profit, float}}
   */
  LimboEngine.prototype.roll = function (target, bet) {
    target = this.normalizeTarget(target);
    bet = Number(bet) || 0;

    var u = this.source.nextFloat();
    var result = this.multiplierFromFloat(u);
    var win = result >= target;

    var payoutMultiplier = win ? target : 0;
    var payout = win ? bet * target : 0;        // total returned to the player
    var profit = payout - bet;                  // net change to balance

    return {
      target: target,
      result: result,
      win: win,
      payoutMultiplier: payoutMultiplier,
      payout: payout,
      profit: profit,
      float: u
    };
  };

  /*
   * ---------------------------------------------------------------------------
   * >>> FUTURE: ProvablyFairSource plugs in RIGHT HERE (same nextFloat seam) <<<
   * ---------------------------------------------------------------------------
   * Stake-style provably fair: the server commits to a hashed serverSeed up
   * front; each bet uses HMAC-SHA256(serverSeed, clientSeed + ":" + nonce),
   * and the first bytes of the hex digest become the uniform float. The player
   * can verify every result after the serverSeed is revealed.
   *
   *   async function pfFloat(serverSeed, clientSeed, nonce) {
   *     const msg = `${clientSeed}:${nonce}`;
   *     const key = await crypto.subtle.importKey(
   *       'raw', new TextEncoder().encode(serverSeed),
   *       { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   *     const sig = new Uint8Array(
   *       await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
   *     // 4 bytes -> [0,1): big-endian / 2^32
   *     return ((sig[0]<<24 | sig[1]<<16 | sig[2]<<8 | sig[3]) >>> 0) / 4294967296;
   *   }
   *
   * Because this is async, a remote build makes engine.roll()/placeBet() await
   * the float (the wallet provider is already async in production) — no change
   * to the math above.
   * ---------------------------------------------------------------------------
   */

  IG.CryptoRandomSource = CryptoRandomSource;
  IG.LimboEngine = LimboEngine;

})(typeof window !== 'undefined' ? window : this);
