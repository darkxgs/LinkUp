/*
 * input.js
 * -----------------------------------------------------------------------------
 * Game #1 input layer: bet-chip taps, answer submit (Enter or button), the
 * countdown tick, and the "come back tomorrow" clock interval. It only reads the
 * DOM and CALLS into Game.state — it never renders. Uses event delegation on #app
 * so it survives every re-render without re-binding listeners.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var Game = global.Game = global.Game || {};

  var _challengeTimer = null;   // setInterval handle for the 10s countdown
  var _clockTimer = null;       // setInterval handle for the blocked/result clock
  var _endTime = 0;             // timestamp (ms) when the current challenge ends

  function startChallengeTimer(state) {
    stopChallengeTimer();
    _endTime = Date.now() + state.timeLeft * 1000;
    _challengeTimer = global.setInterval(function () {
      var remainingMs = _endTime - Date.now();
      if (remainingMs <= 0) {
        stopChallengeTimer();
        state.setTimeLeft(0);
        state.handleTimeout();
        return;
      }
      state.setTimeLeft(remainingMs / 1000);
    }, 100);
  }

  function stopChallengeTimer() {
    if (_challengeTimer) { global.clearInterval(_challengeTimer); _challengeTimer = null; }
  }

  // The "next reset" clock ticks once per second whenever it's visible.
  function startClock() {
    stopClock();
    _clockTimer = global.setInterval(function () {
      Game.render.updateBlockedCountdown();
    }, 1000);
  }
  function stopClock() {
    if (_clockTimer) { global.clearInterval(_clockTimer); _clockTimer = null; }
  }

  function bind(state) {
    var app = document.getElementById('app');

    // --- Delegated taps/clicks (works for touch + mouse) ---
    app.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('.chip');
      if (chip && !chip.hasAttribute('disabled')) {
        state.selectBet(Number(chip.getAttribute('data-bet')));
        return;
      }
      var mcqBtn = e.target.closest && e.target.closest('.mcq-btn');
      if (mcqBtn) {
        stopChallengeTimer();
        state.submitAnswer(mcqBtn.getAttribute('data-answer'));
        return;
      }
    });

    // --- Form submits (delegated): answer form + custom-bet form ---
    app.addEventListener('submit', function (e) {
      if (!e.target) return;

      // Answer submit: Enter key or the Submit button.
      if (e.target.id === 'answer-form') {
        e.preventDefault();
        var input = document.getElementById('answer-input');
        var value = input ? input.value : '';
        stopChallengeTimer();
        state.submitAnswer(value);
        return;
      }

      // Custom bet: validate (>= MIN_BET, <= balance), show reason or start.
      if (e.target.id === 'custom-bet-form') {
        e.preventDefault();
        var field = document.getElementById('custom-bet-input');
        var bet = field ? Math.floor(Number(field.value)) : NaN;
        var reason = state.validateBet(bet);
        if (reason) { Game.render.showBetError(reason); return; }
        Game.render.showBetError('');
        state.selectBet(bet);
      }
    });

    // --- React to phase changes to drive timers ---
    state.subscribe(function (s, reason) {
      if (reason !== 'phase') return;

      if (s.phase === s.PHASES.CHALLENGE_ACTIVE) {
        startChallengeTimer(s);
      } else {
        stopChallengeTimer();
      }

      if (s.phase === s.PHASES.BLOCKED_UNTIL_TOMORROW || s.phase === s.PHASES.RESULT) {
        startClock();
      } else {
        stopClock();
      }
    });
  }

  Game.input = { bind: bind };

})(typeof window !== 'undefined' ? window : this);
