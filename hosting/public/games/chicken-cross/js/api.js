/**
 * LinkUp Casino API — Chicken Cross
 */
function isEmbedded() {
  return !!(window.CasinoBridge && CasinoBridge.isEmbedded());
}

function bridgeBalance() {
  return Math.floor(CasinoBridge.getBalance());
}

const ChickenAPI = {
  getBalance() {
    if (isEmbedded()) return bridgeBalance();
    let bal = localStorage.getItem('chicken_cross_balance');
    if (bal === null) {
      bal = '50000';
      localStorage.setItem('chicken_cross_balance', bal);
    }
    return parseInt(bal, 10);
  },

  saveBalance(balance) {
    if (isEmbedded()) return bridgeBalance();
    localStorage.setItem('chicken_cross_balance', String(Math.floor(balance)));
    return Math.floor(balance);
  },

  getBetLimits() {
    if (isEmbedded()) {
      const st = CasinoBridge.getState();
      const cfg = st && st.config ? st.config : {};
      return {
        min: cfg.minBet || 100,
        max: cfg.maxBet || 50000,
        chips: CasinoBridge.getStakeChips(),
      };
    }
    return { min: 100, max: 50000, chips: [100, 500, 1000, 5000] };
  },

  async startRound(stake) {
    stake = Math.floor(Number(stake) || 0);
    const limits = this.getBetLimits();
    if (stake < limits.min) {
      throw new Error('أقل رهان: ' + limits.min);
    }
    if (stake > limits.max) {
      throw new Error('أقصى رهان: ' + limits.max);
    }
    if (isEmbedded()) {
      if (bridgeBalance() < stake) {
        throw new Error('رصيدك غير كافٍ');
      }
      await CasinoBridge.placeBet(stake);
      return bridgeBalance();
    }
    const bal = this.getBalance();
    if (bal < stake) throw new Error('رصيدك غير كافٍ');
    this.saveBalance(bal - stake);
    return bal - stake;
  },

  reportWin(stake, multiplier, winAmount) {
    stake = Math.floor(Number(stake) || 0);
    winAmount = Math.floor(Number(winAmount) || 0);
    multiplier = Number(multiplier) || (stake > 0 ? winAmount / stake : 0);
    if (isEmbedded()) {
      CasinoBridge.reportGameResult({
        isWin: true,
        stake: stake,
        winAmount: winAmount,
        multiplier: multiplier,
        result: { game: 'chicken-cross', multiplier: multiplier },
      });
      return bridgeBalance();
    }
    return this.saveBalance(this.getBalance() + winAmount);
  },

  reportLoss(stake) {
    stake = Math.floor(Number(stake) || 0);
    if (isEmbedded()) {
      CasinoBridge.reportGameResult({
        isWin: false,
        stake: stake,
        winAmount: 0,
        multiplier: 0,
        result: { game: 'chicken-cross' },
      });
      return bridgeBalance();
    }
    return this.getBalance();
  },

  isEmbedded() {
    return isEmbedded();
  },

  formatBalance(amount) {
    if (window.CasinoCoins && CasinoCoins.isEmbedded()) {
      return CasinoCoins.formatAmount(amount, 18);
    }
    return Math.floor(amount).toLocaleString('en-US');
  },
};

if (window.CasinoCoins && CasinoCoins.installBridgeHooks) {
  CasinoCoins.installBridgeHooks(function () {
    if (typeof window.refreshChickenWalletUI === 'function') window.refreshChickenWalletUI();
    if (typeof window.applyChickenBetLimits === 'function') window.applyChickenBetLimits();
  });
}

window.ChickenAPI = ChickenAPI;
