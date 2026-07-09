// =============================================================================
// input.js — Mouse/touch handling for aim + power (click-drag-release).
//
// Converts raw pointer events into ONE Shot { angle, power } object and hands it
// off via a callback (main.js routes it through the transport). Also handles
// two auxiliary interactions that belong to "input", not game logic:
//   - ball-in-hand: drag the cue ball to a new spot after a foul,
//   - call-pocket: tap a pocket before an 8-ball attempt.
//
// Slingshot control: press anywhere, drag AWAY from the cue ball to pull the
// stick back; the ball fires in the OPPOSITE direction (toward the cue ball from
// the pointer). Release to shoot. Power = drag distance / MAX_DRAG.
// =============================================================================

// Depends on globals from physics.js (TABLE, pockets, playfield) and
// state.js (Phase) — loaded before this file.

const MAX_DRAG = 240; // table px of pull-back that equals full power

class InputController {
  constructor(canvas, state, renderer, { onShot, onCallPocket, canInteract }) {
    this.canvas = canvas;
    this.state = state;
    this.renderer = renderer;
    this.onShot = onShot;
    this.onCallPocket = onCallPocket;
    this.canInteract = typeof canInteract === 'function' ? canInteract : () => true;

    this.draggingAim = false;
    this.draggingPower = false;
    this.draggingCue = false;       // ball-in-hand mode
    
    this.currentAngle = 0;
    this.currentPower = 0;
    
    this.callMode = false;          // waiting for an 8-ball pocket tap

    this._bind();
  }

  enableCallPocketMode(on) { this.callMode = on; }

  _pointer(e) {
    const t = e.touches ? e.touches[0] : e;
    return this.renderer.toTableCoords(t.clientX, t.clientY);
  }

  _bind() {
    const c = this.canvas;
    const down = (e) => this._onDown(e);
    const move = (e) => this._onMove(e);
    const up = (e) => this._onUp(e);

    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('touchstart', (e) => { e.preventDefault(); down(e); }, { passive: false });
    window.addEventListener('touchmove', (e) => { if(this.draggingAim || this.draggingCue) e.preventDefault(); move(e); }, { passive: false });
    window.addEventListener('touchend', up);

    // Power meter binding
    const pm = document.getElementById('power-meter-area');
    if (!pm) return;
    
    const pmDown = (e) => {
      if (!this.canInteract()) return;
      if (this.state.phase !== Phase.AIMING) return;
      this.draggingPower = true;
      this._updatePowerFromEvent(e);
    };
    const pmMove = (e) => {
      if (!this.draggingPower) return;
      this._updatePowerFromEvent(e);
    };
    const pmUp = (e) => {
      if (!this.draggingPower) return;
      this.draggingPower = false;
      const shot = { angle: this.currentAngle, power: this.currentPower };
      this.currentPower = 0;
      this._publishAim();
      if (shot.power > 0.03) {
        this.renderer.aim = null;
        this.onShot(shot);
      }
    };

    pm.addEventListener('mousedown', pmDown);
    pm.addEventListener('touchstart', (e) => { e.preventDefault(); pmDown(e); }, { passive: false });
    window.addEventListener('mousemove', pmMove);
    window.addEventListener('mouseup', pmUp);
    window.addEventListener('touchmove', (e) => { if(this.draggingPower) e.preventDefault(); pmMove(e); }, { passive: false });
    window.addEventListener('touchend', pmUp);
  }

  _updatePowerFromEvent(e) {
    const pm = document.getElementById('power-meter-area');
    const rect = pm.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    // Power is 0 at top, 1 at bottom. Dragging down increases power.
    let y = t.clientY - rect.top;
    let power = y / rect.height;
    this.currentPower = Math.max(0, Math.min(1, power));
    this._publishAim();
  }

  _onDown(e) {
    if (!this.canInteract()) return;
    if (this.state.phase !== Phase.AIMING) return;
    const p = this._pointer(e);

    // 1) Calling a pocket for the 8-ball.
    if (this.callMode) {
      const pk = nearestPocket(p);
      if (pk) { this.onCallPocket(pk.id); }
      return;
    }

    const cue = this.state.cueBall();
    if (!cue || cue.potted) return;

    // 2) Ball-in-hand: grab the cue ball if the player has it.
    if (this.state.ballInHand && dist(p, cue) < TABLE.BALL_RADIUS * 2.5) {
      this.draggingCue = true;
      this.renderer.ghostCue = { x: cue.x, y: cue.y };
      return;
    }

    // 3) Normal aim drag on canvas
    this.draggingAim = true;
    if (cue) {
      this.aimStartTouchAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
      this.aimStartAngle = this.currentAngle;
    }
  }

  _onMove(e) {
    if (this.draggingCue) {
      const p = this._pointer(e);
      const pf = playfield();
      this.renderer.ghostCue = {
        x: Math.max(pf.left, Math.min(pf.right, p.x)),
        y: Math.max(pf.top, Math.min(pf.bottom, p.y)),
      };
      return;
    }
    if (this.draggingAim) {
      const p = this._pointer(e);
      const cue = this.state.cueBall();
      if (!cue) return;
      
      const currentTouchAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
      let diff = currentTouchAngle - this.aimStartTouchAngle;
      
      // Normalize difference to -PI to PI
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      const sensitivity = window.gameSettings ? window.gameSettings.sensitivity : 1.0;
      this.currentAngle = this.aimStartAngle + (diff * sensitivity);
      this._publishAim();
    }
  }

  _onUp(e) {
    // Finish ball-in-hand placement.
    if (this.draggingCue) {
      this.draggingCue = false;
      const g = this.renderer.ghostCue;
      this.renderer.ghostCue = null;
      if (g) this.state.placeCueBall(g.x, g.y);
      return;
    }

    if (this.draggingAim) {
      this.draggingAim = false;
    }
  }

  _updateAimFromPoint(p) {
    // Only used for initial setup or explicit direct pointing if needed.
    const cue = this.state.cueBall();
    if (!cue) return;
    this.currentAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
    this._publishAim();
  }

  _publishAim() {
    this.renderer.aim = { angle: this.currentAngle, power: this.currentPower };
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function nearestPocket(p) {
  let best = null, bestD = Infinity;
  for (const pk of pockets()) {
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < bestD) { bestD = d; best = pk; }
  }
  // Generous tap radius for calling.
  return bestD < TABLE.POCKET_RADIUS * 3 ? best : null;
}
