/* =============================================================================
 * main.js — entry point. Wires the swappable seams together and binds the
 * wager-screen + overlay buttons. The game loop itself is event-driven:
 * state changes -> render; taps -> input -> state; both picks in -> resolve.
 * ========================================================================== */

(function () {
  'use strict';
  let linkupChallenge = null;
  let linkupRole = 'challenger';
  let didAutoStart = false;
  let gameOverSent = false;
  let challengeCurrencyMode = false;

  function postToApp(payload) {
    if (window.ChallengeDemoBridge) {
      window.ChallengeDemoBridge.postToApp(payload);
    }
  }

  /**
   * >>> THE ONE FLAG THAT FLIPS LOCAL <-> ONLINE <<<
   * When true, both players share this device (pass-and-play) using
   * LocalTransport + LocalBalanceProvider. To go online you would:
   *   1. set this false,
   *   2. construct a SocketTransport (or WebRTC/Firebase) instead of LocalTransport,
   *   3. construct a RemoteBalanceProvider (real wallet API) instead of LocalBalanceProvider,
   *   4. supply remote player identity for P1/P2 instead of the hotseat names.
   * state.js, rules.js, render.js and input.js stay exactly as they are.
   */
  const IS_LOCAL_HOTSEAT = true;

  // ---- Construct the swappable layers -------------------------------------
  const wallet = IS_LOCAL_HOTSEAT
    ? new Wallet.LocalBalanceProvider({ P1: Wallet.STARTING_BALANCE, P2: Wallet.STARTING_BALANCE })
    : /* new RemoteBalanceProvider({ apiBaseUrl, authToken }) */ null;

  const transport = IS_LOCAL_HOTSEAT
    ? new Transport.LocalTransport()
    : /* new SocketTransport(socket, matchId) */ null;

  // ---- Core (never changes between local/online) ---------------------------
  const game = new State.GameState({ wallet, transport });
  const input = new Input.InputController(game);

  const renderer = new Render.Renderer({
    onZoneTap: (zone) => input.handleZoneTap(zone),
    onResultDone: () => game.advanceAfterResult(),
  });
  let suppressOutgoingStateSync = false;
  let lastSyncedStateKey = '';
  const TURN_SECONDS = 10;
  let turnTimerId = null;
  let turnRemaining = TURN_SECONDS;
  let latestState = null;
  let timedPhase = '';

  function stopTurnTimer() {
    if (turnTimerId) {
      clearInterval(turnTimerId);
      turnTimerId = null;
    }
    timedPhase = '';
  }

  function handleTurnTimeout() {
    const s = latestState;
    if (!s || s.phase === State.PHASE.MATCH_OVER) return;
    const kick = s.currentKick;
    // السيناريو: التأخر 10 ثوانٍ = خسارة الجولة الحالية
    if (s.phase === State.PHASE.SHOOTER_AIMING) {
      game.submitPick({ playerId: kick.shooter, role: 'SHOOTER', zone: 1 });
      if (game.phase === State.PHASE.HANDOFF) game.confirmHandoff();
      game.submitPick({ playerId: kick.keeper, role: 'KEEPER', zone: 1 });
    } else if (s.phase === State.PHASE.KEEPER_DIVING) {
      const shooterZone = typeof kick.shooterPick === 'number' ? kick.shooterPick : 1;
      const keeperZone = (shooterZone + 1) % 3;
      game.submitPick({ playerId: kick.keeper, role: 'KEEPER', zone: keeperZone });
    }
  }

  function syncTurnTimer(s) {
    const phase = s.phase;
    if (phase !== State.PHASE.SHOOTER_AIMING && phase !== State.PHASE.KEEPER_DIVING) {
      stopTurnTimer();
      return;
    }
    if (timedPhase !== phase) {
      stopTurnTimer();
      timedPhase = phase;
      turnRemaining = TURN_SECONDS;
      turnTimerId = setInterval(() => {
        turnRemaining -= 1;
        if (turnRemaining <= 0) {
          stopTurnTimer();
          handleTurnTimeout();
        }
      }, 1000);
    }
  }

  function challengeUidForPlayer(playerId) {
    if (!linkupChallenge) return '';
    return playerId === 'P1' ? linkupChallenge.challengerId : linkupChallenge.challengedId;
  }

  function nextTurnForState(s) {
    if (!s || !s.currentKick) return '';
    if (s.phase === State.PHASE.SHOOTER_AIMING || s.phase === State.PHASE.HANDOFF) {
      return challengeUidForPlayer(s.currentKick.shooter);
    }
    if (s.phase === State.PHASE.KEEPER_DIVING) {
      return challengeUidForPlayer(s.currentKick.keeper);
    }
    return '';
  }

  function buildChallengeStateSnapshot(s) {
    return {
      phase: s.phase,
      names: s.names,
      bet: s.bet,
      pot: s.pot,
      suddenDeath: s.suddenDeath,
      sdPair: s.sdPair,
      stats: s.stats,
      currentKick: s.currentKick,
      lastResult: s.lastResult,
      winner: s.winner,
      payout: s.payout,
    };
  }

  function syncMoveToApp(s) {
    if (!linkupChallenge) return;
    if (suppressOutgoingStateSync) return;
    if (s.phase === State.PHASE.MATCH_OVER) return;
    const gameState = buildChallengeStateSnapshot(s);
    const key = JSON.stringify(gameState);
    if (key === lastSyncedStateKey) return;
    lastSyncedStateKey = key;
    postToApp({
      type: 'MAKE_MOVE',
      gameState,
      nextTurn: nextTurnForState(s),
    });
  }

  function applyRemoteState(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') return;
    if (!('phase' in remoteState) || !('stats' in remoteState) || !('currentKick' in remoteState)) return;
    suppressOutgoingStateSync = true;
    game.phase = remoteState.phase;
    game.bet = remoteState.bet ?? game.bet;
    game.pot = remoteState.pot ?? game.pot;
    game.suddenDeath = !!remoteState.suddenDeath;
    game.sdPair = remoteState.sdPair || game.sdPair;
    game.stats = remoteState.stats || game.stats;
    game.currentKick = remoteState.currentKick || game.currentKick;
    game.lastResult = remoteState.lastResult ?? game.lastResult;
    game.winner = remoteState.winner ?? game.winner;
    game.payout = remoteState.payout ?? game.payout;
    if (remoteState.names) {
      game.names = { ...game.names, ...remoteState.names };
    }
    game._emit();
    suppressOutgoingStateSync = false;
  }

  // Redraw on every state change.
  game.subscribe((s) => {
    latestState = s;
    renderer.render(s);
    refreshWagerControls(s);
    syncTurnTimer(s);
    syncMoveToApp(s);
    if (s.phase === State.PHASE.MATCH_OVER && linkupChallenge && !gameOverSent) {
      gameOverSent = true;
      const winnerId = s.winner === null
        ? null
        : (s.winner === 'P1' ? linkupChallenge.challengerId : linkupChallenge.challengedId);
      postToApp({
        type: 'GAME_OVER',
        winnerId,
        log: { game: 'penalty-kick', score: `${s.stats.P1.goals}-${s.stats.P2.goals}` },
      });
    }
  });

  // ===========================================================================
  // Wager screen wiring
  // ===========================================================================
  const ready = { P1: false, P2: false };

  document.querySelectorAll('.name-input').forEach((inp) => {
    inp.addEventListener('input', () => game.setName(inp.dataset.player, inp.value.trim()));
  });

  document.querySelectorAll('.ready-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.player;
      ready[p] = !ready[p];
      btn.classList.toggle('ready', ready[p]);
      btn.textContent = ready[p] ? 'Ready ✓' : 'Ready';
      validateWager();
    });
  });

  const betInput = document.getElementById('bet-input');
  betInput.addEventListener('input', () => {
    game.setBet(parseInt(betInput.value, 10));
    validateWager();
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const amt = parseInt(chip.dataset.amount, 10);
      betInput.value = amt;
      game.setBet(amt);
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      validateWager();
    });
  });

  function validateWager() {
    const bet = game.bet;
    let err = '';
    if (bet <= 0) err = 'Enter a wager greater than 0.';
    else if (game.getBalance('P1') < bet || game.getBalance('P2') < bet) {
      err = 'A player has insufficient balance for this wager.';
    }
    renderer.setWagerError(err);
    const canStart = !err && ready.P1 && ready.P2;
    renderer.setStartEnabled(canStart);
    return canStart;
  }

  // Keep the Start button correct whenever we're on the wager screen
  // (e.g. after a rematch resets balances/ready toggles).
  function refreshWagerControls(s) {
    if (s.phase === State.PHASE.WAGER) validateWager();
  }

  document.getElementById('start-match').addEventListener('click', () => {
    if (!validateWager()) return;
    try {
      game.startMatch();
    } catch (e) {
      renderer.setWagerError(e.message);
    }
  });

  // ===========================================================================
  // In-match overlays
  // ===========================================================================
  document.getElementById('handoff-ready').addEventListener('click', () => {
    game.confirmHandoff();
  });

  document.getElementById('rematch-btn').addEventListener('click', () => {
    resetReady();
    game.rematch();
  });

  document.getElementById('menu-btn').addEventListener('click', () => {
    resetReady();
    game.toMenu();
  });

  function resetReady() {
    ready.P1 = false; ready.P2 = false;
    document.querySelectorAll('.ready-toggle').forEach((btn) => {
      btn.classList.remove('ready');
      btn.textContent = 'Ready';
    });
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  }

  function maybeAutoStartFromChallenge() {
    if (!linkupChallenge || didAutoStart) return;
    if (!challengeCurrencyMode) {
      challengeCurrencyMode = true;
      // Currency settlement is authoritative in Firestore/app for challenge mode.
      if (typeof wallet.placeWager === 'function') wallet.placeWager = () => 0;
      if (typeof wallet.settle === 'function') wallet.settle = () => 0;
      if (typeof wallet.getBalance === 'function') {
        wallet.getBalance = () => Number(linkupChallenge?.bet || 0);
      }
    }
    didAutoStart = true;
    gameOverSent = false;
    lastSyncedStateKey = '';
    game.setName('P1', linkupChallenge.challengerName || (window.ChallengeI18n ? window.ChallengeI18n.t('player1') : 'Player 1'));
    game.setName('P2', linkupChallenge.challengedName || (window.ChallengeI18n ? window.ChallengeI18n.t('player2') : 'Player 2'));
    game.setBet(Number(linkupChallenge.bet || game.bet || 100));
    ready.P1 = true;
    ready.P2 = true;
    try {
      game.startMatch();
    } catch (e) {
      renderer.setWagerError(e.message);
      didAutoStart = false;
      return;
    }
  }

  if (window.ChallengeDemoBridge) {
    document.body.classList.add('challenge-embed');
    Object.defineProperty(window, '__linkupChallengeRef', {
      get: () => linkupChallenge,
    });
    window.ChallengeDemoBridge.install('penalty-kicks');
    window.ChallengeDemoBridge.bindAppMessages((msg) => {
      if (msg.type !== 'INIT_DATA' && msg.type !== 'STATE_UPDATE') return;
      linkupChallenge = msg.challenge || null;
      linkupRole = msg.myRole || msg.role || linkupRole;
      if (msg.locale && window.ChallengeI18n) {
        window.ChallengeI18n.setLang(msg.locale);
      }
      maybeAutoStartFromChallenge();
      if (msg.challenge?.gameState && didAutoStart) {
        applyRemoteState(msg.challenge.gameState);
      }
    });
    postToApp({ type: 'INIT_GAME' });
  }

  // ---- Kick off ------------------------------------------------------------
  game._emit();      // initial paint
  validateWager();
})();
