window.MatchEngine = class MatchEngine {
  constructor(walletProvider, dailyLimitProvider, userId) {
    this.wallet = walletProvider;
    this.dailyLimit = dailyLimitProvider;
    this.userId = userId;
    this.gameId = 'memory-match';
    
    this.currentBet = 0;
    this.cards = [];
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.isLocked = false;
    
    this.timeRemaining = 30;
    this.timerInterval = null;
    this.memorizeTimeout = null;
    this.lockInterval = null;
    
    window.state.subscribe(this.onStateChange.bind(this));
  }

  onStateChange(newState, oldState, payload) {
    if (newState === window.GameState.BET_SELECT && oldState !== window.GameState.INIT) {
      this.resetGame();
    }
  }

  checkDailyLimit() {
    if (this.dailyLimit.hasPlayedToday(this.userId, this.gameId)) {
      window.state.setState(window.GameState.BLOCKED_UNTIL_TOMORROW);
      this.startLockCountdown();
    } else {
      this.stopLockCountdown();
      window.state.setState(window.GameState.BET_SELECT);
    }
  }

  startLockCountdown() {
    if (this.lockInterval) clearInterval(this.lockInterval);
    
    const updateClock = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(window.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL || 0, 0, 0, 0);
      
      const diff = tomorrow - now;
      if (diff <= 0) {
        this.stopLockCountdown();
        this.checkDailyLimit();
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      window.state.setState(window.GameState.BLOCKED_UNTIL_TOMORROW, { countdownStr: timeStr });
    };
    
    updateClock();
    this.lockInterval = setInterval(updateClock, 1000);
  }

  stopLockCountdown() {
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
    }
  }

  // Dynamic shuffle duration based on the bet size (linear interpolation)
  getShuffleDuration(bet) {
    const minBet = window.policyConfig.MIN_BET || 5000;
    const maxBet = 50000;
    const slowDuration = 4000; // 4 seconds
    const fastDuration = 600;  // 0.6 seconds
    
    if (bet <= minBet) return slowDuration;
    if (bet >= maxBet) return fastDuration;
    
    const pct = (bet - minBet) / (maxBet - minBet);
    return Math.round(slowDuration - pct * (slowDuration - fastDuration));
  }

  selectBet(amount) {
    const minBet = window.policyConfig.MIN_BET || 5000;
    const allowed = window.policyConfig.ALLOWED_BETS || [5000, 10000, 25000, 50000];
    if (isNaN(amount) || amount < minBet) {
      const msg = `الحد الأدنى للرهان هو ${minBet.toLocaleString()}`;
      if (window.showToast) window.showToast(msg, 'error');
      else alert(msg);
      return;
    }
    if (window.IG?.AppBridge?.isEmbedded() && !window.IG.AppBridge.isAllowedStake(amount)) {
      const msg = window.IntelI18n ? window.IntelI18n.t('chooseBet') : 'اختر إحدى فئات الدخولية المعتمدة';
      if (window.showToast) window.showToast(msg, 'error');
      else alert(msg);
      return;
    }
    if (!allowed.includes(amount) && window.IG?.AppBridge?.isEmbedded()) {
      const msg = window.IntelI18n ? window.IntelI18n.t('chooseBet') : 'اختر إحدى فئات الدخولية المعتمدة';
      if (window.showToast) window.showToast(msg, 'error');
      else alert(msg);
      return;
    }

    if (this.wallet.getBalance(this.userId) < amount) {
      const msg = window.IntelI18n ? window.IntelI18n.t('insufficientBalance') : 'رصيدك غير كافٍ لهذا الرهان!';
      if (window.showToast) window.showToast(msg, 'error');
      else alert(msg);
      return;
    }

    const start = () => {
      if (window.soundSynth) window.soundSynth.playClick();
      this.currentBet = amount;
      if (!(window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded())) {
        this.wallet.debit(this.userId, amount);
      } else {
        this.wallet.getBalance(this.userId);
      }
      this.startGame();
    };

    if (window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded()) {
      window.IG.AppBridge.placeBet(amount).then(start).catch((err) => {
        const msg = err?.message || 'تعذّر تأكيد الدخولية';
        if (window.IntelUI && window.IntelUI.isDailyLimitMessage(msg)) {
          window.IntelUI.showDailyLimitNotice(msg);
        } else if (window.showToast) {
          window.showToast(msg, 'error');
        } else {
          alert(msg);
        }
      });
      return;
    }

    start();
  }

  startGame() {
    this.generateDeck();
    
    let memorizeTimeRemaining = 5;
    const triggerMemorizeTick = () => {
      window.state.setState(window.GameState.MEMORIZE_PHASE, { 
        cards: this.cards, 
        memorizeTimeRemaining 
      });
      
      if (memorizeTimeRemaining <= 0) {
        this.startShufflePhase();
      } else {
        if (window.soundSynth) window.soundSynth.playTick();
        memorizeTimeRemaining--;
        this.memorizeTimeout = setTimeout(triggerMemorizeTick, 1000);
      }
    };
    
    triggerMemorizeTick();
  }

  generateDeck() {
    this.cards = [];
    for (let i = 0; i < 7; i++) {
      const shape = window.shapesData[i];
      this.cards.push({ id: `card-${i}-A`, shape, isMatched: false, isFlipped: true, justMatched: false });
      this.cards.push({ id: `card-${i}-B`, shape, isMatched: false, isFlipped: true, justMatched: false });
    }
  }

  startShufflePhase() {
    const shuffleDuration = this.getShuffleDuration(this.currentBet);
    
    this.cards.forEach(c => c.isFlipped = false);
    
    const oldCards = [...this.cards];
    const shuffled = [...this.cards].sort(() => Math.random() - 0.5);
    this.cards = shuffled;
    
    if (window.soundSynth) window.soundSynth.playShuffle();
    
    window.state.setState(window.GameState.SHUFFLE_PHASE, { 
      duration: shuffleDuration, 
      oldCards, 
      newCards: this.cards 
    });
    
    setTimeout(() => {
      this.startMatchingPhase();
    }, shuffleDuration + 400);
  }

  startMatchingPhase() {
    this.timeRemaining = 30;
    this.isLocked = false;
    this.flippedIndices = [];
    this.matchedPairs = 0;
    
    window.state.setState(window.GameState.MATCHING_PHASE, { timeRemaining: this.timeRemaining, cards: this.cards });
    
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      window.state.setState(window.GameState.MATCHING_PHASE, { timeRemaining: this.timeRemaining });
      
      if (this.timeRemaining <= 5 && this.timeRemaining > 0) {
        if (window.soundSynth) window.soundSynth.playTick();
      }
      
      if (this.timeRemaining <= 0) {
        this.resolveGame(false);
      }
    }, 1000);
  }

  flipCard(index) {
    if (window.state.getState() !== window.GameState.MATCHING_PHASE) return;
    if (this.isLocked) return;
    if (this.cards[index].isMatched || this.cards[index].isFlipped) return;

    if (window.soundSynth) window.soundSynth.playFlip();

    this.cards.forEach(c => c.justMatched = false);

    this.cards[index].isFlipped = true;
    this.flippedIndices.push(index);
    
    window.state.setState(window.GameState.MATCHING_PHASE, { 
      timeRemaining: this.timeRemaining, 
      cards: this.cards 
    });

    if (this.flippedIndices.length === 2) {
      const [idx1, idx2] = this.flippedIndices;
      if (this.cards[idx1].shape.id === this.cards[idx2].shape.id) {
        // INSTANT MATCH
        this.cards[idx1].isMatched = true;
        this.cards[idx2].isMatched = true;
        this.cards[idx1].justMatched = true;
        this.cards[idx2].justMatched = true;
        this.matchedPairs++;
        this.flippedIndices = [];
        
        if (window.soundSynth) window.soundSynth.playMatch();

        window.state.setState(window.GameState.MATCHING_PHASE, { 
          timeRemaining: this.timeRemaining, 
          cards: this.cards,
          matchEvent: true,
          matchIndices: [idx1, idx2]
        });

        if (this.matchedPairs === 7) {
          setTimeout(() => this.resolveGame(true), 500);
        }
      } else {
        // MISMATCH PENALTY
        this.isLocked = true;
        
        if (window.soundSynth) window.soundSynth.playMismatch();

        window.state.setState(window.GameState.MATCHING_PHASE, { 
          timeRemaining: this.timeRemaining, 
          cooldown: true,
          cards: this.cards,
          mismatchEvent: true,
          mismatchIndices: [idx1, idx2]
        });

        setTimeout(() => {
          if (window.state.getState() !== window.GameState.MATCHING_PHASE) return;

          if (this.cards[idx1]) this.cards[idx1].isFlipped = false;
          if (this.cards[idx2]) this.cards[idx2].isFlipped = false;
          this.flippedIndices = [];
          this.isLocked = false;
          
          window.state.setState(window.GameState.MATCHING_PHASE, { 
            timeRemaining: this.timeRemaining, 
            cooldown: false,
            cards: this.cards 
          });
        }, 1000);
      }
    }
  }

  resolveGame(isWin) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.dailyLimit.recordPlay(this.userId, this.gameId);

    let reward = 0;
    if (isWin) {
      if (window.IG && window.IG.AppBridge) {
        const reported = window.IG.AppBridge.reportGameResult({
          isWin: true,
          stake: this.currentBet,
          result: { pairs: this.matchedPairs, timeLeft: this.timeRemaining },
        });
        reward = reported.netProfit;
        if (window.soundSynth) window.soundSynth.playVictory();
      } else {
        reward = this.currentBet * window.policyConfig.REWARD_MULTIPLIER;
        this.wallet.credit(this.userId, reward);
        if (window.soundSynth) window.soundSynth.playVictory();
      }
    } else {
      if (window.IG && window.IG.AppBridge && window.IG.AppBridge.isEmbedded()) {
        window.IG.AppBridge.reportGameResult({
          isWin: false,
          stake: this.currentBet,
          result: { pairs: this.matchedPairs, timeLeft: this.timeRemaining },
        });
      }
      this.cards.forEach(c => c.isFlipped = true);
      if (window.soundSynth) window.soundSynth.playDefeat();
    }

    window.state.setState(window.GameState.RESULT, {
      isWin,
      reward,
      bet: this.currentBet,
      cards: this.cards,
      timeLeft: this.timeRemaining,
    });
  }

  resetGame() {
    this.currentBet = 0;
    this.cards = [];
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.isLocked = false;
    this.timeRemaining = 30;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.memorizeTimeout) {
      clearTimeout(this.memorizeTimeout);
      this.memorizeTimeout = null;
    }
    this.stopLockCountdown();
  }
}
