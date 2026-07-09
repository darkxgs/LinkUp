/* =============================================================================
 * main.js — entry point. Wires the swappable seams together and binds the
 * wager-screen + overlay buttons. The game loop itself is event-driven:
 * state changes -> render; taps -> input -> state; both picks in -> resolve.
 * ========================================================================== */

(function () {
  'use strict';

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

  // Redraw on every state change.
  game.subscribe((s) => {
    renderer.render(s);
    refreshWagerControls(s);
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
      if (window.CasinoBridge && CasinoBridge.isEmbedded() && p === 'P1' && ready.P1) {
        ready.P2 = true;
        const p2btn = document.querySelector('.ready-toggle[data-player="P2"]');
        if (p2btn) {
          p2btn.classList.add('ready');
          p2btn.textContent = 'CPU ✓';
        }
      }
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
    const embedded = window.CasinoBridge && CasinoBridge.isEmbedded();
    let err = '';
    if (bet <= 0) err = 'Enter a wager greater than 0.';
    else if (embedded) {
      if (CasinoBridge.getBalance() < bet) err = 'Insufficient balance for this wager.';
    } else if (game.getBalance('P1') < bet || game.getBalance('P2') < bet) {
      err = 'A player has insufficient balance for this wager.';
    }
    renderer.setWagerError(err);
    const canStart = embedded
      ? !err && ready.P1
      : !err && ready.P1 && ready.P2;
    renderer.setStartEnabled(canStart);
    return canStart;
  }

  // Keep the Start button correct whenever we're on the wager screen
  // (e.g. after a rematch resets balances/ready toggles).
  function refreshWagerControls(s) {
    if (s.phase === State.PHASE.WAGER) validateWager();
  }

  document.getElementById('start-match').addEventListener('click', async () => {
    if (!validateWager()) return;
    if (window.CasinoBridge && CasinoBridge.isEmbedded()) {
      try {
        await CasinoBridge.placeBet(game.bet);
        game.startMatch(true);
      } catch (e) {
        renderer.setWagerError(e.message || 'Insufficient balance');
      }
      return;
    }
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

  // ---- Kick off ------------------------------------------------------------
  game._emit();      // initial paint
  validateWager();
})();
