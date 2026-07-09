// =============================================================================
// main.js — Entry point. Wires the modules together and owns the render loop,
// the menu/wager flow, the HUD, banners, the shot clock, and the result screen.
//
// ►► THE ONE FLAG THAT FLIPS TO ONLINE PLAY ◄◄
//    IS_LOCAL_HOTSEAT = true  → both players share this device; LocalTransport
//    feeds each shot straight back into the same game, and LocalBalanceProvider
//    holds both balances in memory.
//
//    To go online you change essentially three lines (all below):
//      1. transport: new LocalTransport()  → new SocketTransport(socket, oppId)
//      2. wallet:    new LocalBalanceProvider() → new RemoteBalanceProvider(api)
//      3. set IS_LOCAL_HOTSEAT = false and supply this client's playerId.
//    state.js / rules.js / physics.js / render.js / input.js stay untouched,
//    because a shot is just {angle, power} and balances live behind an interface.
// =============================================================================

// Uses globals defined by the scripts loaded before this one (see index.html):
//   state.js:  GameState, Phase
//   render.js: Renderer
//   input.js:  InputController
//   transport.js: LocalTransport
//   wallet.js: LocalBalanceProvider, WALLET_CONFIG

const IS_LOCAL_HOTSEAT = true; // ← the multiplayer seam (see header).
const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const TARGET_RENDER_FPS = IS_TOUCH_DEVICE ? 45 : 60;
const TARGET_RENDER_FRAME_MS = 1000 / TARGET_RENDER_FPS;
let linkupChallenge = null;
let linkupRole = 'challenger';
let linkupGlobal = null;
let didAutoStart = false;
let gameOverSent = false;
let challengeCurrencyMode = false;
let suppressOutgoingStateSync = false;
let lastChallengeSyncKey = '';
let lastRenderAt = 0;
let lastTimerSyncSecond = -1;
let shotSeq = 0;
let lastLocalShotSeq = 0;
let lastAppliedShotSeq = 0;

function tr(key, vars) {
  return window.ChallengeI18n ? window.ChallengeI18n.t(key, vars) : key;
}

function trMsg(msg) {
  return window.ChallengeI18n
    ? window.ChallengeI18n.trRuleMessage(msg, { names: state.names })
    : msg;
}

function applyChallengeLocale(locale) {
  if (locale && window.ChallengeI18n) {
    window.ChallengeI18n.setLang(locale);
    document.querySelectorAll('.coin-icon').forEach((img) => {
      img.alt = tr('coinAlt');
    });
  }
}

// ساعة المباراة الكلية لكل لاعب (7 دقائق افتراضياً — تُحدَّث من إعدادات التطبيق)
let PLAYER_TOTAL_SECONDS = 420;
let clockId = null;
let playerRemaining = { 0: PLAYER_TOTAL_SECONDS, 1: PLAYER_TOTAL_SECONDS };
function resetMatchTimers() {
  playerRemaining = { 0: PLAYER_TOTAL_SECONDS, 1: PLAYER_TOTAL_SECONDS };
}

function postToApp(payload) {
  if (window.ChallengeDemoBridge) {
    window.ChallengeDemoBridge.postToApp(payload);
  }
}

function challengeUidForPlayer(playerIndex) {
  if (!linkupChallenge) return '';
  return playerIndex === 0 ? linkupChallenge.challengerId : linkupChallenge.challengedId;
}

function isOnlineChallenge() {
  return Boolean(linkupChallenge);
}

function myPlayerIndex() {
  if (!isOnlineChallenge()) return state.currentPlayer;
  return linkupRole === 'challenger' ? 0 : 1;
}

function canLocalPlayerAct() {
  if (!isOnlineChallenge()) return true;
  return myPlayerIndex() === state.currentPlayer && state.phase === Phase.AIMING;
}

function applyGlobalConfig(global) {
  const ms = Number(global?.billiardsTurnMs);
  if (ms > 0) {
    PLAYER_TOTAL_SECONDS = Math.floor(ms / 1000);
    resetMatchTimers();
  }
}

