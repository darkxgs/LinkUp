/* =========================================================================
 * Linkup Dice — UI + game math.
 * All balance/RNG goes through LinkupAPI (see api.js) — the database seam.
 * ========================================================================= */

const HOUSE_EDGE = LinkupAPI.HOUSE_EDGE;   // 1%
const MIN_CHANCE = 0.01;
const MAX_CHANCE = 98;
const MIN_TARGET = 2;     // matches the reference slider (min=2, max=98)
const MAX_TARGET = 98;

/* ---- bet math ---------------------------------------------------------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const chanceFromTarget   = (cond, t) => cond === 'above' ? 100 - t : t;
const targetFromChance   = (cond, c) => cond === 'above' ? 100 - c : c;
const multiplierFromChance = (c) => (100 - HOUSE_EDGE * 100) / c;        // 99 / chance
const chanceFromMultiplier = (m) => (100 - HOUSE_EDGE * 100) / m;

/* ---- UI state ---------------------------------------------------------- */
let condition  = 'above';                       // 'above' = Roll Over, 'below' = Roll Under
let winChance  = 49.5;                           // Stake default
let target     = targetFromChance(condition, winChance);   // 50.5
let multiplier = multiplierFromChance(winChance);          // 2.0000
let soundOn    = true;
let animOn     = true;
let autoRunning = false;

/* ---- element refs ------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const el = {
  balanceValue: $('balanceValue'), resetBtn: $('resetBtn'),
  betAmount: $('betAmount'), betUsd: $('betUsd'),
  profitOnWin: $('profitOnWin'), profitUsd: $('profitUsd'),
  betBtn: $('betBtn'), halfBtn: $('halfBtn'), doubleBtn: $('doubleBtn'),
  tabManual: $('tabManual'), tabAuto: $('tabAuto'),
  manualControls: $('manualControls'), autoControls: $('autoControls'),
  numBets: $('numBets'), advToggle: $('advToggle'), advancedFields: $('advancedFields'),
  onWinPct: $('onWinPct'), onLossPct: $('onLossPct'),
  stopProfit: $('stopProfit'), stopLoss: $('stopLoss'), autoBtn: $('autoBtn'),
  board: $('board'), track: $('track'), thumb: $('thumb'),
  regionLower: $('regionLower'), regionHigher: $('regionHigher'),
  diceCube: $('diceCube'), diceResult: $('diceResult'),
  multiplierInput: $('multiplierInput'), rollOverInput: $('rollOverInput'),
  winChanceInput: $('winChanceInput'), conditionToggle: $('conditionToggle'), rollLabel: $('rollLabel'),
  lastRolls: $('lastRolls'),
  // footer + modals
  settingsBtn: $('settingsBtn'), soundBtn: $('soundBtn'), fairnessBtn: $('fairnessBtn'),
  fairnessModal: $('fairnessModal'), settingsModal: $('settingsModal'),
  clientSeedInput: $('clientSeedInput'), saveSeedBtn: $('saveSeedBtn'),
  serverSeedHash: $('serverSeedHash'), nonceView: $('nonceView'),
  rotateSeedBtn: $('rotateSeedBtn'), revealBox: $('revealBox'), revealedSeed: $('revealedSeed'),
  animToggle: $('animToggle'), soundToggle: $('soundToggle'),
};

const fmt8  = (n) => (useCoinsUI() ? CasinoCoins.fmtAmount(n) : Number(n).toFixed(8));
const fmtInput = (n) => (useCoinsUI() ? CasinoCoins.fmtInput(n) : Number(n).toFixed(8));
const fmtUsd = (n) => '$' + Number(n).toFixed(2);
const useCoinsUI = () => window.CasinoCoins && CasinoCoins.isEmbedded();
const getBet = () => parseFloat(el.betAmount.value) || 0;

/* ---- rendering --------------------------------------------------------- */
async function renderBalance() {
  const s = await LinkupAPI.getState();
  if (useCoinsUI()) {
    el.balanceValue.innerHTML = CasinoCoins.formatAmount(s.balance, 18);
    if (el.betUsd) el.betUsd.style.display = 'none';
    if (el.profitUsd) el.profitUsd.style.display = 'none';
    if (el.betAmount) el.betAmount.step = '1';
    CasinoCoins.applyEmbedCoinUI();
  } else {
    el.balanceValue.textContent = fmt8(s.balance);
  }
}

