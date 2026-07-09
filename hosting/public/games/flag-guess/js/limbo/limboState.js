/*
 * limboState.js
 * -----------------------------------------------------------------------------
 * GAME #2 ("Limbo") state container + game flow. Framework-free observable store.
 *
 * Responsibilities:
 *   - Hold all UI state (balance, bet amount, target, win chance, mode, history,
 *     live stats, auto-bet config).
 *   - Run a single bet through the shared wallet (debit) -> engine.roll() ->
 *     wallet (credit on win), then notify subscribers.
 *   - Drive the Auto-bet loop with Stake-style on-win / on-loss rules and
 *     stop-on-profit / stop-on-loss guards.
 *
 * It depends ONLY on:
 *   - IG.LimboEngine        (math + randomness)
 *   - a BalanceProvider     (IG.LocalBalanceProvider now; Remote* later)
 * so swapping in a real wallet/RNG never touches this file.
 *
 * Attaches to window.Limbo.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var Limbo = global.Limbo = global.Limbo || {};

  var HISTORY_MAX = 24; // how many past-bet pills to keep

  function clampNumber(n, min, fallback) {
    n = Number(n);
    if (!isFinite(n)) return fallback;
    if (typeof min === 'number' && n < min) return min;
    return n;
  }

  function createStore(deps) {
    var engine = deps.engine;
    var wallet = deps.wallet;
    var userId = deps.userId;

    var subscribers = [];
    var autoTimer = null;

    var state = {
      userId: userId,
      // wallet
      balance: wallet.getBalance(userId),
      // bet inputs
      betAmount: deps.startingBet || 0,
      target: engine.normalizeTarget(deps.startingTarget || 2.0),
      // derived (kept in state so the view doesn't recompute)
      winChance: 0,
      profitOnWin: 0,
      // mode + lifecycle
      mode: 'manual',                 // 'manual' | 'auto'
      status: 'idle',                 // 'idle' | 'rolling' | 'result'
      busy: false,                    // true while a bet is resolving (locks UI)
      lastResult: null,               // last roll() result object (+ {betAmount})
      history: [],                    // [{ result, win }] newest-first
      error: null,
      // live stats (session)
      stats: { profit: 0, wagered: 0, wins: 0, losses: 0, bets: 0 },
      // auto-bet config + runtime
      auto: {
        numberOfBets: 0,              // 0 = infinity (∞)
        onWin: { mode: 'reset', pct: 0 },   // 'reset' | 'increase'
        onLoss: { mode: 'reset', pct: 0 },
        stopOnProfit: 0,              // 0 = disabled
        stopOnLoss: 0,                // 0 = disabled
        running: false,
        remaining: 0,
        baseBet: 0,                   // bet to return to on "reset"
        sessionProfit: 0              // profit accumulated during this auto run
      }
    };

    function recompute() {
      state.winChance = engine.winChanceForTarget(state.target);
      state.profitOnWin = state.betAmount * (state.target - 1);
    }
    recompute();

    function notify(reason) {
      for (var i = 0; i < subscribers.length; i++) subscribers[i](state, reason);
    }

    // --- input setters --------------------------------------------------------
    function setBetAmount(v) {
      state.betAmount = Math.max(0, clampNumber(v, 0, 0));
      recompute();
      notify('bet-amount');
    }
    function setTarget(v) {
      state.target = engine.normalizeTarget(v);
      recompute();
      notify('target');
    }
    function setWinChance(v) {
      state.target = engine.targetForWinChance(v);
      recompute();
      notify('win-chance');
    }
    function setMode(mode) {
      if (state.auto.running) return; // can't switch tabs mid-autobet
      state.mode = (mode === 'auto') ? 'auto' : 'manual';
      notify('mode');
    }
    function halveBet() { setBetAmount(state.betAmount / 2); }
    function doubleBet() { setBetAmount(state.betAmount * 2); }
    function setMaxBet() { setBetAmount(state.balance); }

    function setAutoConfig(patch) {
      var a = state.auto;
      if ('numberOfBets' in patch) a.numberOfBets = Math.max(0, Math.floor(clampNumber(patch.numberOfBets, 0, 0)));
      if ('onWinMode' in patch) a.onWin.mode = patch.onWinMode;
      if ('onWinPct' in patch) a.onWin.pct = clampNumber(patch.onWinPct, 0, 0);
      if ('onLossMode' in patch) a.onLoss.mode = patch.onLossMode;
      if ('onLossPct' in patch) a.onLoss.pct = clampNumber(patch.onLossPct, 0, 0);
      if ('stopOnProfit' in patch) a.stopOnProfit = Math.max(0, clampNumber(patch.stopOnProfit, 0, 0));
      if ('stopOnLoss' in patch) a.stopOnLoss = Math.max(0, clampNumber(patch.stopOnLoss, 0, 0));
      notify('auto-config');
    }

    // --- the core: resolve one bet -------------------------------------------
    // Returns the roll result, or null if the bet was rejected.
    function resolveBet() {
      var bet = state.betAmount;
      state.error = null;

      if (!(bet > 0)) {
        state.error = 'Enter a bet amount.';
        notify('error');
        return null;
      }
      if (bet > state.balance) {
        state.error = 'Insufficient balance.';
        notify('error');
        return null;
      }

      // Debit the wager up front (server-authoritative in a real build).
      state.balance = wallet.debit(userId, bet);

      var outcome = engine.roll(state.target, bet);
      outcome.betAmount = bet;

      if (outcome.win) {
        state.balance = wallet.credit(userId, outcome.payout);
      }

      // Live stats
      var s = state.stats;
      s.wagered += bet;
      s.bets += 1;
      s.profit += outcome.profit;
      if (outcome.win) s.wins += 1; else s.losses += 1;

      // History (newest first)
      state.history.unshift({ result: outcome.result, win: outcome.win });
      if (state.history.length > HISTORY_MAX) state.history.pop();

      state.lastResult = outcome;
      state.status = 'result';
      recompute();
      return outcome;
    }

    // --- MANUAL bet -----------------------------------------------------------
    function placeBet() {
      if (state.busy || state.auto.running) return null;
      state.busy = true;
      state.status = 'rolling';
      notify('rolling');

      var outcome = resolveBet();
      state.busy = false;

      if (!outcome) { state.status = 'idle'; notify('idle'); return null; }
      notify('result');
      return outcome;
    }

    // --- AUTO bet -------------------------------------------------------------
    function applyAutoAdjustment(won) {
      var a = state.auto;
      var rule = won ? a.onWin : a.onLoss;
      if (rule.mode === 'reset') {
        state.betAmount = a.baseBet;
      } else { // increase by pct
        state.betAmount = state.betAmount * (1 + (rule.pct / 100));
      }
      recompute();
    }

    function autoShouldStop() {
      var a = state.auto;
      if (a.numberOfBets > 0 && a.remaining <= 0) return true;
      if (a.stopOnProfit > 0 && a.sessionProfit >= a.stopOnProfit) return true;
      if (a.stopOnLoss > 0 && -a.sessionProfit >= a.stopOnLoss) return true;
      if (state.betAmount > state.balance) return true; // can't afford next bet
      return false;
    }

    function autoStep() {
      var a = state.auto;
      if (!a.running) return;

      if (autoShouldStop()) { stopAuto(); return; }

      var outcome = resolveBet();
      if (!outcome) { stopAuto(); return; }

      a.sessionProfit += outcome.profit;
      if (a.numberOfBets > 0) a.remaining -= 1;

      notify('result');

      // Prepare the next bet amount per win/loss rules.
      applyAutoAdjustment(outcome.win);

      if (autoShouldStop()) { stopAuto(); return; }

      // Pace the loop so the count-up animation is visible (Stake ~ fast).
      autoTimer = global.setTimeout(autoStep, deps.autoIntervalMs || 750);
    }

    function startAuto() {
      var a = state.auto;
      if (a.running) return;
      if (!(state.betAmount > 0)) { state.error = 'Enter a bet amount.'; notify('error'); return; }
      if (state.betAmount > state.balance) { state.error = 'Insufficient balance.'; notify('error'); return; }

      a.running = true;
      a.baseBet = state.betAmount;
      a.sessionProfit = 0;
      a.remaining = a.numberOfBets; // 0 stays 0 -> treated as infinite
      state.error = null;
      notify('auto-start');
      autoStep();
    }

    function stopAuto() {
      var a = state.auto;
      a.running = false;
      if (autoTimer) { global.clearTimeout(autoTimer); autoTimer = null; }
      state.status = state.lastResult ? 'result' : 'idle';
      notify('auto-stop');
    }

    function toggleAuto() {
      if (state.auto.running) stopAuto(); else startAuto();
    }

    // --- demo helper: refill the fake balance --------------------------------
    function resetBalance(amount) {
      state.balance = wallet.setBalance(userId, amount);
      notify('balance');
    }

    function resetStats() {
      state.stats = { profit: 0, wagered: 0, wins: 0, losses: 0, bets: 0 };
      notify('stats');
    }

    function subscribe(fn) {
      subscribers.push(fn);
      return function () {
        subscribers = subscribers.filter(function (f) { return f !== fn; });
      };
    }

    return {
      get: function () { return state; },
      subscribe: subscribe,
      notify: notify,
      // inputs
      setBetAmount: setBetAmount,
      setTarget: setTarget,
      setWinChance: setWinChance,
      setMode: setMode,
      halveBet: halveBet,
      doubleBet: doubleBet,
      setMaxBet: setMaxBet,
      setAutoConfig: setAutoConfig,
      // play
      placeBet: placeBet,
      startAuto: startAuto,
      stopAuto: stopAuto,
      toggleAuto: toggleAuto,
      // demo
      resetBalance: resetBalance,
      resetStats: resetStats
    };
  }

  Limbo.createStore = createStore;

})(typeof window !== 'undefined' ? window : this);
