window.LocalBalanceProvider = class LocalBalanceProvider {
  constructor(initialBalance = 100000) {
    this.storageKey = 'local_wallet_balance';
    const current = localStorage.getItem(this.storageKey);
    if (!current || parseInt(current, 10) < 5000) {
      localStorage.setItem(this.storageKey, initialBalance.toString());
    }
  }

  getBalance(userId) {
    return parseInt(localStorage.getItem(this.storageKey), 10) || 0;
  }

  debit(userId, amount) {
    let balance = this.getBalance(userId);
    if (balance >= amount) {
      balance -= amount;
      localStorage.setItem(this.storageKey, balance.toString());
      return true;
    }
    return false;
  }

  credit(userId, amount) {
    let balance = this.getBalance(userId);
    balance += amount;
    localStorage.setItem(this.storageKey, balance.toString());
  }
}

// TODO: RemoteBalanceProvider hooks in here later.
