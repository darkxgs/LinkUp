/* ============================================================
 * Linkup · Dragon Tower — game logic & UI
 * Talks to the backend only through GameAPI (see js/api.js).
 * ============================================================ */
(() => {
  'use strict';

  const { ROWS, DIFFICULTIES, multiplierFor } = GameAPI;

  /* ---------------- elements ---------------- */
  const $ = id => document.getElementById(id);

  const els = {
    balance: $('balanceDisplay'),
    board: $('board'),
    tower: document.querySelector('.tower'),
    betInput: $('betInput'),
    betFiat: $('betFiat'),
    betHalf: $('betHalf'),
    betDouble: $('betDouble'),
    difficulty: $('difficultySelect'),
    actionBtn: $('actionBtn'),
    randomBtn: $('randomBtn'),
    multDisplay: $('multDisplay'),
    nextMult: $('nextMultDisplay'),
    profitInput: $('profitInput'),
    profitFiat: $('profitFiat'),
    winPopup: $('winPopup'),
    winPopupMult: $('winPopupMult'),
    winPopupAmount: $('winPopupAmount'),
    tabManual: $('tabManual'),
    tabAuto: $('tabAuto'),
    autoBets: $('autoBetsInput'),
    autoRows: $('autoRowsSelect'),
    soundBtn: $('soundBtn'),
    soundOn: $('soundOnIcon'),
    soundOff: $('soundOffIcon'),
    resetBtn: $('resetBtn'),
    langSelect: $('langSelect'),
  };

  /* ---------------- state ---------------- */
  const state = {
    mode: 'manual',        // 'manual' | 'auto'
    phase: 'idle',         // 'idle' | 'playing' | 'busy'
    gameId: null,
    difficulty: 'medium',
    bet: 0,
    picksDone: 0,          // successful rows so far
    balance: 0,
    autoRunning: false,
    soundOn: true,
  };

  // داخل التطبيق: كوين صحيح بدون رمز $ — مستقل: دولارات تجريبية
  const PLATFORM = GameAPI.platform();
  const fmt = n => PLATFORM.embedded
    ? Math.round(n).toLocaleString('en-US')
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------- sounds ---------------- */
  const sounds = {
    click:   Object.assign(new Audio('assets/Click_Tile.mp3'), { volume: 0.7 }),
    wrong:   Object.assign(new Audio('assets/WrongTile.mp3'),  { volume: 0.8 }),
    cashout: Object.assign(new Audio('assets/Cashout.mp3'),    { volume: 0.7 }),
  };
  Object.values(sounds).forEach(a => { a.preload = 'auto'; });

  const music = Object.assign(new Audio('assets/Music.mp3'), { loop: true, volume: 0.28 });

  function play(name) {
    if (!state.soundOn) return;
    const base = sounds[name];
    if (!base) return;
    try {
      const a = base.cloneNode();
      a.volume = base.volume;
      a.play().catch(() => {});
    } catch { /* audio unavailable */ }
  }

  function ensureMusic() {
    if (state.soundOn) music.play().catch(() => {});
  }
  // browsers block autoplay until the first user gesture
  window.addEventListener('pointerdown', ensureMusic, { once: true });

  const sfx = {
    pick: () => play('click'),
    egg: () => play('click'),
    skull: () => play('wrong'),
    cashout: () => play('cashout'),
  };

  /* ---------------- board rendering ---------------- */
  // tiles[row][col] -> button element. Row 0 = bottom (rendered last).
  let tiles = [];

  function buildBoard() {
    const { cols } = DIFFICULTIES[state.difficulty];
    els.board.innerHTML = '';
    tiles = [];
    for (let r = 0; r < ROWS; r++) tiles.push(new Array(cols));

    for (let r = ROWS - 1; r >= 0; r--) {
      const rowEl = document.createElement('div');
      rowEl.className = 'row';
      rowEl.dataset.row = r;
      for (let c = 0; c < cols; c++) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        tile.disabled = true;
        tile.addEventListener('click', () => onTileClick(r, c));
        rowEl.appendChild(tile);
        tiles[r][c] = tile;
      }
      els.board.appendChild(rowEl);
    }
    els.tower.classList.remove('lost', 'won');
  }

  function setActiveRow(r) {
    tiles.flat().forEach(t => { t.classList.remove('active'); t.disabled = true; });
    if (r === null || r >= ROWS) return;
    for (const t of tiles[r]) {
      t.classList.add('active');
      t.disabled = false;
    }
  }

  function putImage(tile, kind, dim = false) {
    const img = document.createElement('img');
    img.src = kind === 'egg' ? 'assets/egg.png' : 'assets/skeleton.png';
    img.alt = kind;
    if (kind === 'skeleton') img.classList.add('skeleton');
    if (dim) img.classList.add('dim');
    tile.appendChild(img);
  }

  /** end-of-game reveal: dim eggs on every unpicked safe tile */
  function revealGrid(grid, pickedLose = null) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const t = tiles[r][c];
        const alreadyShown = t.querySelector('img');
        if (pickedLose && pickedLose.row === r && pickedLose.col === c) continue;
        if (grid[r][c] && !alreadyShown) putImage(t, 'egg', true);
      }
    }
  }

  /* ---------------- sidebar / HUD ---------------- */

  function getBetValue() {
    const v = parseFloat(String(els.betInput.value).replace(/,/g, ''));
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0;
  }

  function setBetValue(v) {
    // داخل التطبيق: حدود الرهان من لوحة التحكم + أرقام صحيحة
    const upper = Math.min(state.balance, PLATFORM.embedded ? PLATFORM.maxBet : Infinity);
    let clamped = Math.max(0, Math.min(v, upper));
    if (PLATFORM.embedded) clamped = Math.round(clamped);
    els.betInput.value = PLATFORM.embedded ? String(clamped) : clamped.toFixed(2);
    els.betFiat.textContent = fmt(clamped);
    highlightChip(clamped);
  }

  function updateBalance(v) {
    state.balance = v;
    els.balance.textContent = fmt(v);
  }

  function updateProfitPanel() {
    const mult = state.phase === 'playing' ? multiplierFor(state.difficulty, state.picksDone) : 1;
    const profit = state.phase === 'playing' ? state.bet * mult - state.bet : 0;
    els.multDisplay.textContent = mult.toFixed(2) + '×';
    els.profitInput.value = profit.toFixed(2);
    els.profitFiat.textContent = fmt(profit);

    const nextPick = state.phase === 'playing' ? state.picksDone + 1 : 1;
    els.nextMult.textContent = nextPick <= ROWS
      ? multiplierFor(state.difficulty, nextPick).toFixed(2) + '×'
      : '—';
  }

  function refreshControls() {
    const playing = state.phase === 'playing';
    const busy = state.phase === 'busy';
    const auto = state.mode === 'auto';

    els.betInput.disabled = playing || busy || state.autoRunning;
    els.betHalf.disabled = playing || busy || state.autoRunning;
    els.betDouble.disabled = playing || busy || state.autoRunning;
    els.difficulty.disabled = playing || busy || state.autoRunning;
    els.autoBets.disabled = state.autoRunning;
    els.autoRows.disabled = state.autoRunning;

    if (auto) {
      els.actionBtn.textContent = I18N.t(state.autoRunning ? 'stopAutobet' : 'startAutobet');
      els.actionBtn.classList.toggle('stop', state.autoRunning);
      els.actionBtn.classList.remove('cashout');
      els.actionBtn.disabled = busy && !state.autoRunning;
    } else {
      els.actionBtn.classList.remove('stop');
      if (playing) {
        els.actionBtn.textContent = I18N.t('cashout');
        els.actionBtn.classList.add('cashout');
        // can only cash out after at least one egg
        els.actionBtn.disabled = state.picksDone === 0 || busy;
      } else {
        els.actionBtn.textContent = I18N.t('bet');
        els.actionBtn.classList.remove('cashout');
        els.actionBtn.disabled = busy;
      }
      els.randomBtn.disabled = !playing || busy;
    }
  }

  function showWinPopup(mult, payout) {
    els.winPopupMult.textContent = mult.toFixed(2) + '×';
    els.winPopupAmount.textContent = fmt(payout);
    els.winPopup.classList.remove('hidden');
  }
  const hideWinPopup = () => els.winPopup.classList.add('hidden');

  /* ---------------- game flow ---------------- */

  async function startGame() {
    const amount = getBetValue();
    if (amount > state.balance) { setBetValue(state.balance); return; }
    // داخل التطبيق: لا رهان تحت الحد الأدنى من لوحة التحكم
    if (PLATFORM.embedded && amount < PLATFORM.minBet) { setBetValue(PLATFORM.minBet); return; }

    state.phase = 'busy';
    refreshControls();
    hideWinPopup();
    try {
      const res = await GameAPI.placeBet({ amount, difficulty: state.difficulty });
      updateBalance(res.balance);
      state.gameId = res.gameId;
      state.bet = amount;
      state.picksDone = 0;
      state.phase = 'playing';
      buildBoard();
      setActiveRow(0);
      sfx.pick();
    } catch (err) {
      console.error(err);
      state.phase = 'idle';
    }
    updateProfitPanel();
    refreshControls();
  }

  async function onTileClick(row, col) {
    if (state.phase !== 'playing' || row !== state.picksDone) return;
    await doPick(col);
  }

  async function doPick(col) {
    const row = state.picksDone;
    state.phase = 'busy';
    setActiveRow(null);
    refreshControls();

    let res;
    try {
      res = await GameAPI.pick(state.gameId, col);
    } catch (err) {
      console.error(err);
      state.phase = 'playing';
      setActiveRow(row);
      refreshControls();
      return false;
    }

    const tile = tiles[row][col];

    if (res.result === 'lose') {
      tile.classList.add('lose-pick');
      putImage(tile, 'skeleton');
      els.tower.classList.add('lost', 'shake');
      setTimeout(() => els.tower.classList.remove('shake'), 500);
      sfx.skull();
      updateBalance(res.balance);
      revealGrid(res.grid, { row, col });
      state.phase = 'idle';
      state.gameId = null;
      state.picksDone = 0;
      updateProfitPanel();
      refreshControls();
      return 'lose';
    }

    // egg found — this tile keeps its egg in a bordered box
    tile.classList.remove('active');
    tile.classList.add('picked');
    putImage(tile, 'egg');
    sfx.egg();
    state.picksDone = row + 1;
    await sleep(200);

    if (res.done) { // reached the top — auto cashout
      els.tower.classList.add('won');
      sfx.cashout();
      updateBalance(res.balance);
      revealGrid(res.grid);
      showWinPopup(res.multiplier, res.payout);
      state.phase = 'idle';
      state.gameId = null;
      updateProfitPanel();
      refreshControls();
      return 'top';
    }

    state.phase = 'playing';
    setActiveRow(state.picksDone);
    updateProfitPanel();
    refreshControls();
    return 'egg';
  }

  async function doCashout() {
    if (state.phase !== 'playing' || state.picksDone === 0) return;
    state.phase = 'busy';
    setActiveRow(null);
    refreshControls();
    try {
      const res = await GameAPI.cashout(state.gameId);
      els.tower.classList.add('won');
      sfx.cashout();
      updateBalance(res.balance);
      revealGrid(res.grid);
      showWinPopup(res.multiplier, res.payout);
    } catch (err) {
      console.error(err);
    }
    state.phase = 'idle';
    state.gameId = null;
    updateProfitPanel();
    refreshControls();
  }

  function randomCol() {
    const { cols } = DIFFICULTIES[state.difficulty];
    return Math.floor(Math.random() * cols);
  }

  /* ---------------- auto mode ---------------- */

  async function runAuto() {
    state.autoRunning = true;
    refreshControls();

    let betsLeft = parseInt(els.autoBets.value, 10);
    const infinite = !Number.isFinite(betsLeft) || betsLeft <= 0;
    const targetRows = parseInt(els.autoRows.value, 10) || 1;

    while (state.autoRunning && (infinite || betsLeft > 0)) {
      if (getBetValue() > state.balance) break;

      await startGame();
      if (state.phase !== 'playing') break;

      // climb
      while (state.autoRunning && state.phase === 'playing' && state.picksDone < targetRows) {
        await sleep(300);
        const outcome = await doPick(randomCol());
        if (outcome === 'lose' || outcome === 'top' || outcome === false) break;
      }
      if (state.phase === 'playing') {
        await sleep(250);
        if (state.picksDone >= targetRows) {
          await doCashout();
        }
      }
      if (!infinite) betsLeft--;
      await sleep(600);
    }

    // if stopped mid-game with progress, cash out; otherwise leave board
    if (state.phase === 'playing' && state.picksDone > 0) await doCashout();

    state.autoRunning = false;
    refreshControls();
  }

  function stopAuto() { state.autoRunning = false; refreshControls(); }

  /* ---------------- events ---------------- */

  els.actionBtn.addEventListener('click', () => {
    if (state.mode === 'auto') {
      state.autoRunning ? stopAuto() : runAuto();
    } else if (state.phase === 'idle') {
      startGame();
    } else if (state.phase === 'playing') {
      doCashout();
    }
  });

  els.randomBtn.addEventListener('click', () => {
    if (state.phase === 'playing') doPick(randomCol());
  });

  els.betInput.addEventListener('blur', () => setBetValue(getBetValue()));
  els.betInput.addEventListener('input', () => { els.betFiat.textContent = fmt(getBetValue()); });
  els.betHalf.addEventListener('click', () => {
    const half = getBetValue() / 2;
    setBetValue(PLATFORM.embedded ? Math.max(PLATFORM.minBet, Math.round(half)) : half);
  });
  els.betDouble.addEventListener('click', () => setBetValue(getBetValue() * 2 || (PLATFORM.embedded ? PLATFORM.minBet : 0.01)));

  /* ---------------- شرائح الرهان (من لوحة التحكم) ---------------- */
  const chipsRow = document.getElementById('chipsRow');
  function highlightChip(v) {
    if (!chipsRow) return;
    [...chipsRow.children].forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.v) === v);
    });
  }
  function buildChips() {
    if (!chipsRow) return;
    chipsRow.innerHTML = '';
    PLATFORM.chips.forEach(v => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.v = String(v);
      btn.innerHTML = '<img src="/images/coin-gold.png?v=4" alt="" style="width:14px;height:14px"> ' +
        (v >= 1000 ? (v / 1000) + 'K' : String(v));
      btn.addEventListener('click', () => {
        if (state.phase === 'playing' || state.autoRunning) return;
        setBetValue(v);
      });
      chipsRow.appendChild(btn);
    });
  }

  els.difficulty.addEventListener('change', () => {
    state.difficulty = els.difficulty.value;
    buildBoard();
    hideWinPopup();
    updateProfitPanel();
  });

  function switchMode(mode) {
    if (state.phase === 'playing' || state.autoRunning) return;
    state.mode = mode;
    els.tabManual.classList.toggle('active', mode === 'manual');
    els.tabAuto.classList.toggle('active', mode === 'auto');
    document.querySelectorAll('.auto-only').forEach(el => el.classList.toggle('hidden', mode !== 'auto'));
    document.querySelectorAll('.manual-only').forEach(el => el.classList.toggle('hidden', mode !== 'manual'));
    refreshControls();
  }
  els.tabManual.addEventListener('click', () => switchMode('manual'));
  els.tabAuto.addEventListener('click', () => switchMode('auto'));

  els.soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    els.soundOn.classList.toggle('hidden', !state.soundOn);
    els.soundOff.classList.toggle('hidden', state.soundOn);
    if (state.soundOn) music.play().catch(() => {});
    else music.pause();
  });

  els.resetBtn.addEventListener('click', async () => {
    if (state.phase === 'playing' || state.autoRunning) return;
    const res = await GameAPI.setBalance(1000);
    updateBalance(res.balance);
    hideWinPopup();
    buildBoard();
    updateProfitPanel();
  });

  /* ---------------- init ---------------- */

  (async function init() {
    // rows selector for auto mode
    for (let i = 1; i <= ROWS; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      els.autoRows.appendChild(opt);
    }
    const syncRowsLabels = () => {
      [...els.autoRows.options].forEach((opt, i) => {
        const mult = multiplierFor(els.difficulty.value, i + 1).toFixed(2);
        opt.textContent = I18N.rowsLabel(i + 1, mult);
      });
    };
    els.difficulty.addEventListener('change', syncRowsLabels);

    // language: apply on load, re-render dynamic text on change
    els.langSelect.value = I18N.lang;
    els.langSelect.addEventListener('change', () => I18N.set(els.langSelect.value));
    I18N.onChange(() => { syncRowsLabels(); refreshControls(); });

    if (PLATFORM.embedded) {
      // انتظر INIT_DATA من التطبيق (رصيد + إعدادات لوحة التحكم) حتى 5 ثوانٍ
      const b = window.CasinoBridge;
      const t0 = Date.now();
      while (b && !(b.getState && b.getState().walletReady) && Date.now() - t0 < 5000) {
        await sleep(100);
      }
      // حدّث حدود المنصة بعد وصول config
      Object.assign(PLATFORM, GameAPI.platform());
      // واجهة داخل التطبيق: لا شارة DEMO ولا زر تصفير رصيد
      const demoBadge = document.getElementById('demoBadge');
      if (demoBadge) demoBadge.style.display = 'none';
      if (els.resetBtn) els.resetBtn.style.display = 'none';
      // مزامنة الرصيد الحي من التطبيق (UPDATE_BALANCE) أثناء الخمول
      setInterval(() => {
        if (state.phase === 'idle' && !state.autoRunning) {
          const live = b && b.getBalance ? b.getBalance() : state.balance;
          if (live !== state.balance) updateBalance(live);
        }
      }, 1000);
    }

    const { balance } = await GameAPI.getBalance();
    updateBalance(balance);
    buildChips();
    // الرهان الابتدائي: أول شريحة داخل التطبيق
    setBetValue(PLATFORM.embedded ? (PLATFORM.chips[0] || PLATFORM.minBet) : getBetValue());
    state.difficulty = els.difficulty.value;
    buildBoard();
    I18N.set(I18N.lang); // apply static labels + dynamic text together
    updateProfitPanel();
    refreshControls();
  })();
})();
