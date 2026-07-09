/*
 * state.js
 * -----------------------------------------------------------------------------
 * Game #1 single source of truth + finite state machine.
 *
 *   CHECK_DAILY_LIMIT
 *        |--(played today)--> BLOCKED_UNTIL_TOMORROW   (terminal for today)
 *        |--(not yet)-------> BET_SELECT
 *                                  |--(tap a bet chip)--> CHALLENGE_ACTIVE (timer)
 *                                                              |--> RESULT (WIN/LOSE)
 *
 * The shared policy providers (wallet, dailyLimit) and the pure engine are
 * INJECTED via init(), so this file stays the only place that orchestrates the
 * round but never reaches into the DOM. Subscribers (render, input) are notified
 * via subscribe(fn). The notify "reason" lets render do a cheap timer-only update
 * during CHALLENGE_ACTIVE instead of rebuilding the input field every tick.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG;
  var Game = global.Game = global.Game || {};

  var PHASES = {
    CHECK_DAILY_LIMIT: 'CHECK_DAILY_LIMIT',
    BLOCKED_UNTIL_TOMORROW: 'BLOCKED_UNTIL_TOMORROW',
    BET_SELECT: 'BET_SELECT',
    CHALLENGE_LOADING: 'CHALLENGE_LOADING', // fetching a place from the content provider
    CHALLENGE_ACTIVE: 'CHALLENGE_ACTIVE',
    RESULT: 'RESULT'
  };

  var state = {
    PHASES: PHASES,

    // --- data (single source of truth) ---
    phase: PHASES.CHECK_DAILY_LIMIT,
    userId: null,
    gameId: null,
    balance: 0,
    currentBet: null,
    currentItem: null,
    timeLeft: 0,        // fractional seconds, drives the countdown ring
    challengeSeconds: 10,
    result: null,       // { outcome:'WIN'|'LOSE', payout, correctAnswer, item, bet }

    // --- internals ---
    _deps: null,
    _listeners: [],

    loadError: null, // set when a place could not be sourced

    init: function (deps) {
      // deps = { wallet, dailyLimit, engine, content, contentFallback, seen,
      //          userId, gameId, challengeSeconds }
      this._deps = deps;
      this.userId = deps.userId;
      this.gameId = deps.gameId;
      this.challengeSeconds = deps.challengeSeconds || 10;
      return this;
    },

    subscribe: function (fn) {
      this._listeners.push(fn);
    },

    _notify: function (reason) {
      for (var i = 0; i < this._listeners.length; i++) {
        this._listeners[i](this, reason);
      }
    },

    // Entry point: decide BLOCKED vs BET_SELECT based on the daily limit.
    start: function () {
      var d = this._deps;
      this.balance = d.wallet.getBalance(this.userId);
      if (d.dailyLimit.hasPlayedToday(this.userId, this.gameId)) {
        this.phase = PHASES.BLOCKED_UNTIL_TOMORROW;
      } else {
        this.phase = PHASES.BET_SELECT;
      }
      this._notify('phase');
    },

    // Validate a bet (preset chip OR custom amount). Returns null if OK, else a
    // reason string. Rule: bet >= MIN_BET (pay more is fine, never less) and
    // bet <= balance.
    validateBet: function (bet) {
      var minBet = IG.policyConfig.MIN_BET;
      bet = Math.floor(Number(bet));
      if (!isFinite(bet) || bet <= 0) return 'الرجاء إدخال مبلغ صحيح';
      if (IG.AppBridge && IG.AppBridge.isEmbedded()) {
        var embedErr = IG.AppBridge.assertEmbeddedStake(bet);
        if (embedErr) return embedErr;
      }
      if (bet < minBet) return 'الحد الأدنى للرهان هو ' + minBet + ' كوين';
      if (bet > this.balance) return 'رصيدك لا يكفي لهذا الرهان';
      return null;
    },

    // Player chose a bet (chip or custom). Async: confirm wager with app when embedded,
    // take the wager, fetch a fresh place, then start the timed challenge.
    selectBet: function (bet) {
      if (this.phase !== PHASES.BET_SELECT) return Promise.resolve();
      var self = this, d = this._deps;
      bet = Math.floor(Number(bet));
      if (this.validateBet(bet) !== null) return Promise.resolve();

      var beginRound = function () {
        if (!IG.AppBridge || !IG.AppBridge.isEmbedded()) {
          self.balance = d.wallet.debit(self.userId, bet);
        } else {
          self.balance = IG.AppBridge.getState().balance;
        }
        self.currentBet = bet;
        self.currentItem = null;
        self.result = null;
        self.loadError = null;
        self.phase = PHASES.CHALLENGE_LOADING;
        self._notify('phase');

        var diffLevel = 1;
        var choiceCount = 3;
        self.challengeSeconds = 15;

        if (bet >= 50000) {
          diffLevel = 2;
          choiceCount = 4;
          self.challengeSeconds = 10;
        }
        if (bet >= 250000) {
          diffLevel = 3;
          choiceCount = 6;
          self.challengeSeconds = 7;
        }
        if (bet >= 1000000) {
          diffLevel = 4;
          choiceCount = 8;
          self.challengeSeconds = 5;
        }

        var seen = d.seen ? d.seen.getSeen(self.userId, self.gameId) : [];

        return self._sourcePlace(seen, diffLevel, choiceCount).then(function (place) {
          if (self.phase !== PHASES.CHALLENGE_LOADING) return;

          if (!place) {
            if (IG.AppBridge && IG.AppBridge.isEmbedded()) {
              void IG.AppBridge.cancelBet(bet);
            } else {
              self.balance = d.wallet.credit(self.userId, bet);
            }
            self.currentBet = null;
            self.loadError = 'تعذّر تحميل مكان جديد. تحقّق من الاتصال وحاول مرة أخرى.';
            self.phase = PHASES.BET_SELECT;
            self._notify('phase');
            return;
          }

          if (d.seen) d.seen.markSeen(self.userId, self.gameId, place.key);
          self.currentItem = place;
          self.timeLeft = self.challengeSeconds;
          self.phase = PHASES.CHALLENGE_ACTIVE;
          self._notify('phase');
        });
      };

      if (IG.AppBridge && IG.AppBridge.isEmbedded()) {
        return IG.AppBridge.placeBet(bet).then(beginRound).catch(function (err) {
          var msg = (err && err.message) ? err.message : 'تعذّر تأكيد الدخولية';
          if (global.IntelUI && global.IntelUI.isDailyLimitMessage(msg)) {
            global.IntelUI.showDailyLimitNotice(msg);
          }
          self.loadError = msg;
          self.phase = PHASES.BET_SELECT;
          self._notify('phase');
        });
      }

      return beginRound();
    },

    // Try the primary (GeoNames) content provider, then the static fallback.
    _sourcePlace: function (seen, diffLevel, choiceCount) {
      var d = this._deps;
      var primary = d.content;
      var fallback = d.contentFallback;

      var p = (primary && primary.isAvailable && primary.isAvailable())
        ? primary.getRandomPlace(seen, diffLevel, choiceCount)
        : Promise.resolve(null);

      return p.then(function (place) {
        if (place) return place;
        return fallback ? fallback.getRandomPlace(seen) : null;
      }).catch(function () {
        return fallback ? fallback.getRandomPlace(seen) : null;
      });
    },

    // Called frequently by the timer in input.js. Cheap "tick" update only.
    setTimeLeft: function (seconds) {
      if (this.phase !== PHASES.CHALLENGE_ACTIVE) return;
      this.timeLeft = seconds;
      this._notify('tick');
    },

    submitAnswer: function (text) {
      if (this.phase !== PHASES.CHALLENGE_ACTIVE) return;
      var correct = this._deps.engine.validateAnswer(this.currentItem, text);
      this._resolve(correct, false);
    },

    handleTimeout: function () {
      if (this.phase !== PHASES.CHALLENGE_ACTIVE) return;
      this._resolve(false, true);
    },

    // Shared resolution: payout/debit already-handled wager, record the daily play.
    _resolve: function (correct, isTimeout) {
      var d = this._deps;
      var payout = 0;
      var outcome = 'LOSE';

      if (correct) {
        outcome = 'WIN';
        if (IG.AppBridge && IG.AppBridge.isEmbedded()) {
          var reported = IG.AppBridge.reportGameResult({
            isWin: true,
            stake: this.currentBet,
            result: {
              correctAnswer: this.currentItem ? this.currentItem.answerAr : '',
              timeout: !!isTimeout,
            },
          });
          payout = reported.winAmount;
          this.balance = IG.AppBridge.getState().balance;
        } else {
          payout = this.currentBet * IG.policyConfig.REWARD_MULTIPLIER;
          this.balance = d.wallet.credit(this.userId, payout);
        }
      } else if (IG.AppBridge && IG.AppBridge.isEmbedded()) {
        IG.AppBridge.reportGameResult({
          isWin: false,
          stake: this.currentBet,
          result: {
            correctAnswer: this.currentItem ? this.currentItem.answerAr : '',
            timeout: !!isTimeout,
          },
        });
        this.balance = IG.AppBridge.getState().balance;
      }

      d.dailyLimit.recordPlay(this.userId, this.gameId);

      this.result = {
        outcome: outcome,
        payout: payout,
        bet: this.currentBet,
        correctAnswer: this.currentItem ? this.currentItem.answerAr : '',
        item: this.currentItem,
        _timeout: !!isTimeout
      };
      this.phase = PHASES.RESULT;
      this._notify('phase');
    }
  };

  Game.state = state;

})(typeof window !== 'undefined' ? window : this);
