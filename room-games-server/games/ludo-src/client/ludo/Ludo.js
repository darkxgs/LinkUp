import { BASE_POSITIONS, HOME_POSITIONS, PLAYERS, STATE } from './constants.js';
import { UI } from './UI.js';
import { AudioManager } from './AudioManager.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const MOVE_STEP_DURATION_MS = 160;
const DICE_ROLL_ANIMATION_MS = 1200;

export class Ludo {
    constructor({ onDiceRoll, onPieceMoveRequest, onReset } = {}) {
        this.onDiceRoll = onDiceRoll;
        this.onPieceMoveRequest = onPieceMoveRequest;
        this.onReset = onReset;

        this.localPlayerId = null;
        this.turn = null;
        this.state = STATE.DICE_NOT_ROLLED;
        this.currentPositions = clone(BASE_POSITIONS);

        this._attachListeners();
    }

    _attachListeners() {
        UI.listenDiceClick(() => {
            if (this.canLocalRollDice()) {
                UI.startDiceRollAnimation();
                this.onDiceRoll?.();
            }
        });

        UI.listenResetClick(() => {
            this.onReset?.();
        });

        UI.listenPieceClick((event) => this._handlePieceClick(event));
    }

    setLocalPlayer(playerId, displayName) {
        this.localPlayerId = playerId;
        UI.setLocalPlayerLabel(displayName ? `${playerId} — ${displayName}` : playerId);
        this._syncDiceAvailability();
    }

    canLocalRollDice() {
        return (
            this.localPlayerId &&
            this.turn === this.localPlayerId &&
            this.state === STATE.DICE_NOT_ROLLED
        );
    }

    applyGameState({ positions, diceValue, state, turn }) {
        if (positions) {
            this.currentPositions = clone(positions);
            this._renderAllPieces();
        }

        if (typeof diceValue === 'number') {
            UI.setDiceValue(diceValue);
        } else {
            UI.setDiceValue('-');
        }

        if (turn) {
            this._setTurn(turn);
        }

        if (state) {
            this.state = state;
        }

        UI.unhighlightPieces();
        this._syncDiceAvailability();
    }

    handleDiceRolled({ player, diceValue, eligiblePieces, autoPassed, nextPlayer, state }) {
        this.state = state;
        UI.setDiceValue(diceValue, { animate: true });
        UI.unhighlightPieces();
        if (player) {
            this._setTurn(player, { delayMs: DICE_ROLL_ANIMATION_MS });
        }

        if (player === this.localPlayerId && eligiblePieces?.length) {
            UI.highlightPieces(player, eligiblePieces);
        }

        if (autoPassed && nextPlayer) {
            this._setTurn(nextPlayer, { delayMs: DICE_ROLL_ANIMATION_MS });
        }

        if (autoPassed) {
            UI.unhighlightPieces();
        }

        this._syncDiceAvailability();
    }

    async handlePieceMoved({ positions, movementPath = [], player, piece, nextPlayer, state, diceValue, winner }) {
        if (typeof diceValue === 'number') {
            UI.setDiceValue(diceValue);
        }

        if (state) {
            this.state = state;
        }

        const finalPositions = positions ? clone(positions) : null;

        if (movementPath.length && player && typeof piece === 'number') {
            await this._animateMovement(player, piece, movementPath);
        }

        if (finalPositions) {
            this.currentPositions = finalPositions;
            this._renderAllPieces();
        }

        if (nextPlayer) {
            this._setTurn(nextPlayer);
        } else if (player) {
            this._setTurn(player);
        }

        UI.unhighlightPieces();
        this._syncDiceAvailability();

        if (winner) {
            UI.showWinner(winner);
        }

    }

    _setTurn(playerId, { delayMs = 0 } = {}) {
        if (!playerId) {
            return;
        }
        const previousTurn = this.turn;
        this.turn = playerId;
        UI.setTurn(playerId);
        AudioManager.handleTurnChange(previousTurn, playerId, { delayMs });
    }

    handleGameReset({ gameState }) {
        if (!gameState) return;
        this.applyGameState(gameState);
        UI.showSystemMessage('Game reset');
    }

    updatePlayersList(players, scores = {}) {
        UI.updatePlayersList(players, scores);
    }

    showRoomCode(roomCode) {
        UI.showRoomCode(roomCode);
    }

    getCurrentTurn() {
        return this.turn;
    }

    isLocalTurnActive() {
        return Boolean(this.localPlayerId) && this.turn === this.localPlayerId;
    }

    _handlePieceClick(event) {
        const target = event.target;
        if (!target.classList.contains('player-piece') || !target.classList.contains('highlight')) {
            return;
        }

        const playerId = target.getAttribute('player-id');
        const piece = Number(target.getAttribute('piece'));

        if (playerId !== this.localPlayerId) {
            return;
        }

        this.onPieceMoveRequest?.(piece);
    }

    _renderAllPieces() {
        PLAYERS.forEach((player) => {
            [0, 1, 2, 3].forEach((piece) => {
                const position = this.currentPositions[player][piece];
                if (typeof position === 'number') {
                    UI.setPiecePosition(player, piece, position);
                } else if (Array.isArray(position)) {
                    UI.setPiecePosition(player, piece, position[piece]);
                } else {
                    UI.setPiecePosition(player, piece, BASE_POSITIONS[player][piece]);
                }
            });
        });
    }

    _syncDiceAvailability() {
        if (this.canLocalRollDice()) {
            UI.enableDice();
        } else {
            UI.disableDice();
        }
    }

    _animateMovement(player, piece, path) {
        return path.reduce((promise, position) => {
            return promise.then(
                () =>
                    new Promise((resolve) => {
                        requestAnimationFrame(() => {
                            AudioManager.playPieceMove();
                            UI.setPiecePosition(player, piece, position);
                            setTimeout(resolve, MOVE_STEP_DURATION_MS);
                        });
                    })
            );
        }, Promise.resolve());
    }
}