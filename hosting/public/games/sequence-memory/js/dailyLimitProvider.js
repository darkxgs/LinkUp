class DailyLimitProvider {
  /**
   * Get the date string representing "today" in local time.
   * Resets at DAILY_LIMIT_RESET_HOUR_LOCAL (default 00:00 midnight).
   */
  _getLocalDateString() {
    const now = new Date();
    
    // If the reset hour is other than midnight, adjust the date calculation:
    // e.g., if reset is 4 AM, then hours before 4 AM belong to the previous calendar day.
    const adjusted = new Date(now);
    adjusted.setHours(now.getHours() - DAILY_LIMIT_RESET_HOUR_LOCAL);
    
    const year = adjusted.getFullYear();
    const month = String(adjusted.getMonth() + 1).padStart(2, '0');
    const day = String(adjusted.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  _getKey(userId, gameId) {
    const todayStr = this._getLocalDateString();
    return `${userId}_${gameId}_${todayStr}`;
  }

  hasPlayedToday(userId, gameId) {
    const key = this._getKey(userId, gameId);
    return localStorage.getItem(key) === 'true';
  }

  recordPlay(userId, gameId) {
    const key = this._getKey(userId, gameId);
    localStorage.setItem(key, 'true');
  }

  clearLimit(userId, gameId) {
    const key = this._getKey(userId, gameId);
    localStorage.removeItem(key);
  }

  /**
   * Get milliseconds remaining until the next local midnight reset.
   */
  getMsUntilNextReset() {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(DAILY_LIMIT_RESET_HOUR_LOCAL, 0, 0, 0);
    
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    
    return nextReset.getTime() - now.getTime();
  }
}

// Make globally accessible
window.dailyLimitProvider = new DailyLimitProvider();
