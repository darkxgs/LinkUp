/* ============================================================
   Linkup — Hilo UI Controller
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- elements ---------- */
  const el = {
    balance: $("balance"),
    resetBalance: $("resetBalance"),
    langToggle: $("langToggle"),
    betAmount: $("betAmount"),
    betFiat: $("betFiat"),
    playButton: $("playButton"),
    skipButton: $("skipButton"),
    deckSkipButton: $("deckSkipButton"),
    guessHigherBtn: $("guessHigherBtn"),
    guessLowerBtn: $("guessLowerBtn"),
    higherPercent: $("higherPercent"),
    lowerPercent: $("lowerPercent"),
    totalProfit: $("totalProfit"),
    totalProfitLabel: $("totalProfitLabel"),
    profitFiat: $("profitFiat"),
    halfBet: $("halfBet"),
    doubleBet: $("doubleBet"),
    cardFront: $("cardFront"),
    activeCard: $("activeCard"),
    gameResultPopup: $("gameResultPopup"),
    popupMultiplier: $("popupMultiplier"),
    popupPayout: $("popupPayout"),
    profitHigherMul: $("profitHigherMul"),
    profitLowerMul: $("profitLowerMul"),
    profitHigherVal: $("profitHigherVal"),
    profitLowerVal: $("profitLowerVal"),
    historyStrip: $("historyStrip"),
    liveStats: $("liveStats"),
    lsProfit: $("lsProfit"),
    lsWins: $("lsWins"),
    lsLosses: $("lsLosses"),
    lsWagered: $("lsWagered"),
    statsToggle: $("statsToggle"),
    statsClose: $("statsClose"),
    soundToggle: $("soundToggle"),
    fairnessToggle: $("fairnessToggle"),
    fairnessModal: $("fairnessModal"),
    closeFairnessModal: $("closeFairnessModal")
  };

  /* ---------- SVGs for card suits ---------- */
  const SUIT_SVGS = {
    S: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.923 13.972-3.28 6.55c-.33.66.15 1.45.89 1.45h4.76c.74 0 1.23-.78.89-1.45l-3.28-6.55z" clip-rule="evenodd"></path><path d="M3.923 16.922c2.02 1.61 5.02 1.32 6.87-.47l1.21-1.16 1.21 1.16c1.85 1.78 4.86 2.07 6.87.47 2.31-1.84 2.44-5.16.36-7.15l-7.74-7.46c-.39-.38-1.02-.38-1.41 0l-7.74 7.46c-2.07 2-1.95 5.31.36 7.15z"></path></svg>`,
    C: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M17.01 8.492c-.09 0-.17.02-.26.03.42-1.31.48-2.78-.95-4.56-.89-1.11-2.17-1.91-3.59-1.96a5.004 5.004 0 0 0-5.2 5c0 .54.11 1.04.26 1.53-.09 0-.17-.03-.26-.03a5.01 5.01 0 0 0-4.89 6.08c.41 1.96 2.04 3.52 4.02 3.85 1.68.28 3.23-.28 4.32-1.33l-1.73 3.45c-.33.66.15 1.45.89 1.45h4.76c.74 0 1.23-.78.89-1.45l-1.73-3.45a5.01 5.01 0 0 0 4.32 1.33c1.98-.33 3.61-1.89 4.02-3.85.67-3.23-1.78-6.08-4.89-6.08z" clip-rule="evenodd"></path></svg>`,
    H: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`,
    D: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12l10 10 10-10L12 2z"></path></svg>`
  };

  /* ---------- state variables ---------- */
  let activeRound = null;
  let currentCard = null; // { rank, suit }
  let transitioning = false;
  const session = { profit: 0, wins: 0, losses: 0, wagered: 0 };

  /* ---------- formatting helpers ---------- */
  const useCoinsUI = () => window.CasinoCoins && CasinoCoins.isEmbedded();
  const fmt8 = (n) => (useCoinsUI() && window.CasinoCoins ? CasinoCoins.fmtAmount(n) : Number(n).toFixed(8));
  const fmt2 = (n) => (useCoinsUI() && window.CasinoCoins ? CasinoCoins.fmt(n) : Number(n).toFixed(2));
  const fmtInput = (n) => (useCoinsUI() && window.CasinoCoins ? CasinoCoins.fmtInput(n) : Number(n).toFixed(8));
  const fiat = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const renderCoinBalance = (node, bal) => {
    if (useCoinsUI()) node.innerHTML = CasinoCoins.formatAmount(bal, 20);
    else node.textContent = Number(bal).toFixed(8);
  };

  function applyCoinModeUI() {
    if (!useCoinsUI()) return;
    if (el.betAmount) {
      el.betAmount.step = "1";
      el.betAmount.value = fmtInput(getBet());
    }
    if (el.profitHigherVal) el.profitHigherVal.value = fmtInput(el.profitHigherVal.value);
    if (el.profitLowerVal) el.profitLowerVal.value = fmtInput(el.profitLowerVal.value);
    if (el.totalProfit) el.totalProfit.value = fmtInput(el.totalProfit.value);
    if (window.CasinoCoins) CasinoCoins.applyEmbedCoinUI();
  }

  /* ---------- update UI layout based on card ---------- */
  function setCardFrontDOM(card) {
    const isRed = card.suit === "H" || card.suit === "D";
    el.cardFront.className = `card-face card-front ${isRed ? "suit-red" : "suit-black"}`;
    
    const rankLabel = Hilo.getRankLabel(card.rank);
    const suitSVG = SUIT_SVGS[card.suit];

    el.cardFront.innerHTML = `
      <div class="card-top-left">
        <span class="rank-val">${rankLabel}</span>
        <span class="suit-icon" style="width:18px;height:18px;">${suitSVG}</span>
      </div>
      <div class="card-center-suit">
        <span class="suit-icon-lg" style="width:48px;height:48px;">${suitSVG}</span>
      </div>
    `;
  }

  /**
   * Performs a 3D flip card animation.
   * If instant is true, skips animation.
   */
  function animateCardReveal(card, instant = false) {
    return new Promise((resolve) => {
      if (instant) {
        setCardFrontDOM(card);
        el.activeCard.classList.remove("face-down");
        resolve();
        return;
      }
      
      Sound.flip();
      el.activeCard.classList.add("face-down");

      setTimeout(() => {
        setCardFrontDOM(card);
        el.activeCard.classList.remove("face-down");
        setTimeout(resolve, 200);
      }, 200);
    });
  }

  /* ---------- balance and history updates ---------- */
  async function refreshBalance() {
    const bal = await HiloAPI.getBalance();
    renderCoinBalance(el.balance, bal);
    if (useCoinsUI() && window.CasinoCoins) CasinoCoins.applyEmbedCoinUI();
  }

  function getBet() {
    const v = parseFloat(el.betAmount.value);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  function updateBetFiat() {
    if (!useCoinsUI()) el.betFiat.textContent = fiat(getBet());
    updatePayoutForecasts();
  }

  function updateStats() {
    el.lsProfit.textContent = fmt8(session.profit);
    el.lsProfit.className = "ls-val " + (session.profit > 0 ? "pos" : session.profit < 0 ? "neg" : "");
    el.lsWins.textContent = session.wins;
    el.lsLosses.textContent = session.losses;
    el.lsWagered.textContent = fmt8(session.wagered);
  }

  /* ---------- render current history strip ---------- */
  function renderHistoryStrip(cards) {
    el.historyStrip.innerHTML = "";
    if (!cards || cards.length === 0) return;

    cards.forEach((item, index) => {
      // Create card
      const itemWrap = document.createElement("div");
      itemWrap.className = "history-card-item";

      const cardDiv = document.createElement("div");
      const isRed = item.suit === "H" || item.suit === "D";
      cardDiv.className = `history-mini-card ${isRed ? "suit-red" : "suit-black"}`;
      cardDiv.innerHTML = `
        <span style="font-size:0.8rem;line-height:1;">${Hilo.getRankLabel(item.rank)}</span>
        ${SUIT_SVGS[item.suit]}
      `;

      // Create multiplier/label badge
      const badge = document.createElement("span");
      if (item.label) {
        badge.className = "history-multiplier-badge win";
        badge.setAttribute("data-i18n", "start_card");
        badge.textContent = I18N.t("start_card");
      } else {
        const isWin = item.won;
        badge.className = `history-multiplier-badge ${isWin ? "win" : "lost"}`;
        badge.textContent = isWin ? fmt2(item.multiplier) + "x" : "0.00x";
      }

      itemWrap.appendChild(cardDiv);
      itemWrap.appendChild(badge);

      // Add connecting guess arrows between cards
      if (index > 0) {
        const arrow = document.createElement("div");
        const guessHigher = item.guess === "higher";
        arrow.className = `history-arrow-item ${item.won ? "win" : "lost"}`;
        arrow.innerHTML = guessHigher ? "▲" : "▼";
        el.historyStrip.appendChild(arrow);
      }

      el.historyStrip.appendChild(itemWrap);
    });

    // Auto scroll to the end
    el.historyStrip.scrollLeft = el.historyStrip.scrollWidth;
  }

  /* ---------- payout estimators ---------- */
  function updatePayoutForecasts() {
    if (!currentCard) return;

    const rank = currentCard.rank;
    const bet = getBet();

    // 1. Guess probabilities
    const higherChance = Hilo.getHigherProbability(rank);
    const lowerChance = Hilo.getLowerProbability(rank);
    el.higherPercent.textContent = fmt2(higherChance) + "%";
    el.lowerPercent.textContent = fmt2(lowerChance) + "%";

    // 2. Button multipliers
    const higherMul = Hilo.getHigherMultiplier(rank);
    const lowerMul = Hilo.getLowerMultiplier(rank);

    // 3. Potential profits
    const currentPayout = activeRound ? activeRound.amount * activeRound.cumulativeMultiplier : bet;

    const profitHigher = currentPayout * (higherMul - 1);
    const profitLower = currentPayout * (lowerMul - 1);

    el.profitHigherMul.textContent = fmt2(higherMul) + "x";
    el.profitLowerMul.textContent = fmt2(lowerMul) + "x";

    el.profitHigherVal.value = fmt8(Math.max(0, profitHigher));
    el.profitLowerVal.value = fmt8(Math.max(0, profitLower));

    // 4. Cumulative displays
    if (activeRound) {
      const currentProfit = currentPayout - activeRound.amount;
      el.totalProfit.value = fmt8(currentProfit);
      el.totalProfitLabel.innerHTML = `<span data-i18n="total_profit">${I18N.t("total_profit")}</span> (${fmt2(activeRound.cumulativeMultiplier)}x)`;
      el.profitFiat.textContent = useCoinsUI() ? '' : fiat(currentProfit);
    } else {
      el.totalProfit.value = fmt8(0);
      el.totalProfitLabel.innerHTML = `<span data-i18n="total_profit">${I18N.t("total_profit")}</span> (1.00x)`;
      el.profitFiat.textContent = useCoinsUI() ? '' : fiat(0);
    }
  }

  /* ---------- game loop write actions ---------- */
  async function handleBetOrCashout() {
    if (transitioning) return;

    if (!activeRound) {
      // Start Round
      const amount = getBet();
      if (!(amount > 0)) {
        flashError(I18N.t("err_set_bet"));
        return;
      }

      transitioning = true;
      el.playButton.disabled = true;

      try {
        const res = await HiloAPI.startRound({ amount, startCard: currentCard });
        activeRound = res.activeRound;
        await refreshBalance();

        // Lock inputs, turn Bet into Cashout
        el.betAmount.disabled = true;
        el.halfBet.disabled = true;
        el.doubleBet.disabled = true;
        el.skipButton.disabled = true; // disable panel skip during active bet, use deck skip button
        el.deckSkipButton.disabled = false;

        el.playButton.textContent = I18N.t("cashout");
        el.playButton.className = "bet-btn"; // keep blue or add class

        // Enable guess buttons
        el.guessHigherBtn.disabled = false;
        el.guessLowerBtn.disabled = false;

        // Render initial history
        renderHistoryStrip(activeRound.historyCards);

        // Keep game result popup hidden during the active round
        hideGameResultPopup();

        // Track stats
        session.wagered += amount;
        updateStats();
      } catch (err) {
        const key = ERR_CODE_TO_KEY[err.code];
        flashError(key ? I18N.t(key) : err.message);
      } finally {
        transitioning = false;
        el.playButton.disabled = false;
        updatePayoutForecasts();
      }
    } else {
      // Cashout
      transitioning = true;
      el.playButton.disabled = true;

      try {
        const prevAmount = activeRound.amount;
        const prevMultiplier = activeRound.cumulativeMultiplier;
        const profit = prevAmount * prevMultiplier - prevAmount;

        const res = await HiloAPI.cashout();
        activeRound = null;
        Sound.cashout();

        // Show the game result win popover modal (the multi box)
        updateGameResultPopup(prevMultiplier, prevAmount * prevMultiplier, true);
        el.gameResultPopup.classList.remove("hidden");
        el.gameResultPopup.offsetHeight; // trigger reflow
        el.gameResultPopup.classList.add("show");

        // Celebratory flash
        el.balance.style.color = "var(--positive-strong)";
        setTimeout(() => el.balance.style.color = "", 1500);

        await refreshBalance();

        // Track stats
        session.profit += profit;
        session.wins++;
        updateStats();

        // Reset UI inputs
        resetUI();
      } catch (err) {
        flashError(err.message);
      } finally {
        transitioning = false;
        el.playButton.disabled = false;
        updatePayoutForecasts();
      }
    }
  }

  async function handleGuess(guess) {
    if (transitioning || !activeRound) return;

    transitioning = true;
    el.guessHigherBtn.disabled = true;
    el.guessLowerBtn.disabled = true;
    el.playButton.disabled = true;
    el.deckSkipButton.disabled = true;

    // Draw the card
    const nextCard = Hilo.drawCard();

    try {
      const res = await HiloAPI.makeGuess({ guess, nextCard });
      
      // Animate 3D flip card reveal
      await animateCardReveal(nextCard);
      currentCard = nextCard;

      if (res.won) {
        activeRound = res.activeRound;
        Sound.win(activeRound.historyCards.length - 1);

        // Keep result popup hidden during guesses
        hideGameResultPopup();

        // Update history
        renderHistoryStrip(activeRound.historyCards);

        // Re-enable guess controls
        el.guessHigherBtn.disabled = false;
        el.guessLowerBtn.disabled = false;
        el.playButton.disabled = false;
        el.deckSkipButton.disabled = false;
      } else {
        // Lost!
        Sound.lose();
        
        // Keep result popup hidden on loss
        hideGameResultPopup();

        // Update history (will render the lost guess card at the end)
        renderHistoryStrip(res.record.historyCards);

        // Session loss stats
        session.profit -= activeRound.amount;
        session.losses++;
        updateStats();

        activeRound = null;
        await refreshBalance();

        // Lock board, reset after a brief delay
        setTimeout(() => {
          resetUI();
          // Draw a fresh starting card
          drawNewStartCard();
        }, 1500);
      }
    } catch (err) {
      flashError(err.message);
      el.guessHigherBtn.disabled = false;
      el.guessLowerBtn.disabled = false;
      el.playButton.disabled = false;
      el.deckSkipButton.disabled = false;
    } finally {
      if (activeRound) {
        transitioning = false;
        updatePayoutForecasts();
      }
    }
  }

  async function handleSkip() {
    if (transitioning) return;
    transitioning = true;
    el.skipButton.disabled = true;
    el.deckSkipButton.disabled = true;

    const newCard = Hilo.drawCard();
    await animateCardReveal(newCard);
    currentCard = newCard;

    await HiloAPI.skipCard(newCard);

    if (activeRound) {
      // If active, update the active history list
      activeRound.currentCard = newCard;
      const lastIdx = activeRound.historyCards.length - 1;
      activeRound.historyCards[lastIdx].rank = newCard.rank;
      activeRound.historyCards[lastIdx].suit = newCard.suit;
      renderHistoryStrip(activeRound.historyCards);
    } else {
      // Hide result popup when skipping in idle state
      hideGameResultPopup();
    }

    transitioning = false;
    el.skipButton.disabled = activeRound !== null;
    el.deckSkipButton.disabled = activeRound === null;
    updatePayoutForecasts();
  }

  function updateGameResultPopup(multiplier, payout, won = true) {
    el.popupMultiplier.textContent = fmt2(multiplier);
    el.popupPayout.textContent = fmt8(payout);
    el.gameResultPopup.className = `game-result-wrap ${won ? "win" : "lost"}`;
  }

  function hideGameResultPopup() {
    el.gameResultPopup.classList.remove("show");
    el.gameResultPopup.classList.add("hidden");
  }

  function resetUI() {
    el.betAmount.disabled = false;
    el.halfBet.disabled = false;
    el.doubleBet.disabled = false;
    el.skipButton.disabled = false;
    el.deckSkipButton.disabled = true;

    el.playButton.textContent = I18N.t("bet");
    el.playButton.className = "bet-btn";
    el.playButton.disabled = false; // FIX: unlock play button on reset!

    // Disable guess actions
    el.guessHigherBtn.disabled = true;
    el.guessLowerBtn.disabled = true;

    // Note: We do NOT hide activeMultiplierBadge here so that the cashout summary badge persists on screen 
    // until a new bet is started or a card is skipped.

    transitioning = false;
  }

  async function drawNewStartCard() {
    const card = Hilo.drawCard();
    await animateCardReveal(card, true);
    currentCard = card;
    updatePayoutForecasts();
  }

  /* ---------- mapping error codes ---------- */
  const ERR_CODE_TO_KEY = {
    INVALID_AMOUNT: "err_invalid_amount",
    INSUFFICIENT_BALANCE: "err_insufficient"
  };

  function flashError(msg) {
    el.betFiat.textContent = msg;
    el.betFiat.style.color = "var(--negative)";
    setTimeout(() => {
      el.betFiat.style.color = "";
      updateBetFiat();
    }, 1600);
  }

  /* ---------- bind UI events ---------- */
  function bind() {
    // Bet inputs
    el.betAmount.addEventListener("input", updateBetFiat);
    el.betAmount.addEventListener("blur", () => {
      el.betAmount.value = fmtInput(getBet());
    });

    el.halfBet.addEventListener("click", () => {
      el.betAmount.value = fmtInput(getBet() / 2);
      updateBetFiat();
      Sound.click();
    });
    el.doubleBet.addEventListener("click", () => {
      el.betAmount.value = fmtInput(getBet() * 2);
      updateBetFiat();
      Sound.click();
    });

    // Play action (Bet / Cashout)
    el.playButton.addEventListener("click", handleBetOrCashout);

    // Skip actions
    el.skipButton.addEventListener("click", handleSkip);
    el.deckSkipButton.addEventListener("click", handleSkip);

    // Guess actions
    el.guessHigherBtn.addEventListener("click", () => handleGuess("higher"));
    el.guessLowerBtn.addEventListener("click", () => handleGuess("lower"));

    // Reset balance
    el.resetBalance.addEventListener("click", async () => {
      await HiloAPI.resetBalance();
      session.profit = session.wins = session.losses = session.wagered = 0;
      updateStats();
      await refreshBalance();
      
      activeRound = null;
      hideGameResultPopup();
      drawNewStartCard();
      el.historyStrip.innerHTML = "";
    });

    // Stats panel
    el.statsToggle.addEventListener("click", () => el.liveStats.classList.toggle("hidden"));
    el.statsClose.addEventListener("click", () => el.liveStats.classList.add("hidden"));

    // Sound toggle
    Sound.setMuted(localStorage.getItem("linkup_muted") === "1");
    const renderSoundIcon = () => { el.soundToggle.textContent = Sound.muted ? "🔇" : "🔊"; };
    renderSoundIcon();
    el.soundToggle.addEventListener("click", () => {
      const m = Sound.toggle();
      localStorage.setItem("linkup_muted", m ? "1" : "0");
      renderSoundIcon();
      if (!m) Sound.click();
    });

    // Arabic/English language toggle
    el.langToggle.addEventListener("click", () => {
      I18N.set(I18N.lang === "en" ? "ar" : "en");
      el.langToggle.textContent = I18N.t("switch_lang");
      updatePayoutForecasts();
      Sound.click();
    });

    // Fairness modal
    el.fairnessToggle.addEventListener("click", () => {
      el.fairnessModal.classList.remove("hidden");
      Sound.click();
    });
    el.closeFairnessModal.addEventListener("click", () => {
      el.fairnessModal.classList.add("hidden");
      Sound.click();
    });
    el.fairnessModal.addEventListener("click", (e) => {
      if (e.target === el.fairnessModal) {
        el.fairnessModal.classList.add("hidden");
        Sound.click();
      }
    });

    // Enter key in bet amount = Bet / Cashout
    el.betAmount.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleBetOrCashout();
    });

    // Space key outside input/buttons = Bet / Cashout
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "button" || tag === "textarea") return;
      e.preventDefault();
      handleBetOrCashout();
    });
  }

  /* ---------- initialize state and active round restore ---------- */
  async function init() {
    bind();
    I18N.init();
    el.langToggle.textContent = I18N.t("switch_lang");

    await refreshBalance();
    updateStats();

    // Check if there's an active round to restore
    const savedRound = await HiloAPI.getActiveRound();
    if (savedRound) {
      activeRound = savedRound;
      currentCard = activeRound.currentCard;

      // Set active card in DOM (no animation)
      await animateCardReveal(currentCard, true);

      // Lock input, set to Cashout state
      el.betAmount.disabled = true;
      el.halfBet.disabled = true;
      el.doubleBet.disabled = true;
      el.skipButton.disabled = true;
      el.deckSkipButton.disabled = false;

      el.playButton.textContent = I18N.t("cashout");
      el.playButton.className = "bet-btn";

      // Enable guess actions
      el.guessHigherBtn.disabled = false;
      el.guessLowerBtn.disabled = false;

      // Keep popup hidden during active game
      hideGameResultPopup();

      // Render restored history
      renderHistoryStrip(activeRound.historyCards);
    } else {
      // Clean start: draw a starting card
      el.deckSkipButton.disabled = true;
      drawNewStartCard();
    }

    updatePayoutForecasts();
    updateBetFiat();
    applyCoinModeUI();
    if (window.CasinoCoins && CasinoCoins.installBridgeHooks) {
      CasinoCoins.installBridgeHooks(async function () {
        await refreshBalance();
        updateBetFiat();
        updatePayoutForecasts();
        applyCoinModeUI();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