function buildChallengeStateSnapshot(reason = '', lastShot = null) {
  const ballsLeft = state.balls.filter((b) => !b.potted && b.num !== 0).length;
  return {
    challengerTime: playerRemaining[0] * 1000,
    opponentTime: playerRemaining[1] * 1000,
    currentTurnStartedAt: Date.now(),
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    ballsLeft,
    reason,
    shotSeq,
    lastShot: lastShot ? { angle: lastShot.angle, power: lastShot.power } : null,
    bet: state.bet,
    pot: state.pot,
    names: { ...state.names },
    groups: { ...state.groups },
    ballInHand: state.ballInHand,
    eightCall: state.eightCall,
    isBreak: state.isBreak,
    winner: state.winner,
    balls: state.balls.map((b) => ({
      id: b.id,
      num: b.num,
      x: b.x,
      y: b.y,
      potted: !!b.potted,
      pocket: b.pocket ?? null,
    })),
  };
}

function applyBallPositions(remoteBalls) {
  if (!Array.isArray(remoteBalls) || !remoteBalls.length) return;
  if (!state.balls.length) {
    state.balls = remoteBalls.map((rb) => ({
      id: rb.id,
      num: rb.num,
      x: rb.x,
      y: rb.y,
      potted: !!rb.potted,
      pocket: rb.pocket ?? null,
      vx: 0,
      vy: 0,
    }));
  } else {
    for (const rb of remoteBalls) {
      const b = state.balls.find((x) => x.id === rb.id);
      if (b) {
        b.x = rb.x;
        b.y = rb.y;
        b.potted = !!rb.potted;
        b.pocket = rb.pocket ?? null;
        b.vx = 0;
        b.vy = 0;
      }
    }
  }
}

function mergeRemoteMeta(remote) {
  if (remote.names) {
    names[0] = remote.names[0] || names[0];
    names[1] = remote.names[1] || names[1];
    state.names = { 0: names[0], 1: names[1] };
  }
  if (remote.bet != null) state.bet = remote.bet;
  if (remote.pot != null) state.pot = remote.pot;
  if (remote.groups) state.groups = { ...remote.groups };
  if (remote.ballInHand != null) state.ballInHand = remote.ballInHand;
  if (remote.eightCall !== undefined) state.eightCall = remote.eightCall;
  if (remote.isBreak != null) state.isBreak = remote.isBreak;
  if (typeof remote.challengerTime === 'number') {
    playerRemaining[0] = Math.max(0, Math.ceil(remote.challengerTime / 1000));
  }
  if (typeof remote.opponentTime === 'number') {
    playerRemaining[1] = Math.max(0, Math.ceil(remote.opponentTime / 1000));
  }
}

function applyRemoteState(remote) {
  if (!remote || typeof remote !== 'object') return;

  const seq = Number(remote.shotSeq) || 0;
  const reason = remote.reason || '';

  // تجاهل echo الضربة التي أرسلناها للتو
  if (reason === 'shot-fired' && seq === lastLocalShotSeq) return;

  if (!renderer) {
    showScreen('game');
    setupGame();
  }

  // إعادة تشغيل الضربة محلياً — فيزياء حتمية = نفس الحركة على الجهازين
  if (reason === 'shot-fired' && remote.lastShot && seq > lastAppliedShotSeq) {
    lastAppliedShotSeq = seq;
    suppressOutgoingStateSync = true;
    mergeRemoteMeta(remote);
    if (remote.currentPlayer != null) state.currentPlayer = remote.currentPlayer;
    applyBallPositions(remote.balls);
    stopShotClock();
    state.applyShot(remote.lastShot);
    suppressOutgoingStateSync = false;
    syncHud();
    updateClockUI();
    return;
  }

  // لا تقطّع أنيميشن الضربة الجارية
  if (
    state.phase === Phase.SHOT_IN_PROGRESS &&
    reason !== 'shot-resolved' &&
    remote.phase === Phase.SHOT_IN_PROGRESS
  ) {
    return;
  }

  if (seq < lastAppliedShotSeq && reason !== 'shot-resolved' && remote.phase !== Phase.GAME_OVER) {
    return;
  }

  suppressOutgoingStateSync = true;
  mergeRemoteMeta(remote);
  if (remote.currentPlayer != null) state.currentPlayer = remote.currentPlayer;
  applyBallPositions(remote.balls);

  if (remote.phase) {
    state.phase = remote.phase;
    if (remote.phase === Phase.GAME_OVER && remote.winner != null) {
      state.winner = remote.winner;
      lastAppliedShotSeq = Math.max(lastAppliedShotSeq, seq);
      stopShotClock();
      showResult(remote.winner, state.pot, [tr('billMatchEnded')]);
      suppressOutgoingStateSync = false;
      return;
    }
  }

  if (reason === 'shot-resolved' || reason === 'turn-start' || reason === 'match-start') {
    lastAppliedShotSeq = Math.max(lastAppliedShotSeq, seq);
  }

  syncHud();
  updateClockUI();
  if (renderer) renderer.draw();
  if (reason === 'turn-start' && state.phase === Phase.AIMING) {
    startShotClock();
  }
  suppressOutgoingStateSync = false;
}