function renderSlider() {
  el.thumb.style.left = target + '%';
  el.regionLower.style.width  = target + '%';
  el.regionHigher.style.width = (100 - target) + '%';
  const lowerWins = condition === 'below';   // below -> winning region is the lower side
  el.regionLower.style.background  = lowerWins ? 'var(--green)' : 'var(--red)';
  el.regionHigher.style.background = lowerWins ? 'var(--red)' : 'var(--green)';
}

function renderInputs() {
  el.multiplierInput.value = multiplier.toFixed(4);
  el.rollOverInput.value   = target.toFixed(2);
  el.winChanceInput.value  = winChance.toFixed(4);
  el.rollLabel.textContent = condition === 'above' ? 'Roll Over' : 'Roll Under';
  renderSlider();
  renderProfit();
}

function renderProfit() {
  const amount = getBet();
  const profit = amount * multiplier - amount;
  el.profitOnWin.value = useCoinsUI() ? fmtInput(profit) : fmt8(profit);
  if (!useCoinsUI()) {
    el.betUsd.textContent = fmtUsd(amount);
    el.profitUsd.textContent = fmtUsd(profit);
  }
}

/* ---- derive-from helpers ---------------------------------------------- */
function fromChance(c) {
  winChance = clamp(c, MIN_CHANCE, MAX_CHANCE);
  target = clamp(targetFromChance(condition, winChance), 0, 100);
  multiplier = multiplierFromChance(winChance);
  renderInputs();
}
function fromTarget(t) {
  target = clamp(t, MIN_TARGET, MAX_TARGET);
  winChance = chanceFromTarget(condition, target);
  multiplier = multiplierFromChance(winChance);
  renderInputs();
}
function fromMultiplier(m) {
  const minM = multiplierFromChance(MAX_CHANCE);
  const maxM = multiplierFromChance(MIN_CHANCE);
  multiplier = clamp(m, minM, maxM);
  winChance = chanceFromMultiplier(multiplier);
  target = clamp(targetFromChance(condition, winChance), 0, 100);
  renderInputs();
}

/* ---- custom draggable slider ------------------------------------------ */
function pointerToTarget(clientX) {
  const r = el.track.getBoundingClientRect();
  const pct = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
  return Math.round(pct * 100) / 100;
}
let dragging = false;
function startDrag(e) {
  if (autoRunning) return;
  dragging = true;
  lastTick = Math.round(target);
  fromTarget(pointerToTarget(e.clientX ?? e.touches[0].clientX));
  sliderTick();
  e.preventDefault();
}
function moveDrag(e) {
  if (!dragging) return;
  const x = e.clientX ?? (e.touches && e.touches[0].clientX);
  if (x != null) { fromTarget(pointerToTarget(x)); sliderTick(); }
}
function endDrag() { dragging = false; }
el.track.addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);

/* ---- stat inputs ------------------------------------------------------- */
el.rollOverInput.addEventListener('change', (e) => fromTarget(parseFloat(e.target.value) || target));
el.winChanceInput.addEventListener('change', (e) => fromChance(parseFloat(e.target.value) || winChance));
el.multiplierInput.addEventListener('change', (e) => fromMultiplier(parseFloat(e.target.value) || multiplier));
el.conditionToggle.addEventListener('click', () => {
  if (autoRunning) return;
  condition = condition === 'above' ? 'below' : 'above';
  target = 100 - target;                     // mirror the threshold
  winChance = chanceFromTarget(condition, target);
  multiplier = multiplierFromChance(winChance);
  renderInputs();
});

/* ---- bet amount helpers ------------------------------------------------ */
el.betAmount.addEventListener('input', renderProfit);
el.halfBtn.addEventListener('click', () => { el.betAmount.value = fmt8(getBet() / 2); renderProfit(); });
el.doubleBtn.addEventListener('click', () => { el.betAmount.value = fmt8(getBet() * 2); renderProfit(); });

