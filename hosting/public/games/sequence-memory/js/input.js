function setupInput(state, render) {
  // Bet selection click handlers
  document.addEventListener('click', (e) => {
    const betButton = e.target.closest('[data-bet]');
    if (betButton && state.state === STATES.BET_SELECT) {
      const bet = parseInt(betButton.dataset.bet, 10);
      state.selectBet(bet);
    }
  });

  // Reconstruct phase tile clicks
  document.addEventListener('click', (e) => {
    if (state.state !== STATES.RECONSTRUCT_PHASE) return;

    // Clicked a tile in the shuffled pool -> Place it in the answer track
    const poolTile = e.target.closest('#pool-container .tile-card');
    if (poolTile) {
      const tileId = poolTile.dataset.id;
      state.placeTile(tileId);
      return;
    }

    // Clicked a tile in the answer track -> Undo/Return it to pool
    const answerTile = e.target.closest('#answer-container .tile-card');
    if (answerTile) {
      const tileId = answerTile.dataset.id;
      state.removeTile(tileId);
      return;
    }
  });

  // Submit button
  document.addEventListener('click', (e) => {
    const submitBtn = e.target.closest('#submit-btn');
    if (submitBtn && state.state === STATES.RECONSTRUCT_PHASE) {
      state.resolveGame();
    }
  });

  // Restart / Go Back Button (from Result screen)
  document.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('#reset-btn, #restart-btn');
    if (resetBtn) {
      state.reset();
    }
  });

  // Accessibility toggle
  document.addEventListener('change', (e) => {
    if (e.target.id === 'accessibility-toggle') {
      localStorage.setItem('accessibility_labels', e.target.checked);
      render(state);
    }
  });
}