function syncMoveToApp(reason = '', lastShot = null) {
  if (!linkupChallenge) return;
  if (suppressOutgoingStateSync) return;
  if (state.phase === Phase.GAME_OVER && reason !== 'shot-resolved') return;

  const gameState = buildChallengeStateSnapshot(reason, lastShot);
  if (reason !== 'shot-fired') {
    const key = JSON.stringify(gameState);
    if (key === lastChallengeSyncKey) return;
    lastChallengeSyncKey = key;
  }

  postToApp({
    type: 'MAKE_MOVE',
    gameState,
    nextTurn: challengeUidForPlayer(state.currentPlayer),
  });
}

const wallet = new LocalBalanceProvider();      // swap → RemoteBalanceProvider
const transport = new LocalTransport();          // swap → SocketTransport
const state = new GameState();

// Global settings state
window.gameSettings = { sensitivity: 0.5 };

// In online play this would be THIS client's id; in hot-seat the "local player"
// is always whoever's turn it is.
const localPlayerId = () => (IS_LOCAL_HOTSEAT ? state.currentPlayer : 0);

// Transport receives a shot and applies it to the authoritative game state.
// (Identical path for local hot-seat and a future networked opponent.)
transport.onShotReceived((shot) => state.applyShot(shot));

// ---- DOM references ----------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const screens = {
  menu: $('#menu-screen'),
  game: $('#game-screen'),
  result: $('#result-screen'),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// =============================================================================
// WAGER / MENU SCREEN
// =============================================================================
const ready = { 0: false, 1: false };
const names = { 0: tr('player1'), 1: tr('player2') };
let currentBet = 100;

function refreshMenu() {
  $$('[data-balance]').forEach((el) => {
    el.textContent = wallet.getBalance(Number(el.dataset.balance));
  });
  $('#pot-preview').textContent = currentBet * 2;
  $('#rake-note').textContent = WALLET_CONFIG.RAKE_PERCENT > 0
    ? `House rake: ${WALLET_CONFIG.RAKE_PERCENT}%`
    : '';

  // Start enabled only when both ready and both can afford the bet.
  const affordable = wallet.getBalance(0) >= currentBet && wallet.getBalance(1) >= currentBet;
  const ok = ready[0] && ready[1] && affordable && currentBet > 0;
  $('#start-btn').disabled = !ok;
}

$('#bet-input').addEventListener('input', (e) => {
  currentBet = Math.max(0, Math.floor(Number(e.target.value) || 0));
  refreshMenu();
});
$$('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    currentBet = Number(chip.dataset.chip);
    $('#bet-input').value = currentBet;
    refreshMenu();
  });
});
$$('.ready-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = Number(btn.dataset.ready);
    ready[id] = !ready[id];
    btn.classList.toggle('on', ready[id]);
    btn.textContent = ready[id] ? 'Ready ✓' : 'Ready';
    refreshMenu();
  });
});
$$('.name-input').forEach((inp) => {
  inp.addEventListener('input', () => {
    names[Number(inp.dataset.name)] = inp.value || `Player ${Number(inp.dataset.name) + 1}`;
  });
});

$('#start-btn').addEventListener('click', startMatch);

