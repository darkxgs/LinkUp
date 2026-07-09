/**
 * Bridge for HTML luck/casino games inside LinkUp React Native WebView.
 * Protocol: INIT_GAME → INIT_DATA → PLACE_BET → BET_CONFIRMED → GAME_RESULT
 */
(function (global) {
  'use strict';

  var state = {
    embedded: false,
    balance: 0,
    casinoBalance: 0,
    walletReady: false,
    gameId: '',
    winMultiplier: 2,
    pendingBet: null,
    config: null,
  };

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

  function calcWinAmount(stake, multiplier) {
    var s = Number(stake) || 0;
    var m = Number(multiplier) || state.winMultiplier || 2;
    return Math.floor(s * m);
  }

  function formatCasinoWin(coinWin) {
    var U = getUtils();
    if (U && typeof U.formatCasinoDisplay === 'function') {
      return U.formatCasinoDisplay(coinWin, true);
    }
    return String((Number(coinWin) || 0) / 10000);
  }

  function isAllowedStake(stake) {
    var chips = getStakeChips();
    if (!chips.length) return true;
    return chips.indexOf(Math.floor(Number(stake))) !== -1;
  }

  function getStakeChips() {
    var cfg = state.config;
    var U = getUtils();
    if (cfg && U && typeof U.buildChipValues === 'function') {
      return U.buildChipValues(cfg.minBet, cfg.maxBet, null, cfg.stakeChips);
    }
    if (cfg && cfg.minBet) {
      return [cfg.minBet, cfg.minBet * 2, cfg.minBet * 5, cfg.minBet * 10].filter(function (v, i, a) {
        return a.indexOf(v) === i && (!cfg.maxBet || v <= cfg.maxBet);
      });
    }
    return [100, 500, 1000, 5000];
  }

  function placeBet(stake) {
    return new Promise(function (resolve, reject) {
      if (!state.embedded) {
        resolve();
        return;
      }
      stake = Math.floor(Number(stake));
      if (!stake || stake <= 0) {
        reject(new Error(global.CasinoI18n ? global.CasinoI18n.t('invalidStake') : 'قيمة الدخولية غير صالحة'));
        return;
      }
      if (!state.walletReady) {
        reject(new Error(global.CasinoI18n ? global.CasinoI18n.t('syncBalance') : 'جاري مزامنة الرصيد...'));
        return;
      }
      if (state.balance < stake) {
        reject(new Error(global.CasinoI18n ? global.CasinoI18n.t('insufficientBalance') : 'رصيدك غير كافٍ'));
        return;
      }
      var cfg = state.config;
      if (cfg) {
        if (stake < (cfg.minBet || 1)) {
          reject(new Error((global.CasinoI18n ? global.CasinoI18n.t('minBet') : 'أقل رهان') + ' ' + cfg.minBet));
          return;
        }
        if (cfg.maxBet && stake > cfg.maxBet) {
          reject(new Error((global.CasinoI18n ? global.CasinoI18n.t('maxBet') : 'أقصى رهان') + ' ' + cfg.maxBet));
          return;
        }
      }
      state.pendingBet = { stake: stake, resolve: resolve, reject: reject };
      postToApp({ type: 'PLACE_BET', stake: stake });
    });
  }

  function cancelBet(stake) {
    stake = Number(stake) || 0;
    if (!state.embedded || stake <= 0) return Promise.resolve();
    state.balance += stake;
    postToApp({ type: 'CANCEL_BET', stake: stake });
    return Promise.resolve();
  }

  function onBetConfirmed() {
    if (!state.pendingBet) return;
    var stake = state.pendingBet.stake;
    state.balance = Math.max(0, state.balance - stake);
    var resolve = state.pendingBet.resolve;
    state.pendingBet = null;
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
    var multiplier = Number(opts.multiplier) || state.winMultiplier || 2;
    var winAmount = isWin ? (Number(opts.winAmount) || calcWinAmount(stake, multiplier)) : 0;
    if (isWin) {
      state.casinoBalance += winAmount;
    }
    if (state.embedded) {
      postToApp({
        type: 'GAME_RESULT',
        isWin: isWin,
        stake: stake,
        winAmount: winAmount,
        multiplier: multiplier,
        result: opts.result || {},
      });
    }
    return { winAmount: winAmount, multiplier: multiplier };
  }

  function handleInitData(data) {
    var U = getUtils();
    state.balance = data && data.balance != null ? Number(data.balance) : 0;
    state.casinoBalance = data && data.casinoCoins != null ? Number(data.casinoCoins) : 0;
    state.config = data && data.config ? data.config : null;
    if (state.config && state.config.multipliers && state.config.multipliers.length) {
      state.winMultiplier = Number(state.config.multipliers[0]) || 2;
    }
    if (U && typeof U.applyEmbeddedLabels === 'function') {
      U.applyEmbeddedLabels();
    }
    if (global.CasinoI18n && typeof global.CasinoI18n.init === 'function') {
      global.CasinoI18n.init(data && (data.lang || data.locale));
    }
    state.walletReady = true;
    if (global.CasinoCoins) {
      if (typeof global.CasinoCoins.applyEmbedCoinUI === 'function') global.CasinoCoins.applyEmbedCoinUI();
      if (typeof global.CasinoCoins.startObserver === 'function') global.CasinoCoins.startObserver();
    }
    if (typeof global.onCasinoBridgeReady === 'function') {
      global.onCasinoBridgeReady(state);
    }
  }

  function bindMessages() {
    var onData = function (raw) {
      var data = raw;
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw); } catch (e) { return; }
      }
      if (!data || !data.type) return;
      if (data.type === 'INIT_DATA') {
        handleInitData(data);
      } else if (data.type === 'UPDATE_BALANCE') {
        state.balance = Number(data.balance) || 0;
        if (data.casinoCoins != null) state.casinoBalance = Number(data.casinoCoins) || 0;
        state.walletReady = true;
      } else if (data.type === 'BET_CONFIRMED') {
        onBetConfirmed();
      } else if (data.type === 'ERROR') {
        onBetFailed(data.message);
      }
    };

    var U = getUtils();
    if (U && typeof U.bindAppMessageListener === 'function') {
      U.bindAppMessageListener(onData);
    } else {
      global.addEventListener('message', function (e) {
        try { onData(e.data); } catch (err) { /* ignore */ }
      });
      if (global.document) {
        global.document.addEventListener('message', function (e) {
          try { onData(e.data); } catch (err) { /* ignore */ }
        });
      }
    }
  }

  function boot(options) {
    options = options || {};
    state.embedded = isEmbedded();
    state.gameId = options.gameId || '';
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

  global.CasinoBridge = {
    boot: boot,
    isEmbedded: isEmbedded,
    placeBet: placeBet,
    cancelBet: cancelBet,
    reportGameResult: reportGameResult,
    calcWinAmount: calcWinAmount,
    formatCasinoWin: formatCasinoWin,
    getStakeChips: getStakeChips,
    isAllowedStake: isAllowedStake,
    getState: function () { return state; },
    setBalance: function (n) { state.balance = Number(n) || 0; },
    getBalance: function () { return state.balance; },
    getCasinoBalance: function () { return state.casinoBalance; },
    getCasinoBalanceDisplay: function () {
      var U = getUtils();
      if (U && typeof U.storedToCasinoDisplay === 'function') {
        return U.storedToCasinoDisplay(state.casinoBalance);
      }
      return (Number(state.casinoBalance) || 0) / 10000;
    },
  };
})(typeof window !== 'undefined' ? window : this);
