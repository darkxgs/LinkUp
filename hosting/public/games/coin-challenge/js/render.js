// render.js - UI rendering logic

function updateUI() {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const activeScreenId = getScreenIdForState(GameState.currentState);
    const activeScreen = document.getElementById(activeScreenId);
    if (activeScreen) {
        activeScreen.classList.remove('hidden');
        // small delay for transition
        setTimeout(() => activeScreen.classList.add('active'), 50);
    }

    // Update specific screen data
    switch (GameState.currentState) {
        case STATES.WAGER:
            renderWagerScreen();
            break;
        case STATES.P1_PICKING:
            renderPickScreen();
            break;
        case STATES.WAITING_FOR_OPPONENT:
            break;
        case STATES.REVEALING:
            break;
        case STATES.ROUND_RESULT:
            break;
        case STATES.MATCH_OVER:
            renderMatchEndScreen();
            break;
    }
}

function getScreenIdForState(state) {
    switch (state) {
        case STATES.WAGER: return 'screen-wager';
        case STATES.P1_PICKING: return 'screen-pick';
        case STATES.WAITING_FOR_OPPONENT: return 'screen-waiting';
        case STATES.REVEALING: 
        case STATES.ROUND_RESULT: return 'screen-reveal';
        case STATES.MATCH_OVER: return 'screen-match-end';
        default: return 'screen-wager';
    }
}

function renderWagerScreen() {
    document.getElementById('p1-balance').innerText = `$${wallet.getBalance('p1')}`;
    document.getElementById('p2-balance').innerText = `$${wallet.getBalance('p2')}`;
    
    const betInput = document.getElementById('custom-bet-input');
    // Always sync the value if it differs from the internal state
    if (betInput.value !== String(GameState.betAmount)) {
        betInput.value = GameState.betAmount;
    }

    const p1Btn = document.getElementById('p1-ready');
    const p2Status = document.getElementById('p2-ready-status');
    const p2Avatar = document.getElementById('p2-avatar');
    const p2Placeholder = document.getElementById('p2-avatar-placeholder');
    const p2Name = document.getElementById('p2-name');
    
    // Opponent Connection State
    p2Name.innerText = GameState.opponentName;
    if (GameState.opponentConnected) {
        p2Avatar.classList.remove('hidden');
        p2Placeholder.classList.add('hidden');
        p2Avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${GameState.opponentAvatarSeed}`;
    } else {
        p2Avatar.classList.add('hidden');
        p2Placeholder.classList.remove('hidden');
    }

    if (GameState.p1Ready) {
        p1Btn.classList.add('is-ready');
        p1Btn.innerText = 'Ready!';
    } else {
        p1Btn.classList.remove('is-ready');
        p1Btn.innerText = 'Ready';
    }

    if (!GameState.opponentConnected) {
        p2Status.innerText = 'Waiting to join...';
        p2Status.classList.remove('is-ready');
    } else if (GameState.p2Ready) {
        p2Status.classList.add('is-ready');
        p2Status.innerText = 'Ready!';
    } else {
        p2Status.classList.remove('is-ready');
        p2Status.innerText = 'Waiting...';
    }
}

function renderPickScreen() {
    document.getElementById('current-player-balance').innerText = `$${wallet.getBalance('p1')}`;
    document.getElementById('current-pot').innerText = GameState.pot;
    
    document.getElementById('p2-pick-name').innerText = GameState.opponentName;
    document.getElementById('p2-pick-balance').innerText = `$${wallet.getBalance('p2')}`;
    document.getElementById('p2-pick-avatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${GameState.opponentAvatarSeed}`;

    // Update round dots
    updateScoreDots('p1', GameState.p1Wins);
    updateScoreDots('p2', GameState.p2Wins);
}

function updateScoreDots(player, wins) {
    document.getElementById(`score-${player}-1`).classList.toggle('won', wins >= 1);
    document.getElementById(`score-${player}-2`).classList.toggle('won', wins >= 2);
}

function renderMatchEndScreen() {
    const isP1Win = GameState.p1Wins >= ROUNDS_TO_WIN;
    const winnerText = isP1Win ? 'You Win!' : `${GameState.opponentName} Wins!`;
    document.getElementById('match-winner-text').innerText = winnerText;
    document.getElementById('match-winnings-text').innerText = isP1Win ? `+${GameState.pot} Coins` : `-${GameState.betAmount} Coins`;
    document.getElementById('match-winner-avatar').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${isP1Win ? 'You' : GameState.opponentAvatarSeed}`;
    
    // Change winnings color based on win/loss
    const winningsEl = document.getElementById('match-winnings-text');
    if (isP1Win) {
        winningsEl.style.color = 'var(--success)';
    } else {
        winningsEl.style.color = 'var(--danger)';
    }
}

// Global hook for transport
window.updateUI = updateUI;
