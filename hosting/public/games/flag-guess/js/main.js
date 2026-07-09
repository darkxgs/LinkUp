/*
 * main.js — bootstrap with LinkUp app bridge when embedded in WebView
 */
(function (global) {
  'use strict';

  var IG = global.IG;
  var Game = global.Game;

  var GAME_ID = 'flag-guess';
  var USER_ID = 'linkup-user';
  var started = false;

  function startGame() {
    if (started) return;
    started = true;

    var localWallet = new IG.LocalBalanceProvider();
    var localDaily = new IG.LocalDailyLimitProvider();
    var wallet = IG.AppBridge
      ? IG.AppBridge.createWalletIG(localWallet)
      : localWallet;
    var dailyLimit = IG.AppBridge
      ? IG.AppBridge.createDailyLimit(localDaily)
      : localDaily;
    var seen = new IG.LocalSeenProvider();

    var content = new IG.GoogleStreetViewProvider({
      baseUrl: IG.policyConfig.GEONAMES_BASE,
      getUsername: function () { return IG.policyConfig.GEONAMES_USERNAME; },
    });

    var state = Game.state.init({
      wallet: wallet,
      dailyLimit: dailyLimit,
      engine: Game.triviaEngine,
      content: content,
      contentFallback: null,
      seen: seen,
      userId: USER_ID,
      gameId: GAME_ID,
      challengeSeconds: IG.policyConfig.CHALLENGE_SECONDS || 10,
    });

    state.subscribe(function (s, reason) {
      Game.render.render(s, reason);
    });

    Game.input.bind(state);

    state.start();
  }

  global.onIntelBridgeReady = startGame;

  if (IG.AppBridge) {
    IG.AppBridge.boot({ gameId: GAME_ID, userId: USER_ID });
    if (!IG.AppBridge.isEmbedded() || IG.AppBridge.getState().walletReady) {
      startGame();
    }
  } else {
    startGame();
  }
})(typeof window !== 'undefined' ? window : this);
