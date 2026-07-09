// =============================================================================
// render.js — Draws GameState onto the canvas. NO game logic.
//
// Works in table-local coordinates (physics.js units) and applies a single
// uniform scale so the table fits the responsive canvas. input.js uses the same
// transform (exposed via toTableCoords) so screen taps map back to table space.
// =============================================================================

// Depends on globals from physics.js (TABLE, pockets) — loaded before this file.

// Standard pool ball colors by number.
const BALL_COLORS = {
  1: '#f4c20d', 2: '#1f4fd8', 3: '#d6202a', 4: '#5b2a86', 5: '#e8731f',
  6: '#138a3e', 7: '#7a1f25', 8: '#111111',
  9: '#f4c20d', 10: '#1f4fd8', 11: '#d6202a', 12: '#5b2a86', 13: '#e8731f',
  14: '#138a3e', 15: '#7a1f25',
};

class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    // Aim preview pushed in by input.js each frame: {angle, power} or null.
    this.aim = null;
    // Ghost cue position during ball-in-hand drag (table coords) or null.
    this.ghostCue = null;
    // Highlighted pocket while calling the 8-ball, or null.
    this.calledPocket = null;
    this.fallingBalls = new Map();

    this.bgImage = new Image();
    this.bgImage.onload = () => this.draw();
    this.bgImage.src = 'assets/sprites/ChatGPT Image Jun 20, 2026, 06_10_44 PM.png';

    this.stickImage = new Image();
    this.stickImage.onload = () => this.draw();
    this.stickImage.src = 'assets/sprites/spr_stick.png';

    this.resize();
  }

  // Fit the table into the canvas while preserving aspect ratio.
  resize() {
    const wrap = this.canvas.parentElement;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    // Cap DPR — lower on touch phones to cut fill-rate cost and avoid stutter.
    const isCoarse =
      (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window);
    const dpr = Math.min(window.devicePixelRatio || 1, isCoarse ? 1.5 : 2);
    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';

    const sx = cw / TABLE.WIDTH;
    const sy = ch / TABLE.HEIGHT;
    this.scale = Math.min(sx, sy) * 0.98;
    this.offsetX = (cw - TABLE.WIDTH * this.scale) / 2;
    this.offsetY = (ch - TABLE.HEIGHT * this.scale) / 2;
    this._dpr = dpr;
  }

  // Convert a screen (CSS pixel) point to table-local coordinates.
  toTableCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    return { x, y };
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    this.drawTable(ctx);
    this.drawPockets(ctx);

    if (this.aim && this.state.phase === Phase.AIMING) {
      // الكرات ثابتة أثناء التصويب — نعيد حساب مسار التوجيه فقط عند تغيّر الزاوية.
      if (this._aimGuideAngle !== this.aim.angle || !this.currentAimGuide) {
        this.currentAimGuide = predictAim(this.state.balls, this.aim.angle);
        this._aimGuideAngle = this.aim.angle;
      }
    } else {
      this.currentAimGuide = null;
      this._aimGuideAngle = null;
    }

    this.drawBalls(ctx);
    this.drawAim(ctx);
    this.drawGhostCue(ctx);

    ctx.restore();
  }

  drawTable(ctx) {
    if (this.bgImage && this.bgImage.complete) {
      ctx.drawImage(this.bgImage, 0, 0, TABLE.WIDTH, TABLE.HEIGHT);
    } else {
      ctx.fillStyle = '#0a361c';
      ctx.fillRect(0, 0, TABLE.WIDTH, TABLE.HEIGHT);
    }
  }

  drawPockets(ctx) {
    for (const p of pockets()) {
      if (this.calledPocket === p.id) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, TABLE.POCKET_RADIUS, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffd34d';
        ctx.stroke();
      }
    }
  }

  drawBalls(ctx) {
    const now = performance.now();
    
    // Check for newly potted balls
    for (const b of this.state.balls) {
      if (b.potted && !this.fallingBalls.has(b.id)) {
        this.fallingBalls.set(b.id, { start: now, x: b.x, y: b.y, pocket: b.pocket, done: false });
      }
    }

    // Draw live balls
    for (const b of this.state.balls) {
      if (b.potted) continue;
      this.drawSingleBall(ctx, b, b.x, b.y, 1.0);
    }

    // Draw falling balls
    for (const [id, falling] of this.fallingBalls.entries()) {
      if (falling.done) continue;
      
      const elapsed = now - falling.start;
      const DURATION = 600; // ms
      if (elapsed > DURATION) {
        falling.done = true;
        continue;
      }
      
      const b = this.state.balls.find(ball => ball.id === id);
      if (!b) continue;

      let px = falling.x;
      let py = falling.y;
      if (falling.pocket) {
        const pocket = pockets().find(p => p.id === falling.pocket);
        if (pocket) {
          const t = elapsed / DURATION;
          // smooth ease out
          const ease = 1 - Math.pow(1 - t, 3);
          px = falling.x + (pocket.x - falling.x) * ease;
          py = falling.y + (pocket.y - falling.y) * ease;
        }
      }
      
      const scale = 1.0 - (elapsed / DURATION);
      ctx.globalAlpha = scale;
      this.drawSingleBall(ctx, b, px, py, scale);
      ctx.globalAlpha = 1.0;
    }
  }

  drawSingleBall(ctx, b, bx, by, scale) {
    const r = TABLE.BALL_RADIUS * scale;
    if (r <= 0) return;

    // Shadow.
    ctx.beginPath();
    ctx.arc(bx + 2 * scale, by + 3 * scale, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // Base.
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    if (b.num === 0) ctx.fillStyle = '#fafafa';
    else ctx.fillStyle = BALL_COLORS[b.num];
    ctx.fill();

    // Stripe band.
    if (b.num >= 9 && b.num <= 15) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(bx - r, by - r * 0.45, r * 2, r * 0.9);
      ctx.restore();
    }

    // Number badge (not on cue ball).
    if (b.num !== 0) {
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.46, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `bold ${r * 0.7}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.num), bx, by + 0.5 * scale);
    }

    // Glossy highlight
    const highlight = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 0, bx - r * 0.3, by - r * 0.3, r * 0.9);
    highlight.addColorStop(0, 'rgba(255,255,255,0.7)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    // Invalid target X indicator
    if (this.state.phase === Phase.AIMING && b.num !== 0 && this.currentAimGuide && this.currentAimGuide.hitBallId === b.id) {
      const myGroup = this.state.groups[this.state.currentPlayer];
      let isInvalid = false;
      if (!myGroup) {
        isInvalid = (b.group === 'eight');
      } else if (b.group === 'eight') {
        isInvalid = !this.state.isOn8Ball(this.state.currentPlayer);
      } else {
        isInvalid = (b.group !== myGroup);
      }

      if (isInvalid) {
        ctx.beginPath();
        const xSize = r * 0.45;
        ctx.moveTo(bx - xSize, by - xSize);
        ctx.lineTo(bx + xSize, by + xSize);
        ctx.moveTo(bx + xSize, by - xSize);
        ctx.lineTo(bx - xSize, by + xSize);
        
        ctx.lineWidth = Math.max(3 * scale, 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke(); // shadow
        
        ctx.lineWidth = Math.max(2.5 * scale, 1);
        ctx.strokeStyle = '#ff3333';
        ctx.stroke();
      }
    }
  }

  drawAim(ctx) {
    if (!this.aim || !this.currentAimGuide) return;
    const cue = this.state.cueBall();
    if (!cue || cue.potted) return;
    const { power } = this.aim;

    const guide = this.currentAimGuide;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    
    // Draw the main path of the cue ball
    if (guide.cuePath && guide.cuePath.length > 0) {
      ctx.beginPath();
      ctx.moveTo(guide.cuePath[0].x, guide.cuePath[0].y);
      for (let i = 1; i < guide.cuePath.length; i++) {
        ctx.lineTo(guide.cuePath[i].x, guide.cuePath[i].y);
      }
      ctx.stroke();
    }

    // Draw the ghost ball
    if (guide.ghost) {
      ctx.beginPath();
      ctx.arc(guide.ghost.x, guide.ghost.y, TABLE.BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
    }

    // Draw target ball path
    if (guide.targetDir) {
      ctx.beginPath();
      ctx.moveTo(guide.targetDir[0].x, guide.targetDir[0].y);
      ctx.lineTo(guide.targetDir[1].x, guide.targetDir[1].y);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    }
    ctx.restore();

    // Draw cue stick sprite
    this.drawCue(ctx, cue);
  }

  drawCue(ctx, cue) {
    if (this.state.phase !== Phase.AIMING || !this.aim) return;
    const pullback = this.aim.power * 100;
    
    ctx.save();
    ctx.translate(cue.x, cue.y);
    ctx.rotate(this.aim.angle);
    
    if (this.stickImage && this.stickImage.complete) {
      // The stick image width is 938, height 22.
      // Origin (ball center) is at x=970, y=11.
      ctx.drawImage(this.stickImage, -970 - pullback, -11);
    } else {
      // Fallback cue so aiming remains visible when sprite assets are missing.
      const cueLen = 320;
      const start = -cueLen - 40 - pullback;
      const end = -26 - pullback;
      const grad = ctx.createLinearGradient(start, 0, end, 0);
      grad.addColorStop(0, '#5b3c1d');
      grad.addColorStop(0.55, '#c6924a');
      grad.addColorStop(1, '#f4d39a');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(start, 0);
      ctx.lineTo(end, 0);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawGhostCue(ctx) {
    if (!this.ghostCue) return;
    const r = TABLE.BALL_RADIUS;
    ctx.beginPath();
    ctx.arc(this.ghostCue.x, this.ghostCue.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// --- small canvas helpers ----------------------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
}