function startMatch() {
  // Place wagers through the BalanceProvider interface (real wallet later).
  if (!wallet.placeWager(0, currentBet) || !wallet.placeWager(1, currentBet)) {
    // Roll back if the second wager failed.
    return;
  }
  const pot = currentBet * 2;
  resetMatchTimers();

  state.startMatch({ names: { ...names }, bet: currentBet, pot });
  syncMoveToApp('match-start');
  showScreen('game');
  setupGame();
  syncHud();
  banner(tr('billBreaks', { name: names[0] }), 1600);
}

// =============================================================================
// GAME SCREEN setup
// =============================================================================
let renderer, input, rafId;
let pendingEightCall = false; // true while we wait for the player to call a pocket

function setupGame() {
  const canvas = $('#table');
  renderer = new Renderer(canvas, state);
  input = new InputController(canvas, state, renderer, {
    onShot: handleLocalShot,
    onCallPocket: handlePocketCalled,
    canInteract: () => canLocalPlayerAct(),
  });

  window.addEventListener('resize', () => renderer.resize());

  if (!rafId) loop();
  startShotClock();
  
  if (input) input._publishAim();
}

// A local player took a shot. If they're on the 8-ball they must call first.
function handleLocalShot(shot) {
  if (!canLocalPlayerAct()) return;
  if (state.phase !== Phase.AIMING) return;

  if (state.isOn8Ball() && !state.eightCall) {
    // Hold the shot until a pocket is called.
    pendingShot = shot;
    pendingEightCall = true;
    renderer.aim = null;
    input.enableCallPocketMode(true);
    $('#call-pocket-hint').classList.remove('hidden');
    banner(tr('billCallPocket'), 1400);
    return;
  }

  fireShot(shot);
}

let pendingShot = null;

function handlePocketCalled(pocketId) {
  if (!pendingEightCall) return;
  state.eightCall = { player: state.currentPlayer, pocketId };
  renderer.calledPocket = pocketId;
  pendingEightCall = false;
  input.enableCallPocketMode(false);
  $('#call-pocket-hint').classList.add('hidden');
  if (pendingShot) {
    const s = pendingShot; pendingShot = null;
    fireShot(s);
  }
}

// Route every shot through the transport — the seam that becomes the network.
function fireShot(shot) {
  stopShotClock();
  shotSeq += 1;
  lastLocalShotSeq = shotSeq;
  transport.sendShot(shot);
  if (linkupChallenge) {
    syncMoveToApp('shot-fired', shot);
  }
}

// =============================================================================
// RENDER + REPLAY LOOP (target 60fps)
// =============================================================================
let lastTime = 0;
let replayAccumulator = 0;
const REPLAY_MS_PER_FRAME = 1000 / 60; // 60fps recorded frames

function loop(time) {
  if (!lastTime) lastTime = time;
  const dt = time - lastTime;
  lastTime = time;

  if (state.phase === Phase.SHOT_IN_PROGRESS) {
    replayAccumulator += dt;
    // Cap accumulator to avoid huge jumps if tab was inactive
    if (replayAccumulator > 100) replayAccumulator = 100;
    while (replayAccumulator >= REPLAY_MS_PER_FRAME) {
      state.advanceReplay();
      replayAccumulator -= REPLAY_MS_PER_FRAME;
    }
  } else {
    replayAccumulator = 0;
  }

  // Power meter mirrors the live aim drag.
  const power = renderer.aim ? renderer.aim.power : 0;
  $('#power-fill').style.height = (power * 100) + '%';
  const cue = $('#power-cue');
  if (cue) cue.style.bottom = `-${power * 100}%`;
  
  // Draw at capped FPS on touch devices for smoother and lighter gameplay.
  const shouldDraw = !lastRenderAt || (time - lastRenderAt) >= TARGET_RENDER_FRAME_MS || state.phase === Phase.SHOT_IN_PROGRESS;
  if (shouldDraw) {
    lastRenderAt = time;
    renderer.draw();
  }
  rafId = requestAnimationFrame(loop);
}

// =============================================================================
// STATE EVENT SUBSCRIPTIONS → HUD / banners / result
// =============================================================================
state.on('turnStart', ({ player, ballInHand, continued }) => {
  syncHud();
  renderer && (renderer.calledPocket = null);
  if (continued) {
    banner(tr('billKeepShooting'), 1500);
  } else if (ballInHand) {
    banner(tr('billBallInHand'), 2000);
  } else {
    banner(tr('billYourTurn'), 1500);
  }
  if (state.isOn8Ball(player)) {
    setTimeout(() => {
      banner(tr('billSinkEight'), 2200);
    }, 1600);
  }
  startShotClock();
  
  // Make sure cue stick is visible immediately
  if (input) {
    input.currentPower = 0;
    input._publishAim();
  }
  syncMoveToApp('turn-start');
});

