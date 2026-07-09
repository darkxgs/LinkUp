// input.js - Event listeners for user input

function setupInputs() {
    // Wager actions
    document.getElementById('p1-ready').addEventListener('click', () => {
        if (!GameState.opponentConnected) return; // Can't ready up if no opponent
        if (window.sfx) window.sfx.playTick();
        
        GameState.p1Ready = !GameState.p1Ready;
        updateUI();
        
        // Mock opponent getting ready slightly after you do
        if (GameState.p1Ready) {
            setTimeout(() => {
                // If you are still ready, opponent joins
                if (GameState.p1Ready && GameState.currentState === STATES.WAGER) {
                    GameState.p2Ready = true;
                    if (window.sfx) window.sfx.playShoot();
                    checkWagerReady(); // triggers transition to P1_PICKING if balance is ok
                }
            }, 800);
        } else {
            GameState.p2Ready = false; // Opponent unreadies if you do
            updateUI();
        }
    });

    const betInput = document.getElementById('custom-bet-input');
    betInput.addEventListener('input', (e) => {
        GameState.betAmount = parseInt(e.target.value) || 0;
        // Cancel ready states if bet changes
        GameState.p1Ready = false;
        GameState.p2Ready = false;
        updateUI();
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (window.sfx) window.sfx.playChip();
            GameState.betAmount += parseInt(e.target.dataset.bet);
            // Cancel ready states if bet changes
            GameState.p1Ready = false;
            GameState.p2Ready = false;
            updateUI();
        });
    });

    document.getElementById('btn-clear-bet').addEventListener('click', () => {
        if (window.sfx) window.sfx.playTick();
        GameState.betAmount = 1;
        GameState.p1Ready = false;
        GameState.p2Ready = false;
        updateUI();
    });

    document.getElementById('btn-max-bet').addEventListener('click', () => {
        if (window.sfx) window.sfx.playChip();
        const p1Bal = wallet.getBalance('p1');
        const p2Bal = wallet.getBalance('p2');
        GameState.betAmount = Math.min(p1Bal, p2Bal); // Max possible bet both can afford
        GameState.p1Ready = false;
        GameState.p2Ready = false;
        updateUI();
    });

    // Pick actions
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (window.sfx) window.sfx.playTick();
            const choice = e.currentTarget.dataset.choice;
            // Always P1 for the local user in online mode mock
            transport.submitPick('p1', choice);
        });
    });

    // Result screen
    document.getElementById('btn-next-round').addEventListener('click', () => {
        if (window.sfx) window.sfx.playTick();
        if (GameState.currentState === STATES.ROUND_RESULT) {
            GameState.currentState = STATES.P1_PICKING;
            GameState.resetRound();
            updateUI();
        }
    });

    // End match actions
    document.getElementById('btn-rematch').addEventListener('click', () => {
        if (window.sfx) window.sfx.playTick();
        GameState.resetMatch();
        updateUI();
    });

    document.getElementById('btn-main-menu').addEventListener('click', () => {
        if (window.sfx) window.sfx.playTick();
        // Fully reset including opponent connection
        GameState.resetMatch();
        GameState.opponentConnected = false;
        GameState.opponentName = "Finding...";
        updateUI();
        simulateOpponentJoin(); // Restart the join flow
    });
}
