/* =============================================================================
 * render.js — draws whatever state.js currently holds. NO game logic.
 *
 * It reads GameState and updates the DOM: screens, HUD, the 3x3 grid (only for
 * the player currently picking), handoff screen, kick/dive/ball animation,
 * result toast, and the match-over overlay. It never decides outcomes.
 * ========================================================================== */

(function (global) {
  'use strict';

  const PHASE = State.PHASE;
  const N = Rules.GRID_SIZE;

  // Goalkeeper sprite per dive zone (paths are relative to index.html).
  const KEEPER_IMG = {
    stand: 'js/assets/keeper.png',
    0: 'js/assets/Left.png',   // dive LEFT
    1: 'js/assets/keeper.png', // hold CENTER
    2: 'js/assets/Right.png',  // dive RIGHT
  };

  // Map a zone index (0=LEFT, 1=CENTER, 2=RIGHT) -> on-goal position (% of mouth).
  // Zones span the full goal height, so the vertical target is always mid-goal.
  function zonePos(zone) {
    const col = zone;
    return {
      col,
      x: (col + 0.5) / N * 100, // horizontal center of the zone
      y: 50,                    // mid-height of the goal
    };
  }

  class Renderer {
    constructor(handlers) {
      this.h = handlers; // input callbacks wired by input.js/main.js
      this._cache();
      this._buildGrid();
      this._animating = false;
    }

    _cache() {
      this.el = {
        screenWager: document.getElementById('screen-wager'),
        screenMatch: document.getElementById('screen-match'),
        screenOver: document.getElementById('screen-over'),

        startBtn: document.getElementById('start-match'),
        betInput: document.getElementById('bet-input'),
        potPreview: document.getElementById('pot-preview'),
        wagerError: document.getElementById('wager-error'),

        hudPot: document.getElementById('hud-pot'),
        roundLabel: document.getElementById('round-label'),

        grid: document.getElementById('aim-grid'),
        keeper: document.getElementById('keeper'),
        keeperFigure: document.querySelector('#keeper .keeper-figure'),
        ball: document.getElementById('ball'),
        ballShadow: document.getElementById('ball-shadow'),
        fx: document.getElementById('fx'),
        stadium: document.querySelector('.stadium'),
        pitch: document.querySelector('.pitch'),
        pickPrompt: document.getElementById('pick-prompt'),

        handoff: document.getElementById('handoff'),
        handoffName: document.getElementById('handoff-name'),
        handoffReady: document.getElementById('handoff-ready'),

        toast: document.getElementById('result-toast'),
        toastText: document.getElementById('result-text'),

        overEmoji: document.getElementById('over-emoji'),
        overTitle: document.getElementById('over-title'),
        overScore: document.getElementById('over-score'),
        overPayout: document.getElementById('over-payout'),
        rematchBtn: document.getElementById('rematch-btn'),
        menuBtn: document.getElementById('menu-btn'),
      };
    }

    _buildGrid() {
      const grid = this.el.grid;
      grid.innerHTML = '';
      for (let z = 0; z < N; z++) {
        const cell = document.createElement('button');
        cell.className = 'zone';
        cell.dataset.zone = z;
        cell.addEventListener('click', () => {
          if (this.h.onZoneTap) this.h.onZoneTap(z);
        });
        grid.appendChild(cell);
      }
    }

    // ---- top-level render dispatch ------------------------------------------
    render(state) {
      this._renderWagerInfo(state);

      switch (state.phase) {
        case PHASE.WAGER:
          this._show('wager');
          break;
        case PHASE.MATCH_OVER:
          this._show('match'); // keep the pitch behind the overlay
          this._renderHUD(state);
          this._renderOver(state);
          break;
        default:
          this._show('match');
          this._renderHUD(state);
          this._renderPlayPhase(state);
      }
    }

    _show(which) {
      this.el.screenWager.classList.toggle('hidden', which !== 'wager');
      this.el.screenMatch.classList.toggle('hidden', which !== 'match');
      // The over-overlay is shown explicitly by _renderOver (it sits on top of
      // the match screen). Here we just hide it whenever we're not over.
      if (which !== 'over') this.el.screenOver.classList.add('hidden');
    }

    // ---- Wager screen --------------------------------------------------------
    _renderWagerInfo(state) {
      document.querySelectorAll('.balance').forEach((node) => {
        node.textContent = state.getBalance(node.dataset.player);
      });
      this.el.potPreview.textContent = state.bet * 2;
    }

    setWagerError(msg) {
      this.el.wagerError.textContent = msg || '';
    }

    setStartEnabled(enabled) {
      this.el.startBtn.disabled = !enabled;
    }

    // ---- HUD -----------------------------------------------------------------
    _renderHUD(state) {
      ['P1', 'P2'].forEach((p) => {
        const name = document.querySelector('.hud-name[data-player="' + p + '"]');
        const score = document.querySelector('.hud-score[data-player="' + p + '"]');
        const bal = document.querySelector('.hud-balance[data-player="' + p + '"]');
        name.textContent = state.names[p];
        score.textContent = state.stats[p].goals + '/' + state.stats[p].kicks;
        bal.textContent = state.getBalance(p) + ' 🪙';

        const card = document.querySelector('.hud-player[data-player="' + p + '"]');
        card.classList.toggle('is-shooter', state.currentKick.shooter === p
          && state.phase !== PHASE.MATCH_OVER);
      });
      this.el.hudPot.textContent = state.pot;
      this.el.roundLabel.textContent = state.suddenDeath
        ? 'SUDDEN DEATH'
        : 'Round ' + (Math.floor((state.stats.P1.kicks + state.stats.P2.kicks) / 2) + 1);
      this.el.roundLabel.classList.toggle('sd', state.suddenDeath);
    }

    // ---- Play phases ---------------------------------------------------------
    _renderPlayPhase(state) {
      const ck = state.currentKick;

      // Grid visibility: only the active picker sees zones.
      const showGrid = state.phase === PHASE.SHOOTER_AIMING
        || state.phase === PHASE.KEEPER_DIVING;
      this.el.grid.classList.toggle('hidden', !showGrid);

      // Handoff overlay.
      const showHandoff = state.phase === PHASE.HANDOFF;
      this.el.handoff.classList.toggle('hidden', !showHandoff);
      if (showHandoff) this.el.handoffName.textContent = state.names[ck.keeper];

      // Ball "live" pulse ring only while the shooter is choosing.
      this.el.ball.classList.toggle('live', state.phase === PHASE.SHOOTER_AIMING && !ck.shooterPick);

      // Prompt text + grid styling per role.
      if (state.phase === PHASE.SHOOTER_AIMING) {
        this.el.pickPrompt.textContent = '🎯 ' + state.names[ck.shooter] + ', pick where to SHOOT';
        this.el.grid.classList.remove('keeper-mode');
        this.el.grid.classList.add('shooter-mode');
      } else if (state.phase === PHASE.KEEPER_DIVING) {
        this.el.pickPrompt.textContent = '🧤 ' + state.names[ck.keeper] + ', pick where to DIVE';
        this.el.grid.classList.remove('shooter-mode');
        this.el.grid.classList.add('keeper-mode');
      } else if (state.phase === PHASE.RESOLVING) {
        this.el.pickPrompt.textContent = '';
      }

      // Reset ball/keeper to neutral at the start of a fresh kick.
      if (state.phase === PHASE.SHOOTER_AIMING && !ck.shooterPick && !this._animating) {
        this._resetSprites();
      }

      // When a kick has resolved, play the animation then signal completion.
      if (state.phase === PHASE.KICK_RESULT && !this._animating) {
        this._playKick(state);
      }
    }

    _resetSprites() {
      const ball = this.el.ball;
      const shadow = this.el.ballShadow;
      const keeper = this.el.keeper;
      const figure = this.el.keeperFigure;
      // Revert ball to its CSS resting position on the penalty spot.
      ball.style.transition = 'none';
      ball.style.left = '';
      ball.style.top = '';
      ball.style.transform = 'translate(-50%, 0) scale(1)';
      ball.classList.remove('hidden', 'saved', 'scored');
      // Ball shadow back under the spot.
      shadow.style.transition = 'none';
      shadow.style.left = '';
      shadow.style.top = '';
      shadow.style.opacity = '';
      shadow.style.transform = 'translateX(-50%)';
      // Stand the keeper back up in the center: restore the standing sprite,
      // clear the dive transform, and re-enable the idle bob animation.
      figure.style.transition = 'none';
      figure.style.transform = '';
      figure.style.animation = '';
      figure.style.backgroundImage = 'url("' + KEEPER_IMG.stand + '")';
      keeper.classList.remove('diving');
      // force reflow so subsequent transitions apply
      void ball.offsetWidth;
    }

    /**
     * Animate the ball flying to the shot zone and the keeper diving to theirs,
     * then reveal the toast and tell main.js the beat is done.
     */
    _playKick(state) {
      this._animating = true;
      const { shooterZone, keeperZone, outcome } = state.lastResult;
      const shot = zonePos(shooterZone);
      const dive = zonePos(keeperZone);

      this.el.grid.classList.add('hidden');
      this.el.pickPrompt.textContent = '';
      this.el.ball.classList.remove('live');

      // Measure the goal/pitch once; both the keeper dive and ball flight use it.
      const goal = document.querySelector('.goal').getBoundingClientRect();
      const pitch = this.el.pitch.getBoundingClientRect();

      // Keeper dives toward their guessed zone: swap to the matching dive sprite
      // and slide toward that side. The idle animation is paused so the inline
      // dive transform isn't overridden by the running keyframes.
      const keeper = this.el.keeper;
      const figure = this.el.keeperFigure;
      figure.style.animation = 'none';
      figure.style.backgroundImage = 'url("' + KEEPER_IMG[dive.col] + '")';
      figure.style.transition = 'transform 0.45s cubic-bezier(.2,.8,.3,1)';
      // Dive distance scales with goal width so it reaches near the posts on any
      // screen size. ~40% of the goal width to each side.
      const diveX = (dive.col - 1) * goal.width * 0.40;
      const lift = dive.col === 1 ? 0 : -goal.height * 0.12; // airborne on a side dive
      figure.style.transform = 'translate(' + diveX + 'px,' + lift + 'px)';
      keeper.classList.add('diving');

      // Ball flies from the spot to the shot zone.
      const ball = this.el.ball;
      const shadow = this.el.ballShadow;
      const targetX = goal.left - pitch.left + goal.width * (shot.x / 100);
      const targetY = goal.top - pitch.top + goal.height * (shot.y / 100);
      const spotX = pitch.width / 2;
      const spotY = pitch.height - 70;

      ball.style.transition = 'none';
      ball.style.left = spotX + 'px';
      ball.style.top = spotY + 'px';
      shadow.style.transition = 'none';
      shadow.style.left = spotX + 'px';
      shadow.style.top = (spotY + 26) + 'px';
      void ball.offsetWidth;

      ball.style.transition = 'left 0.5s ease-in, top 0.5s ease-in, transform 0.5s ease-in';
      ball.style.left = targetX + 'px';
      ball.style.top = targetY + 'px';
      // spin the ball as it flies (direction follows the shot side)
      const spin = (shot.col - 1 || 1) * 540;
      ball.style.transform = 'translate(-50%,-50%) scale(0.7) rotate(' + spin + 'deg)';
      // Shadow trails the ball horizontally and fades as it lifts into the goal.
      shadow.style.transition = 'left 0.5s ease-in, opacity 0.5s ease-in, transform 0.5s';
      shadow.style.left = targetX + 'px';
      shadow.style.transform = 'translateX(-50%) scale(0.5)';
      shadow.style.opacity = '0.15';

      // After the flight, show the result + FX.
      setTimeout(() => {
        if (outcome === 'SAVE') {
          ball.classList.add('saved'); // bounces off the keeper
        } else {
          ball.classList.add('scored');
          this._goalFx(targetX, targetY); // explosion + coins + shake
        }
        this._showToast(outcome);
      }, 520);

      // End the beat.
      setTimeout(() => {
        this._hideToast();
        ball.classList.remove('saved', 'scored');
        this._animating = false;
        if (this.h.onResultDone) this.h.onResultDone();
      }, 1700);
    }

    /** Goal celebration: net burst, coin shower, and a screen shake. */
    _goalFx(x, y) {
      const fx = this.el.fx;
      // central burst flash
      const burst = document.createElement('div');
      burst.className = 'burst';
      burst.style.left = x + 'px';
      burst.style.top = y + 'px';
      fx.appendChild(burst);
      setTimeout(() => burst.remove(), 520);

      // coin shower from the goal
      for (let i = 0; i < 14; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.style.left = x + 'px';
        coin.style.top = y + 'px';
        coin.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
        coin.style.setProperty('--dy', (Math.random() * 120 + 60) + 'px');
        coin.style.animationDelay = (Math.random() * 0.12) + 's';
        fx.appendChild(coin);
        setTimeout(() => coin.remove(), 1050);
      }

      // screen shake on the pitch
      const pitch = this.el.pitch;
      pitch.classList.add('shake');
      setTimeout(() => pitch.classList.remove('shake'), 420);
    }

    _showToast(outcome) {
      this.el.toast.classList.remove('hidden', 'goal', 'save');
      void this.el.toast.offsetWidth;
      if (outcome === 'GOAL') {
        this.el.toastText.textContent = 'GOAL! ⚽';
        this.el.toast.classList.add('goal');
      } else {
        this.el.toastText.textContent = 'SAVED! 🧤';
        this.el.toast.classList.add('save');
      }
    }
    _hideToast() {
      this.el.toast.classList.add('hidden');
    }

    // ---- Match over ----------------------------------------------------------
    _renderOver(state) {
      this.el.screenOver.classList.remove('hidden');
      const w = state.winner;
      const l = w === 'P1' ? 'P2' : 'P1';
      this.el.overEmoji.textContent = '🏆';
      this.el.overTitle.textContent = state.names[w] + ' Wins!';
      this.el.overScore.textContent =
        state.stats.P1.goals + ' — ' + state.stats.P2.goals;
      this.el.overPayout.innerHTML =
        '<div class="payout-win">' + state.names[w] + ' won +' + state.payout + ' 🪙</div>' +
        '<div class="payout-lose">' + state.names[l] + ' lost −' + state.bet + ' 🪙</div>';
    }
  }

  global.Render = { Renderer };
})(window);