state.on('groupsAssigned', (groups) => {
  syncHud();
  const myGroup = groups[state.currentPlayer];
  if (myGroup) {
    banner(myGroup === 'solid' ? tr('billYouAreSolids') : tr('billYouAreStripes'), 2500);
  }
});

state.on('shotResolved', ({ verdict }) => {
  if (verdict.foul && !verdict.gameOver) {
    const reason = verdict.foulReason
      ? (window.ChallengeI18n ? window.ChallengeI18n.trFoulReason(verdict.foulReason) : verdict.foulReason)
      : '';
    if (verdict.foulReason === 'foulCueScratch') {
      banner(tr('billScratch'), 2500);
    } else {
      banner(tr('billFoul', { reason }), 2000);
    }
  }
  if (verdict.messages && verdict.messages.length) {
    const last = verdict.messages[verdict.messages.length - 1];
    const text = trMsg(last);
    if (text && text !== last) banner(text, 1800);
  }
  syncHud();
  syncMoveToApp('shot-resolved');
});

state.on('gameOver', ({ winner, messages }) => {
  stopShotClock();
  // Settle the pot through the BalanceProvider interface.
  const { payout } = wallet.settle(winner, state.pot) || { payout: state.pot };
  showResult(winner, payout, messages);
  if (linkupChallenge && !gameOverSent) {
    gameOverSent = true;
    const winnerId = winner === 0 ? linkupChallenge.challengerId : linkupChallenge.challengedId;
    postToApp({
      type: 'GAME_OVER',
      winnerId,
      log: { game: 'billiards', reason: 'table-finish' },
    });
  }
});

// =============================================================================
// HUD
// =============================================================================
function syncHudAvatars() {
  if (!linkupChallenge) return;
  const urls = [
    linkupChallenge.challengerAvatar || '',
    linkupChallenge.challengedAvatar || '',
  ];
  for (const id of [0, 1]) {
    const wrap = document.querySelector(`[data-hud-avatar="${id}"]`);
    if (!wrap) continue;

    let img = wrap.querySelector('.hud-avatar-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'hud-avatar-img';
      img.alt = '';
      wrap.insertBefore(img, wrap.firstChild);
    }

    const url = urls[id];
    const fb = wrap.querySelector('.hud-avatar-fallback');
    if (url) {
      img.src = url;
      img.onerror = () => {
        wrap.classList.remove('has-photo');
        img.style.display = 'none';
        if (fb) {
          fb.style.display = 'grid';
          fb.textContent = (state.names[id] || `P${id + 1}`)[0];
        }
      };
      wrap.classList.add('has-photo');
      img.style.display = 'block';
      if (fb) fb.style.display = 'none';
    } else {
      wrap.classList.remove('has-photo');
      img.style.display = 'none';
      if (fb) {
        fb.style.display = 'grid';
        fb.textContent = (state.names[id] || `P${id + 1}`)[0];
      }
    }
  }
}

function syncHud() {
  for (const id of [0, 1]) {
    $(`[data-hud-name="${id}"]`).textContent = state.names[id];
    $(`[data-hud-balance="${id}"]`).textContent = wallet.getBalance(id);
    const g = state.groups[id];
    const icon = $(`[data-group="${id}"]`);
    icon.className = 'group-icon' + (g ? ' ' + g : '');
    icon.textContent = g === 'solid' ? '●' : g === 'stripe' ? '◐' : '';
  }
  $('#hud-pot').textContent = state.pot;
  $('#hud-p0').classList.toggle('active', state.currentPlayer === 0);
  $('#hud-p1').classList.toggle('active', state.currentPlayer === 1);
  syncHudAvatars();

  const pm = $('#power-meter-area');
  if (pm) {
    const canAct = canLocalPlayerAct();
    pm.style.opacity = canAct ? '1' : '0.3';
    pm.style.pointerEvents = canAct ? 'auto' : 'none';
  }
}

