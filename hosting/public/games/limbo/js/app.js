/* ============================================================
   Linkup — Limbo UI
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------- element refs ---------- */
  const el = {
    balance: $("balance"),
    resetBalance: $("resetBalance"),
    langToggle: $("langToggle"),
    betAmount: $("betAmount"),
    betFiat: $("betFiat"),
    profitOnWin: $("profitOnWin"),
    profitFiat: $("profitFiat"),
    halfBet: $("halfBet"),
    doubleBet: $("doubleBet"),
    betButton: $("betButton"),
    target: $("target"),
    winChance: $("winChance"),
    result: $("result"),
    pastBets: $("pastBets"),
    autoControls: $("autoControls"),
    // auto
    numBets: $("numBets"),
    onWinPct: $("onWinPct"),
    onLossPct: $("onLossPct"),
    stopProfit: $("stopProfit"),
    stopLoss: $("stopLoss"),
    autoBetButton: $("autoBetButton"),
    // stats
    statsToggle: $("statsToggle"),
    statsClose: $("statsClose"),
    soundToggle: $("soundToggle"),
    liveStats: $("liveStats"),
    lsProfit: $("lsProfit"),
    lsWins: $("lsWins"),
    lsLosses: $("lsLosses"),
    lsWagered: $("lsWagered"),
    targetError: $("targetError"),
    winChanceError: $("winChanceError"),
    fairnessToggle: $("fairnessToggle"),
    fairnessModal: $("fairnessModal"),
    closeFairnessModal: $("closeFairnessModal"),
  };

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
    if (window.CasinoCoins) CasinoCoins.applyEmbedCoinUI();
  }

  /* ---------- session stats (for live stats panel) ---------- */
  const session = { profit: 0, wins: 0, losses: 0, wagered: 0 };

  let mode = "manual";
  let rolling = false;
  let auto = { running: false, remaining: 0, baseBet: 0 };

  /* ============================================================
     Target multiplier <-> win chance linking
     ============================================================ */
  function validateInputs() {
    let rawT = parseFloat(el.target.value);
    let t = Math.round(rawT * 100) / 100;
    let targetValid = !isNaN(t) && t >= 1.01;

    if (targetValid) {
      el.targetError.classList.add("hidden");
      el.target.closest(".input-group").classList.remove("has-error");
    } else {
      el.targetError.classList.remove("hidden");
      el.target.closest(".input-group").classList.add("has-error");
    }

    let rawC = parseFloat(el.winChance.value);
    let c = Math.round(rawC * 1e8) / 1e8;
    let winChanceValid = !isNaN(c) && c <= 98.01980198;

    if (winChanceValid) {
      el.winChanceError.classList.add("hidden");
      el.winChance.closest(".input-group").classList.remove("has-error");
    } else {
      el.winChanceError.classList.remove("hidden");
      el.winChance.closest(".input-group").classList.add("has-error");
    }

    const hasError = !targetValid || !winChanceValid;
    el.betButton.disabled = hasError || rolling;
    if (auto.running && hasError) {
      stopAuto();
    }
    el.autoBetButton.disabled = hasError;
  }

  function syncFromTarget() {
    let t = parseFloat(el.target.value);
    if (!isNaN(t)) {
      const chance = Limbo.targetToWinChance(t);
      el.winChance.value = chance.toFixed(8);
    }
    validateInputs();
    updateProfit();
  }

  function syncFromWinChance() {
    let c = parseFloat(el.winChance.value);
    if (!isNaN(c)) {
      let t = Limbo.winChanceToTarget(c);
      el.target.value = t.toFixed(2);
    }
    validateInputs();
    updateProfit();
  }

  function getTarget() {
    return Limbo.clampTarget(parseFloat(el.target.value));
  }
  function getBet() {
    const v = parseFloat(el.betAmount.value);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  function updateProfit() {
    const profit = getBet() * (getTarget() - 1);
    el.profitOnWin.value = useCoinsUI() ? String(Math.floor(profit)) : fmt8(profit);
    if (!useCoinsUI()) el.profitFiat.textContent = fiat(profit);
  }

  function updateBetFiat() {
    if (!useCoinsUI()) el.betFiat.textContent = fiat(getBet());
    updateProfit();
  }

  /* ============================================================
     Balance + history rendering
     ============================================================ */
  async function refreshBalance() {
    const bal = await LinkupAPI.getBalance();
    renderCoinBalance(el.balance, bal);
    if (useCoinsUI() && window.CasinoCoins) CasinoCoins.applyEmbedCoinUI();
    return bal;
  }

  async function renderHistory() {
    const history = await LinkupAPI.getHistory(15);
    el.pastBets.innerHTML = "";
    // oldest first so newest ends up on the right
    history.slice().reverse().forEach((b) => addPill(b.result, b.won, false));
  }

  function addPill(result, won, animate = true) {
    const pill = document.createElement("span");
    pill.className = "pill" + (won ? " win" : "");
    pill.textContent = fmt2(result) + "×";
    if (!animate) pill.style.animation = "none";
    el.pastBets.appendChild(pill);
    // keep only the last ~9 visible
    while (el.pastBets.children.length > 9) {
      el.pastBets.removeChild(el.pastBets.firstChild);
    }
  }

  /* ============================================================
     Result animation (count up to the rolled multiplier)
     ============================================================ */
  function renderResult(value, klass) {
    el.result.className = "result" + (klass ? " " + klass : "");
    el.result.innerHTML = fmt2(value) + '<span class="x">×</span>';
  }

  function animateResult(finalValue, won) {
    return new Promise((resolve) => {
      const duration = 350; // ms
      const start = performance.now();
      Sound.rollStart(duration);
      // count-up cap so huge multipliers don't fly off instantly
      const from = 1.0;
      let done = false;

      function finish() {
        if (done) return;
        done = true;
        renderResult(finalValue, won ? "win" : "lose");
        el.result.classList.add("pop");
        if (won) Sound.win(finalValue); else Sound.lose();
        setTimeout(() => el.result.classList.remove("pop"), 450);
        resolve();
      }

      function frame(now) {
        if (done) return;
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        renderResult(from + (finalValue - from) * eased, null);
        if (p < 1) requestAnimationFrame(frame);
        else finish();
      }

      requestAnimationFrame(frame);
      // safety net: requestAnimationFrame is paused on hidden/unrendered tabs,
      // so guarantee the roll resolves (never soft-locks the Bet button).
      setTimeout(finish, duration + 250);
    });
  }

  /* ============================================================
     Core: place one bet
     ============================================================ */
  async function playOne() {
    const amount = getBet();
    const target = getTarget();

    let record;
    try {
      record = await LinkupAPI.placeBet({ amount, target });
    } catch (err) {
      const key = ERR_CODE_TO_KEY[err.code];
      flashError(key ? I18N.t(key) : err.message);
      return null;
    }

    await animateResult(record.result, record.won);
    addPill(record.result, record.won);
    await refreshBalance();

    // session stats
    session.wagered += amount;
    session.profit += record.profit;
    if (record.won) session.wins++; else session.losses++;
    updateStats();

    return record;
  }

  // maps API error codes -> i18n keys
  const ERR_CODE_TO_KEY = {
    INVALID_AMOUNT: "err_invalid_amount",
    INSUFFICIENT_BALANCE: "err_insufficient",
  };

  function flashError(msg) {
    el.betFiat.textContent = msg;
    el.betFiat.style.color = "var(--negative)";
    setTimeout(() => {
      el.betFiat.style.color = "";
      updateBetFiat();
    }, 1600);
  }

  /* ---------- manual bet ---------- */
  async function manualBet() {
    if (rolling) return;
    if (!el.targetError.classList.contains("hidden") || !el.winChanceError.classList.contains("hidden")) return;
    rolling = true;
    el.betButton.disabled = true;
    try {
      await playOne();
    } finally {
      rolling = false;
      el.betButton.disabled = !el.targetError.classList.contains("hidden") || !el.winChanceError.classList.contains("hidden");
    }
  }

  /* ============================================================
     Auto bet
     ============================================================ */
  function getAutoSetting(on) {
    const activeBtn = el.autoControls.querySelector(`.seg-btn.active[data-on="${on}"]`);
    const act = activeBtn ? activeBtn.dataset.act : "reset";
    const pct = on === "win" ? parseFloat(el.onWinPct.value) || 0 : parseFloat(el.onLossPct.value) || 0;
    return { act, pct };
  }

  function startAuto() {
    if (auto.running) { stopAuto(); return; }
    if (!el.targetError.classList.contains("hidden") || !el.winChanceError.classList.contains("hidden")) return;
    const bet = getBet();
    if (!(bet > 0)) { flashError(I18N.t("err_set_bet")); return; }

    auto.running = true;
    auto.baseBet = bet;
    auto.remaining = parseInt(el.numBets.value, 10) || 0; // 0 = infinite
    auto.sessionStartProfit = session.profit;

    el.autoBetButton.setAttribute("data-i18n", "stop_autobet");
    el.autoBetButton.textContent = I18N.t("stop_autobet");
    el.autoBetButton.classList.remove("auto-start");
    el.autoBetButton.classList.add("auto-running");

    runAutoStep();
  }

  function stopAuto() {
    auto.running = false;
    el.autoBetButton.setAttribute("data-i18n", "start_autobet");
    el.autoBetButton.textContent = I18N.t("start_autobet");
    el.autoBetButton.classList.add("auto-start");
    el.autoBetButton.classList.remove("auto-running");
  }

  async function runAutoStep() {
    if (!auto.running) return;

    const record = await playOne();
    if (!record) { stopAuto(); return; } // error (e.g. out of balance)

    // adjust next bet based on outcome
    const setting = record.won ? getAutoSetting("win") : getAutoSetting("loss");
    let next = getBet();
    if (setting.act === "reset") {
      next = auto.baseBet;
    } else {
      next = next * (1 + setting.pct / 100);
    }
    el.betAmount.value = fmt8(next);
    updateBetFiat();

    // stop conditions
    const netProfit = session.profit - auto.sessionStartProfit;
    const stopProfit = parseFloat(el.stopProfit.value) || 0;
    const stopLoss = parseFloat(el.stopLoss.value) || 0;
    if (stopProfit > 0 && netProfit >= stopProfit) return stopAuto();
    if (stopLoss > 0 && -netProfit >= stopLoss) return stopAuto();

    if (auto.remaining > 0) {
      auto.remaining--;
      if (auto.remaining === 0) return stopAuto();
    }

    setTimeout(runAutoStep, 350);
  }

  /* ============================================================
     Live stats panel
     ============================================================ */
  function updateStats() {
    el.lsProfit.textContent = fmt8(session.profit);
    el.lsProfit.className = "ls-val " + (session.profit > 0 ? "pos" : session.profit < 0 ? "neg" : "");
    el.lsWins.textContent = session.wins;
    el.lsLosses.textContent = session.losses;
    el.lsWagered.textContent = fmt8(session.wagered);
  }

  /* ============================================================
     Event wiring
     ============================================================ */
  function bind() {
    el.target.addEventListener("input", syncFromTarget);
    el.target.addEventListener("blur", () => {
      let t = parseFloat(el.target.value);
      if (isNaN(t) || t < 1.01) t = 1.01;
      if (t > 1000000) t = 1000000;
      el.target.value = t.toFixed(2);
      syncFromTarget();
    });

    el.winChance.addEventListener("input", syncFromWinChance);
    el.winChance.addEventListener("blur", () => {
      let c = parseFloat(el.winChance.value);
      if (isNaN(c) || c < 0.000099) c = 0.000099;
      if (c > 98.01980198) c = 98.01980198;
      el.winChance.value = c.toFixed(8);
      syncFromWinChance();
    });

    // bet amount
    el.betAmount.addEventListener("input", updateBetFiat);
    el.betAmount.addEventListener("blur", () => { el.betAmount.value = fmtInput(getBet()); });

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

    // manual bet
    el.betButton.addEventListener("click", manualBet);

    // reset balance
    el.resetBalance.addEventListener("click", async () => {
      await LinkupAPI.resetBalance();
      session.profit = session.wins = session.losses = session.wagered = 0;
      updateStats();
      await refreshBalance();
      await renderHistory();
    });

    // tabs
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (auto.running) stopAuto();
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        mode = tab.dataset.mode;
        const isAuto = mode === "auto";
        el.autoControls.classList.toggle("hidden", !isAuto);
        el.betButton.classList.toggle("hidden", isAuto);
      });
    });

    // auto seg buttons (reset / increase)
    el.autoControls.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const on = btn.dataset.on;
        el.autoControls
          .querySelectorAll(`.seg-btn[data-on="${on}"]`)
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const pctInput = on === "win" ? el.onWinPct : el.onLossPct;
        pctInput.disabled = btn.dataset.act !== "increase";
      });
    });

    el.autoBetButton.addEventListener("click", startAuto);

    // stats panel
    el.statsToggle.addEventListener("click", () => el.liveStats.classList.toggle("hidden"));
    el.statsClose.addEventListener("click", () => el.liveStats.classList.add("hidden"));

    // sound mute toggle (preference persisted)
    Sound.setMuted(localStorage.getItem("linkup_muted") === "1");
    const renderSoundIcon = () => { el.soundToggle.textContent = Sound.muted ? "🔇" : "🔊"; };
    renderSoundIcon();
    el.soundToggle.addEventListener("click", () => {
      const m = Sound.toggle();
      localStorage.setItem("linkup_muted", m ? "1" : "0");
      renderSoundIcon();
      if (!m) Sound.click(); // audible confirmation when unmuting
    });

    // Enter key in bet amount = bet
    el.betAmount.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && mode === "manual") manualBet();
    });

    // language toggle (EN <-> AR), preference persisted by I18N
    el.langToggle.addEventListener("click", () => {
      I18N.set(I18N.lang === "en" ? "ar" : "en");
      renderLangToggle();
      Sound.click();
    });

    // Space anywhere (outside inputs/buttons) = quick bet / toggle autobet
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "button" || tag === "textarea") return;
      e.preventDefault();
      if (mode === "manual") manualBet(); else startAuto();
    });

    // fairness modal
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
  }

  // the toggle button shows the language you'd switch TO
  function renderLangToggle() {
    el.langToggle.textContent = I18N.t("switch_lang");
  }

  /* ============================================================
     Init
     ============================================================ */
  async function init() {
    bind();
    I18N.init();          // sets language (saved pref or browser), applies dir/text
    renderLangToggle();
    syncFromTarget();
    updateBetFiat();
    updateStats();
    await refreshBalance();
    await renderHistory();
    applyCoinModeUI();
    if (window.CasinoCoins && CasinoCoins.installBridgeHooks) {
      CasinoCoins.installBridgeHooks(async function () {
        await refreshBalance();
        updateBetFiat();
        applyCoinModeUI();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
