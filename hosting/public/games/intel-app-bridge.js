/**
 * Bridge between modular intelligence games and LinkUp React Native WebView.
 * Wallet + daily limit + INIT_DATA / PLACE_BET / GAME_RESULT protocol.
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};

  var state = {
    embedded: false,
    balance: 0,
    hasPlayedToday: false,
    walletReady: false,
    gameId: '',
    userId: 'linkup-user',
    winMultiplier: 20,
    memorizeSeconds: 5,
    reconstructSeconds: 15,
    pendingBet: null,
    serverClockAnchor: 0,
    serverNowAtAnchor: 0,
    msUntilNextDailyReset: 0,
  };

  function syncServerClock(data) {
    if (data && typeof data.serverNow === 'number' && typeof data.msUntilNextDailyReset === 'number') {
      state.serverClockAnchor = Date.now();
      state.serverNowAtAnchor = data.serverNow;
      state.msUntilNextDailyReset = Math.max(0, data.msUntilNextDailyReset);
    }
  }

  function getServerSyncedMsUntilReset() {
    if (!state.serverClockAnchor || !state.msUntilNextDailyReset) return null;
    var elapsed = Date.now() - state.serverClockAnchor;
    return Math.max(0, state.msUntilNextDailyReset - elapsed);
  }

  function getUtils() {
    return global.GamesConfigUtils;
  }

  function isEmbedded() {
    return !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
  }

  function postToApp(data) {
    var U = getUtils();
    if (U && typeof U.postToApp === 'function') {
      U.postToApp(data);
      return true;
    }
    return false;
  }

  function calcWinAmount(stake) {
    var U = getUtils();
    if (U && typeof U.calcWinAmount === 'function') {
      return U.calcWinAmount(stake, state.winMultiplier);
    }
    return Math.floor(stake + stake * state.winMultiplier);
  }

  function calcNetProfit(stake) {
    var U = getUtils();
    if (U && typeof U.calcIntelligenceNetProfit === 'function') {
      return U.calcIntelligenceNetProfit(stake, state.winMultiplier);
    }
    return Math.floor(stake * state.winMultiplier);
  }

  function cancelBet(stake) {
    stake = Number(stake) || 0;
    if (!state.embedded || stake <= 0) return Promise.resolve();
    state.balance += stake;
    postToApp({ type: 'CANCEL_BET', stake: stake });
    return Promise.resolve();
  }

  function isAllowedStake(stake) {
    var U = getUtils();
    var chips = U && typeof U.canonicalIntelligenceChips === 'function'
      ? U.canonicalIntelligenceChips()
      : [5000, 10000, 25000, 50000];
    return chips.indexOf(Math.floor(Number(stake))) !== -1;
  }

  function assertEmbeddedStake(stake) {
    if (!state.embedded) return null;
    if (!isAllowedStake(stake)) {
      return global.IntelI18n
        ? global.IntelI18n.t('chooseBet')
        : 'اختر إحدى فئات الدخولية المعتمدة';
    }
    return null;
  }

  function placeBet(stake) {
    return new Promise(function (resolve, reject) {
      if (!state.embedded) {
        resolve();
        return;
      }
      var stakeErr = assertEmbeddedStake(stake);
      if (stakeErr) {
        reject(new Error(stakeErr));
        return;
      }
      if (!state.walletReady) {
        reject(new Error(global.IntelI18n ? global.IntelI18n.t('syncBalance') : 'Wallet not ready'));
        return;
      }
      if (state.hasPlayedToday) {
        reject(new Error(global.IntelI18n ? global.IntelI18n.t('dailyLimitUsed') : 'Daily limit'));
        return;
      }
      if (state.balance < stake) {
        reject(new Error(global.IntelI18n ? global.IntelI18n.t('insufficientBalance') : 'Insufficient balance'));
        return;
      }
      state.pendingBet = { stake: stake, resolve: resolve, reject: reject };
      postToApp({ type: 'PLACE_BET', stake: stake });
    });
  }

  function onBetConfirmed(payload) {
    if (!state.pendingBet) return;
    var stake = state.pendingBet.stake;
    state.balance = Math.max(0, state.balance - stake);
    var resolve = state.pendingBet.resolve;
    state.pendingBet = null;
    if (payload && payload.hasPlayedToday) {
      state.hasPlayedToday = true;
    }
    syncServerClock(payload || {});
    if (resolve) resolve();
  }

  function onBetFailed(message) {
    if (!state.pendingBet) return;
    var reject = state.pendingBet.reject;
    state.pendingBet = null;
    if (reject) reject(new Error(message || 'Bet failed'));
  }

  function reportGameResult(opts) {
    var stake = Number(opts.stake) || 0;
    var isWin = !!opts.isWin;
    var winAmount = isWin ? calcWinAmount(stake) : 0;
    if (isWin) {
      state.balance += winAmount;
    }
    state.hasPlayedToday = true;
    if (state.embedded) {
      postToApp({
        type: 'GAME_RESULT',
        isWin: isWin,
        stake: stake,
        winAmount: winAmount,
        multiplier: state.winMultiplier,
        result: opts.result || {},
      });
    }
    return { winAmount: winAmount, netProfit: isWin ? calcNetProfit(stake) : 0 };
  }

  function handleInitData(data) {
    var U = getUtils();
    var applied = U && typeof U.applyInitData === 'function'
      ? U.applyInitData(data, { balance: state.balance, winMultiplier: 20 })
      : { balance: data.balance || 0, hasPlayedToday: !!data.hasPlayedToday, winMultiplier: 20 };

    state.balance = applied.balance;
    state.hasPlayedToday = applied.hasPlayedToday;
    state.winMultiplier = applied.winMultiplier || 20;
    state.memorizeSeconds = applied.memorizeSeconds || 5;
    state.reconstructSeconds = applied.reconstructSeconds || 15;
    if (U && typeof U.syncIntelligencePolicyMultiplier === 'function') {
      U.syncIntelligencePolicyMultiplier(state.winMultiplier);
    }
    if (U && typeof U.syncSequenceMemoryLengthByStake === 'function' && applied.sequenceLengthByStake) {
      U.syncSequenceMemoryLengthByStake(applied.sequenceLengthByStake);
    }
    if (U && typeof U.syncSequenceMemoryTimingByStake === 'function' && applied.sequenceTimingByStake) {
      U.syncSequenceMemoryTimingByStake(applied.sequenceTimingByStake);
    } else if (U && typeof U.syncSequenceMemoryTiming === 'function') {
      U.syncSequenceMemoryTiming(state.memorizeSeconds, state.reconstructSeconds);
    }
    state.walletReady = true;
    syncServerClock(data);
    if (global.IntelUI && typeof global.IntelUI.setServerClock === 'function') {
      global.IntelUI.setServerClock({
        serverNow: data.serverNow,
        msUntilNextDailyReset: data.msUntilNextDailyReset,
      });
    }
  }

  function bindMessages() {
    var U = getUtils();
    var onData = function (data) {
      if (!data || !data.type) return;
      if (data.type === 'INIT_DATA') {
        handleInitData(data);
        if (typeof global.onIntelBridgeReady === 'function') {
          global.onIntelBridgeReady(state);
        }
      } else if (data.type === 'UPDATE_BALANCE') {
        state.balance = Number(data.balance) || 0;
        state.walletReady = true;
      } else if (data.type === 'BET_CONFIRMED') {
        onBetConfirmed(data);
      } else if (data.type === 'ERROR') {
        onBetFailed(data.message);
        if (global.IntelUI && global.IntelUI.isDailyLimitMessage(data.message)) {
          global.IntelUI.showDailyLimitNotice(data.message);
        } else if (global.alert) {
          global.alert((global.IntelI18n ? global.IntelI18n.t('insufficientBalance') : 'Error') + ': ' + (data.message || ''));
        }
      }
    };

    if (U && typeof U.bindAppMessageListener === 'function') {
      U.bindAppMessageListener(onData);
    } else {
      global.addEventListener('message', function (event) {
        try {
          var raw = event && event.data;
          if (typeof raw !== 'string') return;
          onData(JSON.parse(raw));
        } catch (e) { /* ignore */ }
      });
    }
  }

  /** Flag-style wallet (IG.LocalBalanceProvider interface) */
  function BridgeWalletIG(localProvider) {
    this._local = localProvider;
  }
  BridgeWalletIG.prototype.getBalance = function (userId) {
    if (state.embedded && state.walletReady) return state.balance;
    return this._local.getBalance(userId);
  };
  BridgeWalletIG.prototype.debit = function (userId, amount) {
    if (state.embedded) {
      state.balance = Math.max(0, state.balance - amount);
      return state.balance;
    }
    return this._local.debit(userId, amount);
  };
  BridgeWalletIG.prototype.credit = function (userId, amount) {
    if (state.embedded) {
      state.balance += amount;
      return state.balance;
    }
    return this._local.credit(userId, amount);
  };
  BridgeWalletIG.prototype.setBalance = function (userId, amount) {
    if (state.embedded) {
      state.balance = Math.max(0, Math.round(Number(amount) || 0));
      return state.balance;
    }
    if (this._local.setBalance) return this._local.setBalance(userId, amount);
    return amount;
  };

  /** Remember / Shapes wallet (debit returns boolean) */
  function BridgeWalletSimple(localProvider) {
    this._local = localProvider;
  }
  BridgeWalletSimple.prototype.getBalance = function (userId) {
    if (state.embedded && state.walletReady) return state.balance;
    return this._local.getBalance(userId);
  };
  BridgeWalletSimple.prototype.debit = function (userId, amount) {
    if (state.embedded) {
      if (state.balance < amount) return false;
      state.balance -= amount;
      return true;
    }
    return this._local.debit(userId, amount);
  };
  BridgeWalletSimple.prototype.credit = function (userId, amount) {
    if (state.embedded) {
      state.balance += amount;
      return true;
    }
    return this._local.credit(userId, amount);
  };

  /** Daily limit — app enforces one try/day per game (server-side) */
  function BridgeDailyLimit(localProvider) {
    this._local = localProvider;
  }
  BridgeDailyLimit.prototype.hasPlayedToday = function (userId, gameId) {
    if (state.embedded && state.walletReady) return state.hasPlayedToday;
    if (this._local && typeof this._local.hasPlayedToday === 'function') {
      return this._local.hasPlayedToday(userId, gameId);
    }
    return false;
  };
  BridgeDailyLimit.prototype.recordPlay = function (userId, gameId) {
    state.hasPlayedToday = true;
    if (this._local && typeof this._local.recordPlay === 'function') {
      this._local.recordPlay(userId, gameId);
    }
  };
  BridgeDailyLimit.prototype.resetForTesting = function (userId, gameId) {
    state.hasPlayedToday = false;
    if (this._local && typeof this._local.resetForTesting === 'function') {
      this._local.resetForTesting(userId, gameId);
    } else if (this._local && typeof this._local.clearLimit === 'function') {
      this._local.clearLimit(userId, gameId);
    }
  };
  BridgeDailyLimit.prototype.getMsUntilNextReset = function () {
    var synced = getServerSyncedMsUntilReset();
    if (state.embedded && synced != null) return synced;
    if (this._local && typeof this._local.getMsUntilNextReset === 'function') {
      return this._local.getMsUntilNextReset();
    }
    if (global.IntelUI && typeof global.IntelUI.getMsUntilNextReset === 'function') {
      return global.IntelUI.getMsUntilNextReset();
    }
    if (global.IG && typeof global.IG.timeUntilNextReset === 'function') {
      return global.IG.timeUntilNextReset().ms;
    }
    var now = new Date();
    var next = new Date(now);
    next.setHours(0, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  };

  function boot(options) {
    options = options || {};
    state.embedded = isEmbedded();
    state.gameId = options.gameId || '';
    state.userId = options.userId || 'linkup-user';

    if (global.IntelI18n && typeof global.IntelI18n.init === 'function') {
      global.IntelI18n.init();
    }

    bindMessages();

    var U = getUtils();
    if (state.embedded) {
      if (U && typeof U.applyEmbeddedLabels === 'function') U.applyEmbeddedLabels();
      if (global.LinkUpGameBoot && typeof global.LinkUpGameBoot.bootApp === 'function') {
        global.LinkUpGameBoot.bootApp();
      } else if (U && typeof U.initGameBridge === 'function') {
        U.initGameBridge();
      }
    } else if (U && typeof U.ensureDemoReady === 'function') {
      U.ensureDemoReady();
      state.balance = U.DEMO_BALANCE || 50000;
      state.walletReady = true;
    }

    return state;
  }

  IG.AppBridge = {
    boot: boot,
    isEmbedded: isEmbedded,
    placeBet: placeBet,
    cancelBet: cancelBet,
    isAllowedStake: isAllowedStake,
    assertEmbeddedStake: assertEmbeddedStake,
    reportGameResult: reportGameResult,
    calcWinAmount: calcWinAmount,
    calcNetProfit: calcNetProfit,
    getState: function () { return state; },
    createWalletIG: function (local) { return new BridgeWalletIG(local); },
    createWalletSimple: function (local) { return new BridgeWalletSimple(local); },
    createDailyLimit: function (local) { return new BridgeDailyLimit(local); },
  };
})(typeof window !== 'undefined' ? window : this);
