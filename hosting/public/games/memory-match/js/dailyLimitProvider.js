window.dailyLimitProvider = {
  getStorageKey(userId, gameId, dateString) {
    return `${userId}_${gameId}_${dateString}`;
  },

  getTodayDateString() {
    const now = new Date();
    const localNow = new Date(now);
    if (localNow.getHours() < window.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL) {
       localNow.setDate(localNow.getDate() - 1);
    }
    return `${localNow.getFullYear()}-${(localNow.getMonth() + 1).toString().padStart(2, '0')}-${localNow.getDate().toString().padStart(2, '0')}`;
  },

  hasPlayedToday(userId, gameId) {
    const dateStr = this.getTodayDateString();
    const key = this.getStorageKey(userId, gameId, dateStr);
    return localStorage.getItem(key) === 'true';
  },

  recordPlay(userId, gameId) {
    const dateStr = this.getTodayDateString();
    const key = this.getStorageKey(userId, gameId, dateStr);
    localStorage.setItem(key, 'true');
  }
};
