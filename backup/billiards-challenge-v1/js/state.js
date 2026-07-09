// =============================================================================
// state.js — Single source of truth + finite state machine.
//
// Owns: ball positions, whose turn it is, group assignments, wager/pot, and the
// match phase. It orchestrates physics.js (simulate) and rules.js (evaluate)
// but contains NO rendering and NO raw input handling. render.js reads from it;
// input.js produces Shots that get applied through here.
//
//   FSM phases:
//     AIMING            → waiting for the current player to take a shot
//     SHOT_IN_PROGRESS  → balls are moving (replaying the deterministic frames)
//     RESOLVING         → applying the rules verdict
//     SWITCH_TURN       → handing over (or continuing) — transient
//     GAME_OVER         → match decided
// =============================================================================

// Depends on globals from physics.js (TABLE, playfield, simulate) and
// rules.js (evaluateShot, groupOf, Group) — loaded before this file.

const Phase = {
  AIMING: 'AIMING',
  SHOT_IN_PROGRESS: 'SHOT_IN_PROGRESS',
  RESOLVING: 'RESOLVING',
  SWITCH_TURN: 'SWITCH_TURN',
  GAME_OVER: 'GAME_OVER',
};

class GameState {
  constructor() {
    this.balls = [];
    this.phase = Phase.AIMING;
    this.currentPlayer = 0;     // 0 = breaker
    this.groups = { 0: null, 1: null };
    this.isBreak = true;
    this.ballInHand = false;    // current player may reposition the cue ball
    this.eightCall = null;      // { player, pocketId } when calling the 8-ball
    this.pot = 0;
    this.bet = 0;
    this.names = { 0: 'Player 1', 1: 'Player 2' };
    this.winner = null;

    // Replay buffer for SHOT_IN_PROGRESS animation (filled by simulate()).
    this._frames = null;
    this._frameIdx = 0;
    this._pendingVerdict = null;

    // Event listeners (main.js subscribes for banners/HUD updates).
    this._listeners = {};
  }

  on(event, cb) { (this._listeners[event] ||= []).push(cb); }
  emit(event, data) { (this._listeners[event] || []).forEach((cb) => cb(data)); }

  // ---- Match lifecycle ------------------------------------------------------
  startMatch({ names, bet, pot }) {
    this.names = names;
    this.bet = bet;
    this.pot = pot;
    this.groups = { 0: null, 1: null };
    this.currentPlayer = 0;
    this.isBreak = true;
    this.ballInHand = false;
    this.eightCall = null;
    this.winner = null;
    this.phase = Phase.AIMING;
    this.rackBalls();
    this.emit('turnStart', { player: this.currentPlayer, isBreak: true });
  }

  // Standard triangle rack: apex toward the foot, 8-ball in the center of row 3.
  rackBalls() {
    const balls = [];
    const R = TABLE.BALL_RADIUS;
    // Cue ball behind the baulk line. The line is around x=472.
    balls.push(makeBall('cue', 0, 440, TABLE.HEIGHT / 2));

    // Rack apex near right side.
    const apexX = 1140;
    const apexY = TABLE.HEIGHT / 2;
    const dx = R * 2 * Math.cos(Math.PI / 6); // column spacing
    const dy = R * 2;                          // row spacing within a column

    // Standard-legal-ish arrangement: 8 fixed in center (row 3), corners are
    // one solid + one stripe, rest filled pseudo-arbitrarily but consistently.
    const rackOrder = [
      [1],                 // apex
      [9, 2],
      [3, 8, 10],          // 8-ball center
      [11, 4, 12, 5],
      [6, 13, 7, 14, 15],
    ];

    for (let col = 0; col < rackOrder.length; col++) {
      const nums = rackOrder[col];
      const x = apexX + col * dx;
      const colHeight = (nums.length - 1) * dy;
      for (let row = 0; row < nums.length; row++) {
        const n = nums[row];
        const y = apexY - colHeight / 2 + row * dy;
        balls.push(makeBall('n' + n, n, x, y));
      }
    }
    this.balls = balls;
  }

  liveBalls() { return this.balls.filter((b) => !b.potted); }
  cueBall() { return this.balls.find((b) => b.num === 0); }

