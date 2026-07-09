let resetCountdownInterval = null;

// Caches to prevent full layout re-renders during countdown timer ticks
let lastStateStr = null;
let lastAccessibilityVal = null;
let lastBalanceVal = null;
let lastAnswerKey = '';
let lastPoolKey = '';

const getTilesKey = (tiles) => tiles.map(t => t.uniqueId).join(',');

function render(state) {
  const app = document.getElementById('app');
  if (!app) return;

  const currentAccessibility = localStorage.getItem('accessibility_labels') === 'true';

  // Render header/balance bar (updates only dynamic parts inside, or rebuilds if accessibility/balance changed)
  renderHeader(state, currentAccessibility);

  // Clear reset countdown interval if not in BLOCKED_UNTIL_TOMORROW state
  if (state.state !== STATES.BLOCKED_UNTIL_TOMORROW) {
    if (resetCountdownInterval) {
      clearInterval(resetCountdownInterval);
      resetCountdownInterval = null;
    }
    if (window.IntelUI && typeof window.IntelUI.stopResetCountdown === 'function') {
      window.IntelUI.stopResetCountdown();
    }
  }

  // If state transitioned or accessibility toggled, render the structural layout
  if (state.state !== lastStateStr || currentAccessibility !== lastAccessibilityVal) {
    lastStateStr = state.state;
    lastAccessibilityVal = currentAccessibility;
    
    // Reset keys to force list drawing in the new state layout
    lastAnswerKey = '';
    lastPoolKey = '';
    
    renderFullLayout(app, state, currentAccessibility);
  }

  // Perform lightweight updates on dynamic elements (timers, progress bars, interactive tiles lists)
  updateDynamicElements(state, currentAccessibility);
}

