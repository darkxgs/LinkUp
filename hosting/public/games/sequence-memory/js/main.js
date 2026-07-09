document.addEventListener('DOMContentLoaded', () => {
  const GAME_ID = 'sequence-memory';
  const USER_ID = 'linkup-user';
  let started = false;

  const localWallet = new LocalBalanceProvider();
  const localDaily = new DailyLimitProvider();
  window.walletProvider = window.IG?.AppBridge
    ? window.IG.AppBridge.createWalletSimple(localWallet)
    : localWallet;
  window.dailyLimitProvider = window.IG?.AppBridge
    ? window.IG.AppBridge.createDailyLimit(localDaily)
    : localDaily;

  function bootGame() {
    if (started) return;
    started = true;
    const state = new GameState();
    state.userId = USER_ID;
    state.gameId = GAME_ID;
    state.subscribe((currentState) => {
      render(currentState);
    });
    setupInput(state, render);
    state.init();
  }

  window.onIntelBridgeReady = bootGame;

  if (window.IG && window.IG.AppBridge) {
    window.IG.AppBridge.boot({ gameId: GAME_ID, userId: USER_ID });
    if (!window.IG.AppBridge.isEmbedded() || window.IG.AppBridge.getState().walletReady) {
      bootGame();
    }
  } else {
    bootGame();
  }
});
