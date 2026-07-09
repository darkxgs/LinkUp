// main.js - App entry point and workflow orchestration

const IS_LOCAL_HOTSEAT = true; // Config for future multiplayer transport

function simulateOpponentJoin() {
    setTimeout(() => {
        if (GameState.currentState === STATES.WAGER) {
            GameState.opponentName = "CasinoKing99";
            GameState.opponentConnected = true;
            if (window.sfx) window.sfx.playShoot(); // Notification sound
            updateUI();
        }
    }, 2000);
}

function checkWagerReady() {
    updateUI();
    if (GameState.p1Ready && GameState.p2Ready) {
        if (window.CasinoBridge && CasinoBridge.isEmbedded()) {
            wallet.placeEmbeddedWager(GameState.betAmount).then(function (ok) {
                if (!ok) return;
                GameState.pot = GameState.betAmount * 2;
                GameState.currentState = STATES.P1_PICKING;
                updateUI();
            }).catch(function (err) {
                GameState.p1Ready = false;
                GameState.p2Ready = false;
                alert(err.message || 'Insufficient balance!');
                updateUI();
            });
            return;
        }
        const p1Ok = wallet.placeWager('p1', GameState.betAmount);
        const p2Ok = wallet.placeWager('p2', GameState.betAmount);

        if (p1Ok && p2Ok) {
            GameState.pot = GameState.betAmount * 2;
            GameState.currentState = STATES.P1_PICKING;
            updateUI();
        } else {
            // Not enough balance, reset ready state
            if (!p1Ok) GameState.p1Ready = false;
            if (!p2Ok) GameState.p2Ready = false;
            alert("Insufficient balance!");
            updateUI();
        }
    }
}

const handIcons = {
    rock: '✊',
    paper: '🖐️',
    scissors: '✌️'
};

function playRevealAnimation(p1Pick, p2Pick) {
    GameState.currentState = STATES.REVEALING;
    updateUI();

    const countdownEl = document.getElementById('reveal-countdown');
    const p1Hand = document.getElementById('reveal-p1-hand');
    const p2Hand = document.getElementById('reveal-p2-hand');
    const resultText = document.getElementById('reveal-result-text');
    const nextBtn = document.getElementById('btn-next-round');

    // Reset UI for animation
    resultText.classList.add('hidden');
    nextBtn.classList.add('hidden');
    p1Hand.innerText = handIcons.rock;
    p2Hand.innerText = handIcons.rock;
    p1Hand.classList.add('shake');
    p2Hand.classList.add('shake');

    let count = 3;
    countdownEl.innerText = count;
    if (window.sfx) window.sfx.playTick();

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.innerText = count;
            if (window.sfx) window.sfx.playTick();
        } else if (count === 0) {
            countdownEl.innerText = 'Shoot!';
            if (window.sfx) window.sfx.playShoot();
            clearInterval(interval);
            
            // Reveal choices
            p1Hand.classList.remove('shake');
            p2Hand.classList.remove('shake');
            p1Hand.innerText = handIcons[p1Pick];
            p2Hand.innerText = handIcons[p2Pick];

            setTimeout(() => {
                resolveAndShowResult(p1Pick, p2Pick);
            }, 500);
        }
    }, 800);
}

function resolveAndShowResult(p1Pick, p2Pick) {
    const result = resolveRound(p1Pick, p2Pick);
    GameState.lastRoundResult = result;

    const resultText = document.getElementById('reveal-result-text');
    
    if (result === RESULTS.P1) {
        GameState.p1Wins++;
        resultText.innerText = "You Win the Round!";
        resultText.style.color = "var(--success)";
        if (window.sfx) window.sfx.playWin();
    } else if (result === RESULTS.P2) {
        GameState.p2Wins++;
        resultText.innerText = `${GameState.opponentName} Wins the Round!`;
        resultText.style.color = "var(--danger)";
        if (window.sfx) window.sfx.playLose();
    } else {
        resultText.innerText = "Tie - Replay!";
        resultText.style.color = "var(--pot-color)";
        if (window.sfx) window.sfx.playTick();
    }

    GameState.currentState = STATES.ROUND_RESULT;
    resultText.classList.remove('hidden');

    // Check match over
    const matchWinner = checkMatchWinner(GameState.p1Wins, GameState.p2Wins);
    
    if (matchWinner) {
        // Settle wallet
        wallet.settle(matchWinner, GameState.pot);
        
        setTimeout(() => {
            GameState.currentState = STATES.MATCH_OVER;
            updateUI();
            if (matchWinner === RESULTS.P1) {
                if (window.sfx) window.sfx.playWin();
            } else {
                if (window.sfx) window.sfx.playLose();
            }
        }, 2000);
    } else {
        document.getElementById('btn-next-round').classList.remove('hidden');
    }
}

// Wire up the transport callback
transport.onRoundReady((p1Pick, p2Pick) => {
    playRevealAnimation(p1Pick, p2Pick);
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupInputs();
    updateUI();
    simulateOpponentJoin();
});