/* ---- tabs -------------------------------------------------------------- */
el.tabManual.addEventListener('click', () => switchTab('manual'));
el.tabAuto.addEventListener('click', () => switchTab('auto'));
function switchTab(which) {
  if (autoRunning) return;
  const manual = which === 'manual';
  el.tabManual.classList.toggle('active', manual);
  el.tabAuto.classList.toggle('active', !manual);
  el.manualControls.classList.toggle('hidden', !manual);
  el.autoControls.classList.toggle('hidden', manual);
}

/* ---- advanced auto fields + segmented buttons -------------------------- */
el.advToggle.addEventListener('change', () => el.advancedFields.classList.toggle('hidden', !el.advToggle.checked));
let onWinMode = 'reset', onLossMode = 'reset';
document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-win]').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); onWinMode = b.dataset.win;
}));
document.querySelectorAll('[data-loss]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-loss]').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); onLossMode = b.dataset.loss;
}));

/* ---- result presentation ---------------------------------------------- */
function showResult(result) {
  el.diceCube.classList.remove('hidden', 'win', 'loss', 'bump');
  el.diceResult.textContent = result.roll.toFixed(2);
  el.diceCube.style.left = result.roll + '%';
  el.diceCube.classList.add(result.won ? 'win' : 'loss');
  if (animOn) { void el.diceCube.offsetWidth; el.diceCube.classList.add('bump'); }

  const badge = document.createElement('div');
  badge.className = 'roll-badge' + (result.won ? ' win' : '');
  badge.textContent = result.roll.toFixed(2);
  el.lastRolls.appendChild(badge);
  while (el.lastRolls.children.length > 6) el.lastRolls.removeChild(el.lastRolls.firstChild);

  playSfx(result.won ? 'win' : 'lose');
}

/* ---- manual bet -------------------------------------------------------- */
el.betBtn.addEventListener('click', async () => {
  playSfx('bet');
  el.betBtn.disabled = true;
  try {
    const result = await LinkupAPI.placeBet({ amount: getBet(), condition, target, multiplier });
    showResult(result);
    await renderBalance();
  } catch (err) {
    flashError(err.message);
  } finally {
    el.betBtn.disabled = false;
  }
});

/* ---- auto bet ---------------------------------------------------------- */
el.autoBtn.addEventListener('click', () => autoRunning ? stopAuto() : startAuto());

function startAuto() {
  const baseBet = getBet();
  if (baseBet <= 0) return flashError('Enter a bet amount greater than 0');
  playSfx('bet');
  autoRunning = true;
  el.autoBtn.textContent = 'Stop Autobet';
  el.autoBtn.classList.add('running');

  const total = Math.max(0, parseInt(el.numBets.value) || 0);  // 0 = infinite
  const advanced = el.advToggle.checked;
  const onWinPct = parseFloat(el.onWinPct.value) || 0;
  const onLossPct = parseFloat(el.onLossPct.value) || 0;
  const stopProfit = parseFloat(el.stopProfit.value) || 0;
  const stopLoss = parseFloat(el.stopLoss.value) || 0;

  let placed = 0, sessionProfit = 0, currentBet = baseBet;

  (async function loop() {
    while (autoRunning) {
      el.betAmount.value = fmt8(currentBet);
      renderProfit();
      let result;
      try {
        result = await LinkupAPI.placeBet({ amount: currentBet, condition, target, multiplier });
      } catch (err) {
        flashError(err.message);
        break;
      }
      showResult(result);
      await renderBalance();

      sessionProfit += result.profit;
      placed++;

      // adjust next bet
      if (advanced) {
        if (result.won) currentBet = onWinMode === 'reset' ? baseBet : currentBet * (1 + onWinPct / 100);
        else            currentBet = onLossMode === 'reset' ? baseBet : currentBet * (1 + onLossPct / 100);
      }

      // stop conditions
      if (total > 0 && placed >= total) break;
      if (advanced && stopProfit > 0 && sessionProfit >= stopProfit) break;
      if (advanced && stopLoss > 0 && sessionProfit <= -stopLoss) break;

      await sleep(animOn ? 320 : 120);
    }
    stopAuto();
  })();
}

