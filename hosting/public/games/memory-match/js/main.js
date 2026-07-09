document.addEventListener('DOMContentLoaded', () => {
  const GAME_ID = 'memory-match';
  const USER_ID = 'linkup-user';
  let started = false;

  if (window.particleSystem) {
    window.particleSystem.init('fx-canvas');
  }

  const localWallet = new window.LocalBalanceProvider(100000);
  const localDaily = window.dailyLimitProvider;

  function bootGame() {
    if (started) return;
    started = true;

    if (window.IG?.AppBridge?.isEmbedded()) {
      document.querySelectorAll('[data-embed-hide]').forEach((el) => {
        el.style.display = 'none';
      });
      const customBet = document.querySelector('.custom-bet-container');
      if (customBet) customBet.style.display = 'none';
    }
    if (window.IntelCoins) window.IntelCoins.injectContainers();
    const walletProvider = window.IG?.AppBridge
      ? window.IG.AppBridge.createWalletSimple(localWallet)
      : localWallet;
    const dailyLimit = window.IG?.AppBridge
      ? window.IG.AppBridge.createDailyLimit(localDaily)
      : localDaily;

    const engine = new window.MatchEngine(walletProvider, dailyLimit, USER_ID);
    new window.Renderer(engine);
    new window.InputHandler(engine);
    engine.checkDailyLimit();
  }

  window.onIntelBridgeReady = bootGame;

  if (window.IG && window.IG.AppBridge) {
    window.IG.AppBridge.boot({ gameId: GAME_ID, userId: USER_ID });
    if (!window.IG.AppBridge.isEmbedded() || window.IG.AppBridge.getState().walletReady) {
      bootGame();
    }
  } else {
    const walletProvider = localWallet;
    const engine = new window.MatchEngine(walletProvider, localDaily, USER_ID);
    new window.Renderer(engine);
    new window.InputHandler(engine);
    engine.checkDailyLimit();
  }
});