function renderHeader(state, isLabelsEnabled) {
  const header = document.getElementById('header-bar');
  if (!header) return;

  // Only update header if balance or accessibility toggled to avoid losing focus/input on switch
  if (state.balance === lastBalanceVal && isLabelsEnabled === (header.dataset.labels === 'true')) {
    return;
  }
  
  lastBalanceVal = state.balance;
  header.dataset.labels = isLabelsEnabled;

  header.innerHTML = `
    <div class="header-container">
      <div class="brand">
        <span class="brand-emoji">🎨</span>
        <div>
          <h1 class="brand-title">${window.IntelI18n ? window.IntelI18n.t('sequenceTitle') : 'تذكر التسلسل'}</h1>
          <p class="brand-subtitle">${window.IntelI18n ? window.IntelI18n.t('sequenceSub') : 'سلسلة ألعاب الذكاء'}</p>
        </div>
      </div>
      <div class="header-controls">
        <label class="accessibility-switch" title="إظهار رموز الألوان لمساعدة عمى الألوان">
          <input type="checkbox" id="accessibility-toggle" ${isLabelsEnabled ? 'checked' : ''}>
          <span class="slider round"></span>
          <span class="switch-label">رموز الألوان (عمى الألوان)</span>
        </label>
        <div class="balance-pill">
          <span class="pill-label">${window.IntelI18n ? window.IntelI18n.t('yourBalance') : 'الرصيد'}:</span>
          <span class="pill-val">${window.IntelCoins ? window.IntelCoins.formatAmount(state.balance, 16) : state.balance.toLocaleString()}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFullLayout(container, state, isLabelsEnabled) {
  switch (state.state) {
    case STATES.CHECK_DAILY_LIMIT:
      container.innerHTML = `
        <div class="screen-container center-content">
          <div class="loader"></div>
          <p class="status-text">جاري التحقق من الحد اليومي...</p>
        </div>
      `;
      break;

    case STATES.BLOCKED_UNTIL_TOMORROW: {
      const initialCountdown = window.IntelUI && typeof window.IntelUI.formatCountdownHMS === 'function'
        ? window.IntelUI.formatCountdownHMS(
            window.IntelUI.getMsUntilNextReset ? window.IntelUI.getMsUntilNextReset() : 0,
          )
        : '--:--:--';
      container.innerHTML = `
        <div class="screen-container center-content">
          ${window.IntelUI ? window.IntelUI.blockedPanelHTML(initialCountdown) : `
          <div class="intel-blocked-panel">
            <div class="intel-blocked-icon">🔒</div>
            <h2 class="intel-blocked-title">تجاوزت الحد اليومي</h2>
            <p class="intel-blocked-msg">لقد لعبت ألعاب الذكاء اليوم — محاولة واحدة فقط لجميع الألعاب.</p>
            <p class="intel-blocked-sub">عد غداً بعد منتصف الليل لتلعب مرة أخرى.</p>
            <div class="intel-blocked-countdown-box">
              <span class="intel-blocked-countdown-label">الوقت المتبقي حتى الجولة القادمة</span>
              <span class="intel-blocked-countdown" id="reset-countdown">${initialCountdown}</span>
            </div>
          </div>`}
        </div>
      `;
      startResetCountdown();
      break;
    }

    case STATES.BET_SELECT: {
      const coinImg = window.IntelCoins ? window.IntelCoins.img(16) : '🪙';
      const chipsHTML = ALLOWED_BETS.map(bet => {
        const length = typeof getSequenceLengthForBet === 'function'
          ? getSequenceLengthForBet(bet)
          : (SEQUENCE_LENGTH_BY_BET[bet] || 8);
        const squaresLabel = window.IntelI18n
          ? window.IntelI18n.t('sequenceSquaresCount', { count: length })
          : length + ' مربعات';
        return `
          <button class="chip-btn" data-bet="${bet}">
            <span class="chip-val">${coinImg} ${bet.toLocaleString()}</span>
            <span class="chip-desc">🧩 ${squaresLabel}</span>
          </button>
        `;
      }).join('');

      container.innerHTML = `
        <div class="screen-container center-content fade-in">
          <h2 class="title text-glow">اختر قيمة رهانك</h2>
          <p class="subtitle">راهن بناءً على قوة ذاكرتك. الرهانات الأعلى تزيد من طول التسلسل وصعوبته!</p>
          
          <div class="chips-container">
            ${chipsHTML}
          </div>
        </div>
      `;
      break;
    }

    case STATES.DISPLAY_PHASE:
      container.innerHTML = `
        <div class="screen-container fade-in">
          <div class="phase-header">
            <h2 class="phase-title text-glow">احفظ التسلسل!</h2>
            <div class="timer-badge timer-warn" id="display-timer">--ث</div>
          </div>
          <p class="subtitle text-center">ركّز جيداً في ترتيب الألوان.</p>
          
          <div class="sequence-view flex-wrap-container">
            ${renderTileSequence(state.originalSequence, isLabelsEnabled)}
          </div>
          
          <div class="progress-bar-container">
            <div class="progress-bar display-progress" id="display-progress-bar" style="width: 100%"></div>
          </div>
        </div>
      `;
      break;

    case STATES.RECONSTRUCT_PHASE:
      const totalSlots = state.originalSequence.length;
      container.innerHTML = `
        <div class="screen-container fade-in">
          <div class="phase-header">
            <h2 class="phase-title text-glow">أعد تركيب التسلسل</h2>
            <div class="timer-badge timer-danger" id="reconstruct-timer">--ث</div>
          </div>
          <p class="subtitle text-center">اضغط على المربعات في الأسفل لترتيبها في مسار الإجابة بالترتيب الصحيح.</p>

          <div class="section-title" id="answer-count-title">إجابتك (0/${totalSlots})</div>
          <div class="answer-track-wrapper">
            <div id="answer-container" class="flex-wrap-container track-container">
              <!-- Will be dynamically populated in updateDynamicElements -->
            </div>
          </div>

          <div class="section-title">مربعات الألوان المتوفرة</div>
          <div id="pool-container" class="flex-wrap-container pool-container">
            <!-- Will be dynamically populated in updateDynamicElements -->
          </div>

          <div class="action-bar">
            <button id="submit-btn" class="btn btn-primary" disabled>
              إرسال الإجابة
            </button>
          </div>
        </div>
      `;
      break;

    case STATES.RESULT: {
      const win = state.winResult;
      const winAmt = window.GamesConfigUtils
        ? window.GamesConfigUtils.calcWinAmount(state.currentBet, getRewardMultiplier())
        : state.currentBet * (1 + getRewardMultiplier());
      const coinWin = window.IntelCoins ? window.IntelCoins.formatAmount(winAmt, 16) : winAmt.toLocaleString();
      const coinBet = window.IntelCoins ? window.IntelCoins.formatAmount(state.currentBet, 16) : state.currentBet.toLocaleString();
      container.innerHTML = `
        <div class="screen-container fade-in">
          <div class="result-header center-content">
            <div class="result-badge ${win ? 'win-badge' : 'lose-badge'}">
              ${win ? '🎉 فوز' : '❌ خسارة'}
            </div>
            <h2 class="title ${win ? 'win-text' : 'lose-text'}">
              ${win ? 'تطابق مثالي!' : 'ترتيب غير صحيح'}
            </h2>
            <p class="subtitle">
              ${win ? `لقد تذكرت التسلسل بنجاح! الجائزة: ${coinWin}` : `خُصمت الدخولية: ${coinBet}`}
            </p>
          </div>

          <div class="result-breakdown">
            <div class="reveal-section">
              <div class="reveal-label">التسلسل الصحيح:</div>
              <div class="flex-wrap-container reveal-sequence">
                ${renderTileSequence(state.originalSequence, isLabelsEnabled)}
              </div>
            </div>

            <div class="reveal-section">
              <div class="reveal-label">تسلسلك الذي ركبته:</div>
              <div class="flex-wrap-container reveal-sequence">
                ${state.answerTrack.length > 0 ? renderTileSequence(state.answerTrack, isLabelsEnabled) : '<div class="empty-reconstruction">لم تقم بوضع أي مربعات</div>'}
              </div>
            </div>
          </div>

          <div class="action-bar center-content">
            <button id="reset-btn" class="btn btn-primary">اللعب مجدداً</button>
          </div>
        </div>
      `;
      break;
    }
  }
}

function updateDynamicElements(state, isLabelsEnabled) {
  if (state.state === STATES.DISPLAY_PHASE) {
    const timerBadge = document.getElementById('display-timer');
    const progressBar = document.getElementById('display-progress-bar');
    
    if (timerBadge) {
      timerBadge.textContent = `${state.timer}ث`;
    }
    if (progressBar) {
      var max = state.timerMax || state.timer || 5;
      progressBar.style.width = `${Math.max(0, (state.timer / max) * 100)}%`;
    }
  } 
  
  else if (state.state === STATES.RECONSTRUCT_PHASE) {
    const timerBadge = document.getElementById('reconstruct-timer');
    const answerContainer = document.getElementById('answer-container');
    const poolContainer = document.getElementById('pool-container');
    const submitBtn = document.getElementById('submit-btn');
    const countTitle = document.getElementById('answer-count-title');
    
    if (timerBadge) {
      timerBadge.textContent = `${state.timer}ث`;
    }

    const currentAnswerKey = getTilesKey(state.answerTrack);
    const currentPoolKey = getTilesKey(state.shuffledPool);
    const totalSlots = state.originalSequence.length;

    if (answerContainer && currentAnswerKey !== lastAnswerKey) {
      lastAnswerKey = currentAnswerKey;
      answerContainer.innerHTML = renderAnswerTrack(state.answerTrack, totalSlots, isLabelsEnabled);
      if (countTitle) {
        countTitle.textContent = `إجابتك (${state.answerTrack.length}/${totalSlots})`;
      }
    }

    if (poolContainer && currentPoolKey !== lastPoolKey) {
      lastPoolKey = currentPoolKey;
      poolContainer.innerHTML = renderTilePool(state.shuffledPool, isLabelsEnabled);
    }

    if (submitBtn) {
      submitBtn.disabled = state.answerTrack.length === 0;
    }
  }
}

function renderTileSequence(tiles, isLabelsEnabled) {
  return tiles.map(tile => `
    <div class="tile-card static-tile" style="background-color: ${tile.hex};" aria-label="${tile.name}">
      ${isLabelsEnabled ? `<span class="tile-label">${tile.label}</span>` : ''}
    </div>
  `).join('');
}

function renderAnswerTrack(tiles, totalSlots, isLabelsEnabled) {
  const elements = [];
  
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    elements.push(`
      <div class="tile-card draggable-tile animate-pop" style="background-color: ${tile.hex};" data-id="${tile.uniqueId}" aria-label="${tile.name}">
        ${isLabelsEnabled ? `<span class="tile-label">${tile.label}</span>` : ''}
      </div>
    `);
  }
  
  for (let i = tiles.length; i < totalSlots; i++) {
    elements.push(`
      <div class="tile-card empty-slot">
        <span class="slot-number">${i + 1}</span>
      </div>
    `);
  }

  return elements.join('');
}

function renderTilePool(tiles, isLabelsEnabled) {
  return tiles.map(tile => `
    <button class="tile-card pool-tile interactive-tile animate-pop" style="background-color: ${tile.hex};" data-id="${tile.uniqueId}" aria-label="${tile.name}">
      ${isLabelsEnabled ? `<span class="tile-label">${tile.label}</span>` : ''}
    </button>
  `).join('');
}

function startResetCountdown() {
  if (window.IntelUI && typeof window.IntelUI.startResetCountdown === 'function') {
    window.IntelUI.startResetCountdown({ elementId: 'reset-countdown' });
    return;
  }

  const display = document.getElementById('reset-countdown');
  if (!display) return;

  function resolveMs() {
    if (dailyLimitProvider && typeof dailyLimitProvider.getMsUntilNextReset === 'function') {
      return dailyLimitProvider.getMsUntilNextReset();
    }
    return 0;
  }

  function update() {
    const ms = resolveMs();
    if (ms <= 0) {
      clearInterval(resetCountdownInterval);
      resetCountdownInterval = null;
      window.location.reload();
      return;
    }

    const totalSecs = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSecs % 60).padStart(2, '0');

    display.textContent = `${hours}:${minutes}:${seconds}`;
  }

  if (resetCountdownInterval) {
    clearInterval(resetCountdownInterval);
  }
  update();
  resetCountdownInterval = setInterval(update, 1000);
}