  // ---- Applying a shot (the core orchestration) -----------------------------
  // Called via the transport callback. Runs deterministic physics up front,
  // evaluates rules, then hands the recorded frames to the render loop.
  applyShot(shot) {
    if (this.phase !== Phase.AIMING) return;

    // Snapshot the pre-shot table for the rules engine.
    const pre = {
      shooter: this.currentPlayer,
      groups: { ...this.groups },
      isBreak: this.isBreak,
      ballsOnTable: this.balls.map((b) => ({ id: b.id, num: b.num, potted: b.potted })),
      eightCall: this.eightCall,
    };

    const result = simulate(this.balls, shot);
    this._pendingVerdict = { pre, result };

    // Begin animated replay.
    this._frames = result.frames;
    this._events = result.events || [];
    this._frameIdx = 0;
    this.phase = Phase.SHOT_IN_PROGRESS;
    this.emit('shotStart', shot);
    if (window.audio) audio.play('strike', Math.min(1, shot.power + 0.2));
  }

  // Advance the replay one render frame. Returns true while still animating.
  // Called by the render loop in main.js.
  advanceReplay() {
    if (this.phase !== Phase.SHOT_IN_PROGRESS) return false;
    const frame = this._frames[this._frameIdx];
    if (frame) {
      const byId = Object.fromEntries(frame.map((f) => [f.id, f]));
      for (const b of this.balls) {
        const f = byId[b.id];
        if (f) { b.x = f.x; b.y = f.y; b.potted = f.potted; b.pocket = f.pocket; }
      }
    }

    // Play sounds scheduled for this frame.
    for (const ev of this._events) {
      if (ev.frame === this._frameIdx) {
        if (window.audio) audio.play(ev.type, ev.vol || 1.0);
      }
    }

    this._frameIdx++;
    if (this._frameIdx >= this._frames.length) {
      this._resolveShot();
      return false;
    }
    return true;
  }

  // Apply the rules verdict once the balls have stopped.
  _resolveShot() {
    this.phase = Phase.RESOLVING;
    const { pre, result } = this._pendingVerdict;

    // Commit authoritative final positions from the deterministic sim.
    const finById = Object.fromEntries(result.finalBalls.map((b) => [b.id, b]));
    for (const b of this.balls) {
      const f = finById[b.id];
      if (f) { b.x = f.x; b.y = f.y; b.potted = f.potted; b.pocket = f.pocket; b.vx = 0; b.vy = 0; }
    }

    const verdict = evaluateShot(pre, result);

    // Group assignment.
    if (verdict.assignedGroups) {
      this.groups = verdict.assignedGroups;
      this.emit('groupsAssigned', this.groups);
    }

    this.isBreak = false;
    this.eightCall = null;

    this.emit('shotResolved', { verdict, pre });

    if (verdict.gameOver) {
      this.winner = verdict.winner;
      this.phase = Phase.GAME_OVER;
      this.emit('gameOver', { winner: verdict.winner, messages: verdict.messages });
      return;
    }

    // Handle scratch: cue ball comes back, opponent gets ball-in-hand.
    const cue = this.cueBall();
    if (verdict.pottedThisShot.some((p) => p.num === 0)) {
      cue.potted = false;
      cue.x = TABLE.WIDTH * 0.25;
      cue.y = TABLE.HEIGHT / 2;
      cue.vx = 0; cue.vy = 0;
    }

    // Turn handover.
    this.phase = Phase.SWITCH_TURN;
    if (verdict.continueTurn) {
      this.ballInHand = false;
      this.phase = Phase.AIMING;
      this.emit('turnStart', { player: this.currentPlayer, continued: true });
    } else {
      this.currentPlayer = this.currentPlayer === 0 ? 1 : 0;
      this.ballInHand = verdict.ballInHand;
      this.phase = Phase.AIMING;
      this.emit('turnStart', { player: this.currentPlayer, ballInHand: this.ballInHand });
    }
  }

  // ---- Ball-in-hand placement (called by input.js) --------------------------
  placeCueBall(x, y) {
    if (!this.ballInHand || this.phase !== Phase.AIMING) return false;
    const pf = playfield();
    x = Math.max(pf.left, Math.min(pf.right, x));
    y = Math.max(pf.top, Math.min(pf.bottom, y));
    // Don't allow overlapping another ball.
    for (const b of this.liveBalls()) {
      if (b.num === 0) continue;
      if (Math.hypot(b.x - x, b.y - y) < TABLE.BALL_RADIUS * 2) return false;
    }
    const cue = this.cueBall();
    cue.x = x; cue.y = y;
    return true;
  }

  // Has the current player cleared their group (so an 8-ball call is required)?
  isOn8Ball(player = this.currentPlayer) {
    const g = this.groups[player];
    if (!g) return false;
    return !this.balls.some((b) => !b.potted && groupOf(b.num) === g);
  }
}

function makeBall(id, num, x, y) {
  return { id, num, group: groupOf(num), x, y, vx: 0, vy: 0, potted: false, pocket: null };
}
