import { COORDINATES_MAP, PLAYERS, STEP_LENGTH } from './constants.js';

const diceButtonElement = document.querySelector('#dice-btn');
const diceCubeElement = document.querySelector('#ludo-dice');
const diceValueElement = document.querySelector('.dice-value');
const undoButtonElement = document.querySelector('#undo-btn');
const DEFAULT_DICE_TRANSFORM = 'rotateX(-25deg) rotateY(35deg)';
const DICE_TRANSFORMS = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(90deg)',
    4: 'rotateX(0deg) rotateY(-90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
};

let diceAnimationTimeout = null;
const playerPiecesElements = {
    P1: document.querySelectorAll('[player-id="P1"].player-piece'),
    P2: document.querySelectorAll('[player-id="P2"].player-piece'),
}

const localPlayerLabelElement = document.querySelector('#local-player-label');
const roomCodeOutputElement = document.querySelector('#room-code-output');
const playersListElement = document.querySelector('#players-list');
const leaderboardListElement = document.querySelector('#leaderboard-list');
const systemMessageElement = document.querySelector('#system-message');
const leaderboardOverlayElement = document.querySelector('#leaderboard-overlay');
const leaderboardButtonElement = document.querySelector('#leaderboard-btn');
const leaderboardCloseElement = document.querySelector('#leaderboard-close-btn');

export class UI {
    static listenDiceClick(callback) {
        diceButtonElement.addEventListener('click', callback);
    }

    static listenResetClick(callback) {
        document.querySelector('button#reset-btn').addEventListener('click', callback)
    }

    static listenUndoClick(callback) {
        undoButtonElement?.addEventListener('click', callback);
    }

    static listenPieceClick(callback) {
        document.querySelector('.player-pieces').addEventListener('click', callback)
    }

    static listenLeaderboardOpen(callback) {
        leaderboardButtonElement?.addEventListener('click', callback);
    }

    static listenLeaderboardClose(callback) {
        leaderboardCloseElement?.addEventListener('click', callback);
        leaderboardOverlayElement?.addEventListener('click', (event) => {
            if (event.target === leaderboardOverlayElement) {
                callback?.(event);
            }
        });
    }

    /**
     * 
     * @param {string} player 
     * @param {Number} piece 
     * @param {Number} newPosition 
     */
    static setPiecePosition(player, piece, newPosition) {
        if(!playerPiecesElements[player] || !playerPiecesElements[player][piece]) {
            console.error(`Player element of given player: ${player} and piece: ${piece} not found`)
            return;
        }

        const coords = COORDINATES_MAP[newPosition];
        if(!coords) {
            console.error(`Coordinates for position ${newPosition} not found`);
            return;
        }

        const [x, y] = coords;

        const pieceElement = playerPiecesElements[player][piece];
        pieceElement.style.top = y * STEP_LENGTH + '%';
        pieceElement.style.left = x * STEP_LENGTH + '%';
    }

    static setTurn(turn) {
        let player;
        if(typeof turn === 'number') {
            if(turn < 0 || turn >= PLAYERS.length) {
                console.error('index out of bound!');
                return;
            }
            player = PLAYERS[turn];
        } else {
            player = turn;
            if(!PLAYERS.includes(player)) {
                console.error('Invalid player id!');
                return;
            }
        }

        // Display player ID
        document.querySelector('.active-player span').innerText = player;

        const activePlayerBase = document.querySelector('.player-base.highlight');
        if(activePlayerBase) {
            activePlayerBase.classList.remove('highlight');
        }
        // highlight
        document.querySelector(`[player-id="${player}"].player-base`).classList.add('highlight')
    }

    static enableDice() {
        diceButtonElement.removeAttribute('disabled');
    }

    static disableDice() {
        diceButtonElement.setAttribute('disabled', '');
    }

    /**
     * 
     * @param {string} player 
     * @param {Number[]} pieces 
     */
    static highlightPieces(player, pieces) {
        pieces.forEach(piece => {
            const pieceElement = playerPiecesElements[player]?.[piece];
            if(pieceElement) {
                pieceElement.classList.add('highlight');
            }
        })
    }

    static unhighlightPieces() {
        document.querySelectorAll('.player-piece.highlight').forEach(ele => {
            ele.classList.remove('highlight');
        })
    }

    static setDiceValue(value, { animate = false } = {}) {
        if (diceValueElement) {
            diceValueElement.innerText = typeof value === 'number' ? value : value ?? '-';
        }

        if (typeof value === 'number') {
            if (animate) {
                this._animateDiceToValue(value);
            } else {
                this._applyDiceTransform(value);
            }
        } else if (value == null || value === '-') {
            this._resetDiceOrientation();
        }
    }

