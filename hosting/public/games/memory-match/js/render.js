(() => {
const state = window.state;
const GameState = window.GameState;

// Global custom toast utility
window.showToast = (msg, type = 'error') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  // Clear any existing toasts to avoid spamming
  container.innerHTML = '';
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'error' ? '⚠️' : '🎉';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${msg}</span>`;
  
  container.appendChild(toast);
  
  if (type === 'error' && window.soundSynth) {
    window.soundSynth.playMismatch();
  }
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
};

window.Renderer = class Renderer {
  constructor(engine) {
    this.engine = engine;
    
    this.walletBalanceEl = document.getElementById('wallet-balance');
    this.timerDisplayEl = document.getElementById('timer-display');
    this.blockedView = document.getElementById('blocked-view');
    this.betView = document.getElementById('bet-view');
    this.gameBoard = document.getElementById('game-board');
    this.cooldownIndicator = document.getElementById('cooldown-indicator');
    this.resultView = document.getElementById('result-view');
    this.resultTitle = document.getElementById('result-title');
    this.resultDesc = document.getElementById('result-desc');
    
    // New DOM selectors
    this.timerBarContainer = document.getElementById('timer-bar-container');
    this.timerBar = document.getElementById('timer-bar');
    this.memorizeOverlay = document.getElementById('memorize-countdown-overlay');
    this.shuffleOverlay = document.getElementById('shuffle-scan-overlay');
    this.lockCountdownEl = document.getElementById('lock-countdown');
    
    state.subscribe(this.render.bind(this));
    
    this.injectCoins();
    this.updateWallet();
  }

  injectCoins() {
    if (window.IntelCoins) {
      window.IntelCoins.injectContainers();
      return;
    }
    const coinSvg = window.policyConfig.COIN_ICON_SVG || '🪙';
    const walletCoinEl = document.querySelector('.wallet-coin-container');
    if (walletCoinEl) walletCoinEl.innerHTML = coinSvg;
    document.querySelectorAll('.btn-coin-container').forEach(el => {
      el.innerHTML = coinSvg;
    });
  }

  formatCoinValue(amount) {
    if (window.IntelCoins) return window.IntelCoins.formatAmount(amount, 16);
    return amount.toLocaleString();
  }

  updateWallet() {
    const bal = this.engine.wallet.getBalance(this.engine.userId);
    this.walletBalanceEl.textContent = `${bal.toLocaleString()}`;
  }

  render(newState, oldState, payload) {
    this.updateWallet();
    
    // Hide standard overlays when state changes away, except for game-board visibility and matching specifics
    if (newState !== oldState && newState !== GameState.MATCHING_PHASE && newState !== GameState.SHUFFLE_PHASE && newState !== GameState.MEMORIZE_PHASE) {
      this.blockedView.classList.add('hidden');
      this.betView.classList.add('hidden');
      this.gameBoard.classList.add('hidden');
      this.resultView.classList.add('hidden');
      this.timerDisplayEl.classList.add('hidden');
      this.cooldownIndicator.classList.add('hidden');
      this.timerBarContainer.classList.add('hidden');
      this.memorizeOverlay.classList.add('hidden');
      this.shuffleOverlay.classList.add('hidden');
    }

    switch (newState) {
      case GameState.BLOCKED_UNTIL_TOMORROW:
        this.blockedView.classList.remove('hidden');
        if (payload.countdownStr) {
          this.lockCountdownEl.textContent = payload.countdownStr;
        }
        break;

      case GameState.BET_SELECT:
        this.betView.classList.remove('hidden');
        this.gameBoard.innerHTML = '';
        const customInput = document.getElementById('input-custom-bet');
        if (customInput) customInput.value = ''; // clear custom bet input
        break;

      case GameState.MEMORIZE_PHASE:
        this.betView.classList.add('hidden');
        this.gameBoard.classList.remove('hidden');
        
        // Render initial deck if first tick of memorize
        if (this.gameBoard.children.length === 0 && payload.cards) {
          this.renderBoard(payload.cards);
        }
        
        // Handle Memorize Countdown
        this.memorizeOverlay.classList.remove('hidden');
        const numEl = document.getElementById('countdown-number');
        if (numEl && payload.memorizeTimeRemaining !== undefined) {
          numEl.textContent = payload.memorizeTimeRemaining;
          
          const ringEl = this.memorizeOverlay.querySelector('.countdown-fill');
          if (ringEl) {
            const offset = (payload.memorizeTimeRemaining / 5) * 283;
            ringEl.style.strokeDashoffset = 283 - offset;
          }
        }
        break;

      case GameState.SHUFFLE_PHASE:
        this.memorizeOverlay.classList.add('hidden');
        this.shuffleOverlay.classList.remove('hidden');
        
        this.performShuffleAnimation(payload.duration, payload.oldCards, payload.newCards);
        break;

      case GameState.MATCHING_PHASE:
        this.shuffleOverlay.classList.add('hidden');
        this.timerDisplayEl.classList.remove('hidden');
        this.timerBarContainer.classList.remove('hidden');
        
        if (payload.timeRemaining !== undefined) {
          this.timerDisplayEl.textContent = `${payload.timeRemaining}s`;
          
          const pct = (payload.timeRemaining / 30) * 100;
          this.timerBar.style.width = `${pct}%`;
          if (payload.timeRemaining <= 5) {
            this.timerBar.classList.add('warning');
          } else {
            this.timerBar.classList.remove('warning');
          }
        }
        
        if (payload.cards) {
          this.updateCards(payload.cards);
        }
        
        if (payload.cooldown !== undefined) {
          if (payload.cooldown) {
            this.cooldownIndicator.classList.remove('hidden');
          } else {
            this.cooldownIndicator.classList.add('hidden');
          }
        }
        
        // Haptic shake on mismatch event
        if (payload.mismatchEvent && payload.mismatchIndices) {
          const cardEls = this.gameBoard.querySelectorAll('.card');
          payload.mismatchIndices.forEach(idx => {
            const el = cardEls[idx];
            if (el) {
              el.classList.add('shake');
              setTimeout(() => el.classList.remove('shake'), 450);
            }
          });
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }
        
        // Sparks on match event
        if (payload.matchEvent && payload.matchIndices) {
          const cardEls = this.gameBoard.querySelectorAll('.card');
          payload.matchIndices.forEach(idx => {
            const el = cardEls[idx];
            if (el) {
              const rect = el.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2 + window.scrollX;
              const centerY = rect.top + rect.height / 2 + window.scrollY;
              const cardFront = el.querySelector('.card-front');
              const color = cardFront ? cardFront.style.color : '#ffffff';
              if (window.particleSystem) {
                window.particleSystem.emitSparks(centerX, centerY, color);
              }
            }
          });
          if (navigator.vibrate) navigator.vibrate(50);
        }
        break;

      case GameState.RESULT:
        this.gameBoard.classList.remove('hidden');
        this.updateCards(payload.cards);
        
        this.timerBarContainer.classList.add('hidden');
        
        if (payload.isWin && window.particleSystem) {
          // Double Wave of Confetti
          window.particleSystem.emitVictoryConfetti();
          setTimeout(() => {
            if (state.getState() === GameState.RESULT && window.particleSystem) {
              window.particleSystem.emitVictoryConfetti();
            }
          }, 600);
        }
        
        this.renderStats(payload);
        
        setTimeout(() => {
          this.gameBoard.classList.add('hidden');
          this.timerDisplayEl.classList.add('hidden');
          this.cooldownIndicator.classList.add('hidden');
          
          this.resultView.classList.remove('hidden');
          if (payload.isWin) {
            this.resultTitle.textContent = "🎉 فزت بالتحدي! 🎉";
            this.resultTitle.className = "text-success";
            this.resultDesc.textContent = "تهانينا! لقد تغلبت على التحدي وحصلت على الجائزة كاملة!";
          } else {
            this.resultTitle.textContent = "انتهى الوقت 😢";
            this.resultTitle.className = "text-danger";
            this.resultDesc.textContent = "لم تنجح في إنهاء المطابقة في الوقت المحدد. حاول مرة أخرى غداً!";
          }
        }, 1800);
        break;
    }
  }

  renderStats(payload) {
    const statsPanel = document.getElementById('result-stats');
    if (!statsPanel) return;
    statsPanel.innerHTML = '';
    
    const coinFmt = (n) => this.formatCoinValue(n);
    const currentBal = this.engine.wallet.getBalance(this.engine.userId);
    
    let rows = [];
    const resultCard = this.resultView.querySelector('.result-card');
    
    if (payload.isWin) {
      if (resultCard) resultCard.className = 'result-card success-glow';
      rows = [
        { label: 'الدخولية', value: coinFmt(payload.bet) },
        { label: 'الوقت المتبقي', value: `${payload.timeLeft} ثانية` },
        { label: 'إجمالي الجائزة', value: `<span class="text-success">+${coinFmt(payload.reward)}</span>` },
        { label: 'رصيدك الحالي', value: coinFmt(currentBal) }
      ];
    } else {
      if (resultCard) resultCard.className = 'result-card danger-glow';
      rows = [
        { label: 'الدخولية المفقودة', value: coinFmt(payload.bet) },
        { label: 'الوقت المستغرق', value: `30 ثانية` },
        { label: 'النتيجة', value: `<span class="text-danger">-${coinFmt(payload.bet)}</span>` },
        { label: 'رصيدك المتبقي', value: coinFmt(currentBal) }
      ];
    }
    
    rows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'stat-row';
      rowEl.innerHTML = `
        <span class="stat-label">${row.label}</span>
        <span class="stat-value">${row.value}</span>
      `;
      statsPanel.appendChild(rowEl);
    });
  }

  renderBoard(cards) {
    this.gameBoard.innerHTML = '';
    cards.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.isFlipped ? 'flipped' : ''}`;
      cardEl.dataset.index = index;
      
      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = card.shape.svg;
      front.style.color = card.shape.color;
      front.style.boxShadow = `inset 0 0 20px rgba(0,0,0,0.6), 0 0 15px ${card.shape.color}44`;
      
      const back = document.createElement('div');
      back.className = 'card-face card-back';
      
      cardEl.appendChild(front);
      cardEl.appendChild(back);
      this.gameBoard.appendChild(cardEl);
    });
  }

  updateCards(cards) {
    const cardEls = this.gameBoard.querySelectorAll('.card');
    cards.forEach((card, i) => {
      const el = cardEls[i];
      if (!el) return;
      if (card.isFlipped) {
        el.classList.add('flipped');
      } else {
        el.classList.remove('flipped');
      }
      
      if (card.isMatched) {
        el.classList.add('matched');
      }
    });
  }

  performShuffleAnimation(durationMs, oldCards, newCards) {
    const cardEls = Array.from(this.gameBoard.querySelectorAll('.card'));
    cardEls.forEach(el => el.classList.remove('flipped'));

    setTimeout(() => {
      const rects = cardEls.map(el => el.getBoundingClientRect());
      
      this.gameBoard.innerHTML = '';
      newCards.forEach((nc) => {
        const oldIndex = oldCards.findIndex(oc => oc.id === nc.id);
        const el = cardEls[oldIndex];
        el.dataset.index = newCards.indexOf(nc);
        this.gameBoard.appendChild(el);
      });
      
      const newCardEls = Array.from(this.gameBoard.querySelectorAll('.card'));
      const newRects = newCardEls.map(el => el.getBoundingClientRect());
      
      newCardEls.forEach((el, i) => {
        const oldRectIndex = cardEls.indexOf(el);
        const oldRect = rects[oldRectIndex];
        const newRect = newRects[i];
        
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        
        el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        el.style.transition = 'none';
        
        el.getBoundingClientRect(); // force reflow
        
        el.style.transition = `transform ${durationMs}ms ease-in-out`;
        el.style.transform = 'translate(0, 0)';
      });
      
      setTimeout(() => {
        newCardEls.forEach(el => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }, durationMs);
      
    }, 400); 
  }
}
})();
