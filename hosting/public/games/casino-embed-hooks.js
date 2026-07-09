/**
 * خطافات embed موحّدة — تطبيق أيقونة الكوينز بعد جاهزية المحفظة
 */
(function (global) {
  'use strict';
  if (!global.CasinoCoins) return;
  if (typeof global.CasinoCoins.installBridgeHooks === 'function') {
    global.CasinoCoins.installBridgeHooks(function () {
      global.CasinoCoins.applyEmbedCoinUI();
    });
  } else if (typeof global.CasinoCoins.applyEmbedCoinUI === 'function') {
    global.onCasinoBridgeReady = function (state) {
      global.CasinoCoins.applyEmbedCoinUI();
      if (typeof global.__luPrevBridgeReady === 'function') global.__luPrevBridgeReady(state);
    };
  }
})(typeof window !== 'undefined' ? window : this);