// =============================================================================
// BANNER toast
// =============================================================================
let bannerTimer = null;
function banner(text, ms = 1500) {
  const el = $('#banner');
  // Reset animation
  el.classList.remove('show');
  void el.offsetWidth; // trigger reflow
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// =============================================================================
// Total match clock per player (scenario): 7 minutes each (420s).
// =============================================================================
function startShotClock() {
  stopShotClock();
  lastTimerSyncSecond = -1;
  updateClockUI();
  clockId = setInterval(() => {
    const p = state.currentPlayer;
    playerRemaining[p] = Math.max(0, playerRemaining[p] - 1);
    updateClockUI();
    // Avoid posting every second; sync key timer moments only.
    if (playerRemaining[p] !== lastTimerSyncSecond && (playerRemaining[p] % 5 === 0 || playerRemaining[p] <= 20)) {
      lastTimerSyncSecond = playerRemaining[p];
      syncMoveToApp('timer-tick');
    }
    if (playerRemaining[p] <= 0) {
      stopShotClock();
      const winner = p === 0 ? 1 : 0;
      state.phase = Phase.GAME_OVER;
      state.emit('gameOver', { winner, messages: [tr('billTimeExpired')] });
    }
  }, 1000);
}
function stopShotClock() { if (clockId) { clearInterval(clockId); clockId = null; } }
function updateClockUI() {
  for (const id of [0, 1]) {
    const isTurn = state.currentPlayer === id;
    const text = $(`#timer-text-${id}`);
    const val = $(`#timer-val-${id}`);
    const sec = Math.max(0, playerRemaining[id]);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const pct = Math.max(0, sec / PLAYER_TOTAL_SECONDS);
    if (text && val) {
      text.textContent = `${mm}:${ss}`;
      if (isTurn) {
        const dasharray = 163.36; // 2 * pi * 26
        val.style.strokeDashoffset = dasharray - (pct * dasharray);
        val.classList.toggle('danger', sec <= 30);
      } else {
        val.style.strokeDashoffset = 163.36;
        val.classList.remove('danger');
      }
    }
  }
}

// =============================================================================
// RESULT SCREEN
// =============================================================================
function showResult(winner, payout, messages) {
  showScreen('result');
  const loser = winner === 0 ? 1 : 0;
  $('#result-title').textContent = tr('playerWins', { name: state.names[winner] });
  const coinImg = '<img class="coin-icon" src="/images/coin-gold.png?v=4" alt="' + tr('coinAlt') + '" />';
  $('#result-amount').innerHTML =
    '<div>' + tr('payoutWin', { name: state.names[winner], amount: payout }) + ' ' + coinImg + '</div>' +
    '<div>' + tr('payoutLose', { name: state.names[loser], amount: state.bet }) + ' ' + coinImg + '</div>';
  $$('#result-screen [data-balance]').forEach((el) => {
    el.textContent = wallet.getBalance(Number(el.dataset.balance));
  });
}

$('#rematch-btn').addEventListener('click', () => {
  // Re-wager the same bet if both can afford it; else back to menu.
  if (wallet.getBalance(0) >= state.bet && wallet.getBalance(1) >= state.bet && state.bet > 0) {
    wallet.placeWager(0, state.bet);
    wallet.placeWager(1, state.bet);
    resetMatchTimers();
    state.startMatch({ names: state.names, bet: state.bet, pot: state.bet * 2 });
    syncMoveToApp('rematch-start');
    showScreen('game');
    syncHud();
    startShotClock();
    banner(tr('billBreaks', { name: state.names[0] }), 1600);
  } else {
    backToMenu();
  }
});
$('#mainmenu-btn').addEventListener('click', backToMenu);

// =============================================================================
// NEW UI: MENU DROPDOWN, MODALS, CHAT
// =============================================================================
$('#menu-return').addEventListener('click', () => {
  $('#hamburger-dropdown').classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#menu-return') && !e.target.closest('#hamburger-dropdown')) {
    $('#hamburger-dropdown').classList.add('hidden');
  }
  if (!e.target.closest('#chat-btn') && !e.target.closest('#chat-tray')) {
    $('#chat-tray').classList.add('hidden');
  }
});

