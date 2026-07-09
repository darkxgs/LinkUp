// LocalBalanceProvider (in-memory implementation)
class LocalBalanceProvider {
  constructor() {
    this.balances = {};
    this.defaultBalance = DEFAULT_BALANCE;
  }

  getBalance(userId) {
    if (!(userId in this.balances)) {
      const saved = localStorage.getItem(`wallet_balance_${userId}`);
      this.balances[userId] = saved !== null ? parseFloat(saved) : this.defaultBalance;
    }
    return this.balances[userId];
  }

  debit(userId, amount) {
    const current = this.getBalance(userId);
    if (current < amount) {
      return false;
    }
    this.balances[userId] = current - amount;
    localStorage.setItem(`wallet_balance_${userId}`, this.balances[userId]);
    return true;
  }

  credit(userId, amount) {
    const current = this.getBalance(userId);
    this.balances[userId] = current + amount;
    localStorage.setItem(`wallet_balance_${userId}`, this.balances[userId]);
    return true;
  }
}

// Make globally accessible
window.walletProvider = new LocalBalanceProvider();
