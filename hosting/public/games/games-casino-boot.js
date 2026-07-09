/**
 * Boot loader for HTML luck/casino games in LinkUp WebView
 */
(function (global) {
  'use strict';

  var UTILS_VER = '13';
  var BRIDGE_VER = '2';

  function applyEmbedMode() {
    var embedded = !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
    var embedParam = /(?:^|[?&])embed=1(?:&|$)/.test(global.location.search || '');
    if (embedded || embedParam) {
      global.document.documentElement.classList.add('linkup-embed');
    }
  }
  applyEmbedMode();

  function getUtils() {
    return global.GamesConfigUtils;
  }

  function loadScript(src, onload) {
    var s = global.document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = function () {
      console.error('Failed to load', src);
    };
    global.document.head.appendChild(s);
  }

  function bootCasinoGame(gameId, onReady) {
    loadScript('../games-config-utils.js?v=' + UTILS_VER, function () {
      loadScript('../casino-i18n.js?v=' + BRIDGE_VER, function () {
        loadScript('../casino-coins.js?v=' + BRIDGE_VER, function () {
          loadScript('../casino-app-bridge.js?v=' + BRIDGE_VER, function () {
            loadScript('../casino-embed-hooks.js?v=' + BRIDGE_VER, function () {
            if (global.CasinoBridge) {
              global.CasinoBridge.boot({ gameId: gameId || '' });
            }
            var U = getUtils();
            if (U && typeof U.applyEmbeddedLabels === 'function') {
              U.applyEmbeddedLabels();
            }
            if (global.CasinoCoins && typeof global.CasinoCoins.applyEmbedCoinUI === 'function') {
              global.CasinoCoins.applyEmbedCoinUI();
            }
            if (global.CasinoCoins && typeof global.CasinoCoins.startObserver === 'function') {
              global.CasinoCoins.startObserver();
            }
            if (onReady) onReady();
          });
          });
        });
      });
    });
  }

  global.LinkUpCasinoBoot = {
    UTILS_VER: UTILS_VER,
    BRIDGE_VER: BRIDGE_VER,
    boot: bootCasinoGame,
    applyEmbedMode: applyEmbedMode,
  };
})(window);
