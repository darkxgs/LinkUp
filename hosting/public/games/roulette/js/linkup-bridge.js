/**
 * LinkUp Casino Bridge — European Roulette
 */
(function (global) {
  'use strict';

  var _creditBeforeResult = 0;
  var _lastStake = 0;
  var _started = false;

  function isEmbedded() {
    return !!(global.CasinoBridge && global.CasinoBridge.isEmbedded());
  }

  function syncFicheValues(cfg) {
    if (!global.s_oGameSettings || !cfg) return;
    var chips = global.CasinoBridge.getStakeChips();
    if (chips && chips.length && global.s_oGameSettings.setFicheValuesFromChips) {
      global.s_oGameSettings.setFicheValuesFromChips(chips);
    }
  }

  function tryAutoStart() {
    if (!isEmbedded() || _started || !global._linkupBridgeReady) return;
    if (!global.s_oMenu || typeof global.s_oMenu._onButPlayRealRelease !== 'function') return;
    _started = true;
    var cfg = global._linkupRouletteConfig || {};
    if (cfg.minBet) global.MIN_BET = cfg.minBet;
    if (cfg.maxBet) global.MAX_BET = cfg.maxBet;
    global.s_oMenu._onButPlayRealRelease();
    setTimeout(function () {
      syncFicheValues(cfg);
      if (global.CasinoCoins) global.CasinoCoins.applyEmbedCoinUI();
    }, 800);
  }

  global.db_getUserBalance = function (callback) {
    if (isEmbedded()) {
      callback(Math.floor(global.CasinoBridge.getBalance()));
      return;
    }
    setTimeout(function () {
      callback(100000);
    }, 300);
  };

  global.db_saveUserBalance = function (iNewBalance, iWinAmount, iBetAmount) {
    if (!isEmbedded()) return;
    var winAmount = Math.max(0, Math.floor(Number(iWinAmount) || 0));
    if (!winAmount && _creditBeforeResult > 0 && iNewBalance > _creditBeforeResult) {
      winAmount = Math.floor(iNewBalance - _creditBeforeResult);
    }
    var stake = Math.floor(Number(iBetAmount) || _lastStake || 0);
    global.CasinoBridge.reportGameResult({
      isWin: winAmount > 0,
      stake: stake,
      winAmount: winAmount,
      multiplier: stake > 0 && winAmount > 0 ? winAmount / stake : 0,
      result: { game: 'roulette', balance: iNewBalance },
    });
    if (global.CasinoBridge.setBalance) {
      global.CasinoBridge.setBalance(Math.floor(iNewBalance));
    }
  };

  global.onCasinoBridgeReady = function (state) {
    global._linkupBridgeReady = true;
    global._linkupRouletteConfig = state.config || {};
    var cfg = global._linkupRouletteConfig;
    if (cfg.minBet) global.MIN_BET = cfg.minBet;
    if (cfg.maxBet) global.MAX_BET = cfg.maxBet;
    if (global.CasinoCoins) global.CasinoCoins.applyEmbedCoinUI();
    tryAutoStart();
  };

  global.LinkUpRouletteBridge = {
    onBetPlaced: function (stake) {
      if (!isEmbedded()) return;
      _lastStake = Math.floor(Number(stake) || 0);
      if (global.s_oGame && typeof global.s_oGame.getCredit === 'function') {
        _creditBeforeResult = global.s_oGame.getCredit();
      }
      global.CasinoBridge.placeBet(_lastStake).catch(function (err) {
        if (global.s_oGame && global.s_oGame.showMsgBox) {
          global.s_oGame.showMsgBox(err.message || 'فشل الرهان');
        }
        if (global.s_oInterface) {
          global.s_oInterface.hideBlock();
          global.s_oInterface.enableSpin(true);
          global.s_oInterface.enableBetFiches();
        }
      });
    },
    onSaveScore: function (newBalance, betAmount) {
      if (!isEmbedded()) return;
      var winAmount = 0;
      if (_creditBeforeResult > 0 && newBalance > _creditBeforeResult) {
        winAmount = newBalance - _creditBeforeResult;
      }
      global.db_saveUserBalance(newBalance, winAmount, betAmount || _lastStake);
    },
    tryAutoStart: tryAutoStart,
    isEmbedded: isEmbedded,
  };

  setInterval(tryAutoStart, 400);

  if (global.CasinoCoins && global.CasinoCoins.installBridgeHooks) {
    global.CasinoCoins.installBridgeHooks(function () {
      if (global.CasinoCoins) global.CasinoCoins.applyEmbedCoinUI();
    });
  }
})(typeof window !== 'undefined' ? window : this);