    static setLocalPlayerLabel(playerId) {
        if (!localPlayerLabelElement) return;
        localPlayerLabelElement.innerText = playerId ?? '-';
    }

    static showRoomCode(roomCode) {
        if (!roomCodeOutputElement) return;
        roomCodeOutputElement.innerText = roomCode ?? '-';
    }

    static updatePlayersList(players, scores = {}) {
        if (!playersListElement) return;
        playersListElement.innerHTML = '';
        (players ?? []).forEach(({ id, name }) => {
            const li = document.createElement('li');
            const score = typeof scores[id] === 'number' ? scores[id] : 0;
            const label = `${name ? name : ''}`;
            li.innerHTML = `<span>${label}</span><span class="score">${score} pts</span>`;
            playersListElement.appendChild(li);
        });
    }

    static updateScoreboard(entries = []) {
        if (!leaderboardListElement) return;
        leaderboardListElement.innerHTML = '';
        (entries ?? []).forEach(({ id, name, score }) => {
            const li = document.createElement('li');
            const hasName = typeof name === 'string' && name.trim().length;
            const label = hasName && id && name !== id ? `${name} (${id})` : (hasName ? name : id);
            const points = typeof score === 'number' ? score : 0;
            li.innerHTML = `<span>${label}</span><span class="score">${points} pts</span>`;
            leaderboardListElement.appendChild(li);
        });
    }

    static showLeaderboardOverlay() {
        if (!leaderboardOverlayElement) return;
        leaderboardOverlayElement.classList.remove('hidden');
        leaderboardOverlayElement.classList.add('visible');
    }

    static hideLeaderboardOverlay() {
        if (!leaderboardOverlayElement) return;
        leaderboardOverlayElement.classList.remove('visible');
        leaderboardOverlayElement.classList.add('hidden');
    }

    static showSystemMessage(message) {
        if (!systemMessageElement) return;
        systemMessageElement.innerText = message ?? '';
        systemMessageElement.classList.remove('hidden');
    }

    static setUndoState({ remaining = 0, enabled = false } = {}) {
        if (!undoButtonElement) return;
        undoButtonElement.disabled = !enabled;
        //undoButtonElement.innerText = `Undo (${remaining} left)`;
    }

    static showWinner(playerId) {
        this.showSystemMessage(`🎉 ${playerId} wins the game!`);
        alert(`Player ${playerId} wins the game!`);
    }

    static clearSystemMessage() {
        if (!systemMessageElement) return;
        systemMessageElement.innerText = '';
        systemMessageElement.classList.add('hidden');
    }

    static startDiceRollAnimation() {
        this._startDiceRollAnimation();
    }

    static _animateDiceToValue(value) {
        if (!diceCubeElement) return;

        this._startDiceRollAnimation();
        clearTimeout(diceAnimationTimeout);
        diceAnimationTimeout = setTimeout(() => {
            this._stopDiceRollAnimation();
            this._applyDiceTransform(value);
        }, 900);
    }

    static _applyDiceTransform(value) {
        if (!diceCubeElement) return;
        const transform = DICE_TRANSFORMS[value];
        if (transform) {
            diceCubeElement.style.transform = transform;
        } else {
            this._resetDiceOrientation();
        }
    }

    static _resetDiceOrientation() {
        if (!diceCubeElement) return;
        this._stopDiceRollAnimation();
        diceCubeElement.style.transform = DEFAULT_DICE_TRANSFORM;
    }

    static _startDiceRollAnimation() {
        if (!diceCubeElement) return;
        diceCubeElement.style.animation = 'none';
        void diceCubeElement.offsetWidth;
        diceCubeElement.style.animation = 'ludo-dice-rolling 0.8s ease';
    }

    static _stopDiceRollAnimation() {
        if (!diceCubeElement) return;
        diceCubeElement.style.animation = 'none';
    }
}

// UI.setPiecePosition('P1', 0, 0);
// UI.setTurn(0);
// UI.setTurn(1);

// UI.disableDice();
// UI.enableDice();
// UI.highlightPieces('P1', [0]);
// UI.unhighlightPieces();
// UI.setDiceValue(5);
// UI.setLocalPlayerId('P1');
// UI.setRoomCode('ABC123');
// UI.updatePlayersList([
//     { id: 'P1', name: 'Player 1' },
//     { id: 'P2', name: 'Player 2' },
// ], { P1: 10, P2: 4 });
// UI.showSystemMessage('Waiting for opponent...');
// UI.hideSystemMessage();