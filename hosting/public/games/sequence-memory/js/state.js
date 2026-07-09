const STATES = {
  CHECK_DAILY_LIMIT: 'CHECK_DAILY_LIMIT',
  BLOCKED_UNTIL_TOMORROW: 'BLOCKED_UNTIL_TOMORROW',
  BET_SELECT: 'BET_SELECT',
  DISPLAY_PHASE: 'DISPLAY_PHASE',
  RECONSTRUCT_PHASE: 'RECONSTRUCT_PHASE',
  RESULT: 'RESULT'
};

class GameState {
  constructor() {
    this.userId = 'demo_user';
    this.gameId = 'sequence-memory';
    this.state = STATES.CHECK_DAILY_LIMIT;
    
    this.engine = new SequenceEngine();
    
    this.balance = 0;
    this.currentBet = 0;
    this.timer = 0;
    this.timerMax = 0;
    this.timerInterval = null;
    
    this.originalSequence = [];
    this.shuffledPool = [];
    this.answerTrack = []; // Placed tile instances
    
    this.winResult = null; // true = WIN, false = LOSE
    this.onStateChangeCallbacks = [];
  }

  subscribe(callback) {
    this.onStateChangeCallbacks.push(callback);
  }

  notify() {
    for (const callback of this.onStateChangeCallbacks) {
      callback(this);
    }
  }

  changeState(newState) {
    this.state = newState;
    this.notify();
  }

  init() {
    this.balance = walletProvider.getBalance(this.userId);
    this.checkDailyLimit();
  }

  checkDailyLimit() {
    if (dailyLimitProvider.hasPlayedToday(this.userId, this.gameId)) {
      this.changeState(STATES.BLOCKED_UNTIL_TOMORROW);
    } else {
      this.changeState(STATES.BET_SELECT);
    }
  }

  selectBet(bet) {
    if (this.state !== STATES.BET_SELECT) return;

    const proceed = () => {
      this.currentBet = bet;
      if (!(window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded())) {
        const success = walletProvider.debit(this.userId, bet);
        if (!success) {
          alert("عذراً، رصيدك الحالي غير كافٍ لإتمام الرهان!");
          return;
        }
      }
      this.balance = walletProvider.getBalance(this.userId);
      const data = this.engine.generateSequence(bet);
      this.originalSequence = data.sequence;
      this.shuffledPool = data.pool;
      this.answerTrack = [];
      this.startDisplayPhase();
    };

    if (window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded()) {
      window.IG.AppBridge.placeBet(bet).then(proceed).catch((err) => {
        const msg = err?.message || 'تعذّر تأكيد الدخولية';
        if (window.IntelUI && window.IntelUI.isDailyLimitMessage(msg)) {
          window.IntelUI.showDailyLimitNotice(msg);
        } else {
          alert(msg);
        }
      });
      return;
    }

    proceed();
  }

  startDisplayPhase() {
    this.changeState(STATES.DISPLAY_PHASE);
    this.timerMax = typeof getMemorizeSeconds === 'function' ? getMemorizeSeconds(this.currentBet) : 5;
    this.timer = this.timerMax;
    
    this.startTimer(() => {
      this.startReconstructPhase();
    });
  }

  startReconstructPhase() {
    this.changeState(STATES.RECONSTRUCT_PHASE);
    this.timerMax = typeof getReconstructSeconds === 'function' ? getReconstructSeconds(this.currentBet) : 15;
    this.timer = this.timerMax;
    
    this.startTimer(() => {
      this.resolveGame();
    });
  }

  startTimer(onComplete) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      this.timer--;
      this.notify();
      
      if (this.timer <= 0) {
        clearInterval(this.timerInterval);
        onComplete();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  placeTile(tileId) {
    if (this.state !== STATES.RECONSTRUCT_PHASE) return;
    
    // Find in pool
    const index = this.shuffledPool.findIndex(t => t.uniqueId === tileId);
    if (index === -1) return;
    
    const tile = this.shuffledPool[index];
    
    // Remove from pool, add to answer track
    this.shuffledPool.splice(index, 1);
    this.answerTrack.push(tile);
    
    this.notify();
  }

  removeTile(tileId) {
    if (this.state !== STATES.RECONSTRUCT_PHASE) return;
    
    // Find in answer track
    const index = this.answerTrack.findIndex(t => t.uniqueId === tileId);
    if (index === -1) return;
    
    const tile = this.answerTrack[index];
    
    // Remove from answer track, add back to pool
    this.answerTrack.splice(index, 1);
    this.shuffledPool.push(tile);
    
    this.notify();
  }

  resolveGame() {
    this.stopTimer();

    const isMatch = this.engine.validateAnswer(this.answerTrack);
    this.winResult = isMatch;

    if (isMatch) {
      if (window.IG && window.IG.AppBridge) {
        const reported = window.IG.AppBridge.reportGameResult({
          isWin: true,
          stake: this.currentBet,
          result: { sequenceLength: this.originalSequence.length },
        });
        this.balance = window.IG.AppBridge.getState().balance;
        void reported;
      } else {
        walletProvider.credit(this.userId, this.currentBet * getRewardMultiplier());
        this.balance = walletProvider.getBalance(this.userId);
      }
    } else if (window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded()) {
      window.IG.AppBridge.reportGameResult({
        isWin: false,
        stake: this.currentBet,
        result: { sequenceLength: this.originalSequence.length },
      });
      this.balance = window.IG.AppBridge.getState().balance;
    } else {
      this.balance = walletProvider.getBalance(this.userId);
    }

    dailyLimitProvider.recordPlay(this.userId, this.gameId);
    this.changeState(STATES.RESULT);
  }

  reset() {
    this.stopTimer();
    this.currentBet = 0;
    this.originalSequence = [];
    this.shuffledPool = [];
    this.answerTrack = [];
    this.winResult = null;
    this.checkDailyLimit();
  }
}