function stopAuto() {
  autoRunning = false;
  el.autoBtn.textContent = 'Start Autobet';
  el.autoBtn.classList.remove('running');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---- reset / error ----------------------------------------------------- */
el.resetBtn.addEventListener('click', async () => {
  LinkupAPI.resetBalance();
  await renderBalance();
});
function flashError(msg) {
  el.balanceValue.textContent = msg;
  el.balanceValue.style.color = 'var(--red)';
  setTimeout(async () => { el.balanceValue.style.color = ''; await renderBalance(); }, 1400);
}

/* ---- sound (mp3 assets in /sound) -------------------------------------- */
const SFX = {
  tick: 'sound/Slider_Tick.mp3',     // ticks while dragging the slider
  win:  'sound/WinSound.mp3',        // roll won
  lose: 'sound/Lose.mp3',            // roll lost
  bet:  'sound/ButtomBet_Press.mp3', // bet / start-autobet button press
};
const VOL = { tick: 0.5, win: 0.7, lose: 0.7, bet: 0.6 };
// playbackRate > 1 raises pitch and shortens the clip => higher & sharper tick
const RATE = { tick: 1.8 };
// warm the browser cache so the first play isn't delayed
const _warm = {};
for (const k in SFX) { _warm[k] = new Audio(SFX[k]); _warm[k].preload = 'auto'; }

function playSfx(name) {
  if (!soundOn || !SFX[name]) return;
  try {
    const a = new Audio(SFX[name]);   // fresh node => overlapping plays are fine
    a.volume = VOL[name] ?? 0.6;
    a.playbackRate = RATE[name] ?? 1; // pitch/speed
    a.play().catch(() => {});         // ignore autoplay rejections
  } catch (_) { /* no audio */ }
}

// tick once per whole-number step crossed, but no more than once per 0.5s
let lastTick = null;
let lastTickTime = 0;
const TICK_GAP_MS = 500;
function sliderTick() {
  const step = Math.round(target);
  const now = performance.now();
  if (step !== lastTick && now - lastTickTime >= TICK_GAP_MS) {
    lastTick = step;
    lastTickTime = now;
    playSfx('tick');
  }
}
el.soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  el.soundBtn.textContent = soundOn ? '🔊' : '🔇';
  if (el.soundToggle) el.soundToggle.checked = soundOn;
});

/* ---- modals ------------------------------------------------------------ */
function openModal(m) { m.classList.remove('hidden'); }
function closeModal(m) { m.classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', (e) => closeModal(e.target.closest('.modal-overlay'))));
document.querySelectorAll('.modal-overlay').forEach(ov => ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov); }));

el.settingsBtn.addEventListener('click', () => openModal(el.settingsModal));
el.animToggle.addEventListener('change', () => animOn = el.animToggle.checked);
el.soundToggle.addEventListener('change', () => {
  soundOn = el.soundToggle.checked;
  el.soundBtn.textContent = soundOn ? '🔊' : '🔇';
});

el.fairnessBtn.addEventListener('click', async () => {
  const s = await LinkupAPI.getState();
  el.clientSeedInput.value = s.clientSeed;
  el.serverSeedHash.value = s.serverSeedHash;
  el.nonceView.value = s.nonce;
  el.revealBox.classList.add('hidden');
  openModal(el.fairnessModal);
});
el.saveSeedBtn.addEventListener('click', () => {
  el.clientSeedInput.value = LinkupAPI.setClientSeed(el.clientSeedInput.value);
});
el.rotateSeedBtn.addEventListener('click', async () => {
  const { revealedServerSeed, newServerSeedHash } = await LinkupAPI.rotateServerSeed();
  el.revealedSeed.value = revealedServerSeed;
  el.serverSeedHash.value = newServerSeedHash;
  const s = await LinkupAPI.getState();
  el.nonceView.value = s.nonce;
  el.revealBox.classList.remove('hidden');
});

/* ---- init -------------------------------------------------------------- */
(async function init() {
  if (window.CasinoCoins && CasinoCoins.installBridgeHooks) {
    CasinoCoins.installBridgeHooks(async function () {
      await renderBalance();
      renderProfit();
    });
  }
  await renderBalance();
  renderInputs();
  // restore last roll position if any history exists
  const s = await LinkupAPI.getState();
  if (s.history.length) {
    const last = s.history[0];
    el.diceResult.textContent = last.roll.toFixed(2);
    el.diceCube.style.left = last.roll + '%';
    el.diceCube.classList.remove('hidden');
    el.diceCube.classList.add(last.won ? 'win' : 'loss');
  }
})();