$('#btn-exit').addEventListener('click', () => {
  $('#hamburger-dropdown').classList.add('hidden');
  $('#forfeit-modal').classList.remove('hidden');
});
$('#btn-cancel-forfeit').addEventListener('click', () => {
  $('#forfeit-modal').classList.add('hidden');
});
$('#btn-confirm-forfeit').addEventListener('click', () => {
  $('#forfeit-modal').classList.add('hidden');
  const loser = state.currentPlayer;
  const winner = loser === 0 ? 1 : 0;
  state.phase = Phase.GAME_OVER;
  state.emit('gameOver', { winner: winner, messages: [`${state.names[loser]} forfeited the match!`] });
});

$('#btn-settings').addEventListener('click', () => {
  $('#hamburger-dropdown').classList.add('hidden');
  $('#settings-modal').classList.remove('hidden');
});
$('#btn-close-settings').addEventListener('click', () => {
  $('#settings-modal').classList.add('hidden');
});
$('#sens-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value).toFixed(1);
  $('#sens-val').textContent = val;
  window.gameSettings.sensitivity = parseFloat(val);
});

$('#chat-btn').addEventListener('click', () => {
  $('#chat-tray').classList.toggle('hidden');
});
$$('.chat-emoji').forEach(el => {
  el.addEventListener('click', () => {
    $('#chat-tray').classList.add('hidden');
    spawnEmoji(el.textContent);
  });
});

function spawnEmoji(char) {
  const container = $('#emoji-container');
  if (!container) return;
  const span = document.createElement('span');
  span.className = 'floating-emoji';
  span.textContent = char;
  
  if (state.currentPlayer === 1) {
    span.style.right = '20px';
  } else {
    span.style.left = '20px';
  }
  span.style.bottom = '10px';
  
  container.appendChild(span);
  setTimeout(() => span.remove(), 2000);
}

function backToMenu() {
  stopShotClock();
  resetMatchTimers();
  ready[0] = ready[1] = false;
  $$('.ready-btn').forEach((b) => { b.classList.remove('on'); b.textContent = 'Ready'; });
  showScreen('menu');
  refreshMenu();
}

function maybeAutoStartFromChallenge() {
  if (!linkupChallenge || didAutoStart) return;
  document.body.classList.add('challenge-embed');
  if (!challengeCurrencyMode) {
    challengeCurrencyMode = true;
    // Currency settlement is authoritative in Firestore/app for challenge mode.
    if (typeof wallet.placeWager === 'function') wallet.placeWager = () => true;
    if (typeof wallet.settle === 'function') {
      wallet.settle = () => ({ payout: 0, rake: 0 });
    }
    if (typeof wallet.getBalance === 'function') {
      wallet.getBalance = () => Number(linkupChallenge?.bet || 0);
    }
  }
  if (linkupGlobal) applyGlobalConfig(linkupGlobal);
  didAutoStart = true;
  gameOverSent = false;
  lastChallengeSyncKey = '';
  names[0] = linkupChallenge.challengerName || tr('player1');
  names[1] = linkupChallenge.challengedName || tr('player2');
  currentBet = Number(linkupChallenge.bet || currentBet || 100);
  $('#bet-input').value = currentBet;
  ready[0] = true;
  ready[1] = true;
  startMatch();
}

// ---- Boot -------------------------------------------------------------------
if (window.ChallengeDemoBridge) {
  window.ChallengeDemoBridge.install('pool');
  window.ChallengeDemoBridge.bindAppMessages((msg) => {
    if (msg.type !== 'INIT_DATA' && msg.type !== 'STATE_UPDATE') return;
    if (msg.locale) applyChallengeLocale(msg.locale);
    linkupChallenge = msg.challenge || null;
    linkupRole = msg.myRole || msg.role || linkupRole;
    if (msg.global) {
      linkupGlobal = msg.global;
      applyGlobalConfig(msg.global);
    }
    maybeAutoStartFromChallenge();
    syncHudAvatars();
    if (msg.challenge?.gameState && didAutoStart) {
      applyRemoteState(msg.challenge.gameState);
    }
  });
  postToApp({ type: 'INIT_GAME' });
}
refreshMenu();
showScreen('menu');
