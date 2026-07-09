import {
    BASE_POSITIONS,
    HOME_ENTRANCE,
    HOME_POSITIONS,
    PLAYERS,
    SAFE_POSITIONS,
    START_POSITIONS,
    STATE,
    TURNING_POINTS,
} from '../client/ludo/constants.js';
import { CircularQueue } from './lib/CircularQueue.js';
import { Stack } from './lib/Stack.js';
import { PATHS, mainPath } from './lib/paths.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const MAX_UNDOS_PER_PLAYER = 2;
const MAX_SNAPSHOTS_PER_PLAYER = MAX_UNDOS_PER_PLAYER + 1;

export class GameCore {
    constructor() {
        this.playerQueue = new CircularQueue(PLAYERS);
        this.undoStacks = new Map();
        this.snapshotCounter = 0;
        this.undoCounts = new Map();
        this.scores = new Map();
        this._initializeUndoStacks();
        this.resetGame();
    }

    _initializeUndoStacks() {
        PLAYERS.forEach((player) => {
            this.undoStacks.set(player, new Stack(MAX_SNAPSHOTS_PER_PLAYER));
        });
    }

    resetGame() {
        this.currentPositions = clone(BASE_POSITIONS);
        this.diceValue = null;
        this.state = STATE.DICE_NOT_ROLLED;
        this.turn = this.playerQueue.reset();
        this._clearAllStacks();
        this.snapshotCounter = 0;
        this._resetUndoCounts();
        this._resetScores();
        this._recordTurnSnapshot();
    }

    _clearAllStacks() {
        PLAYERS.forEach((player) => {
            this.undoStacks.get(player)?.clear();
        });
    }

    getState() {
        return {
            positions: clone(this.currentPositions),
            diceValue: this.diceValue,
            state: this.state,
            turn: this.turn,
            undoRemaining: this._remainingUndo(),
            scores: this._scoresState(),
            leaderboard: this._leaderboard(),
        };
    }

    rollDice(playerId) {
        this._ensurePlayerTurn(playerId);
        if (this.state !== STATE.DICE_NOT_ROLLED) {
            throw new Error('Dice already rolled');
        }

        this.diceValue = 1 + Math.floor(Math.random() * 6);
        this.state = STATE.DICE_ROLLED;

        const eligiblePieces = this.getEligiblePieces(playerId);
        if (!eligiblePieces.length) {
            // no eligible pieces, advance turn automatically
            const previousDice = this.diceValue;
            this.diceValue = null;
            this.state = STATE.DICE_NOT_ROLLED;
            const nextPlayer = this._advanceTurn();
            return {
                player: playerId,
                diceValue: previousDice,
                eligiblePieces,
                autoPassed: true,
                nextPlayer,
                state: this.state,
            };
        }

        return {
            player: playerId,
            diceValue: this.diceValue,
            eligiblePieces,
            state: this.state,
        };
    }

    movePiece(playerId, pieceIndex) {
        this._ensurePlayerTurn(playerId);
        if (this.state !== STATE.DICE_ROLLED || this.diceValue === null) {
            throw new Error('Dice not rolled');
        }

        const eligiblePieces = this.getEligiblePieces(playerId);
        if (!eligiblePieces.includes(pieceIndex)) {
            throw new Error('Piece not eligible to move');
        }

        const movementPath = [];
        const currentPosition = this.currentPositions[playerId][pieceIndex];

        if (BASE_POSITIONS[playerId].includes(currentPosition)) {
            const startPosition = START_POSITIONS[playerId];
            this.currentPositions[playerId][pieceIndex] = startPosition;
            movementPath.push(startPosition);
        } else {
            let moveBy = this.diceValue;
            while (moveBy > 0) {
                const next = this._getNextPosition(playerId, pieceIndex);
                this.currentPositions[playerId][pieceIndex] = next;
                movementPath.push(next);
                moveBy--;
            }
        }

        const killInfo = this._checkForKill(playerId);
        if (killInfo.killed) {
            killInfo.killedPieces.forEach(({ opponent }) => {
                this._adjustScore(opponent, -2);
            });
        }
        const winner = this._hasPlayerWon(playerId) ? playerId : null;

        const homeEntries = this._countHomeEntries(playerId, movementPath);
        if (homeEntries > 0) {
            this._adjustScore(playerId, 10 * homeEntries);
        }

        const previousDice = this.diceValue;
        this.diceValue = null;

        if (winner) {
            this.state = STATE.DICE_NOT_ROLLED;
            this._recordTurnSnapshot();
        } else if (previousDice === 6 || killInfo.killed) {
            this.state = STATE.DICE_NOT_ROLLED;
            this._recordTurnSnapshot();
        } else {
            this._advanceTurn();
        }

        const response = {
            player: playerId,
            piece: pieceIndex,
            movementPath,
            positions: clone(this.currentPositions),
            killInfo,
            winner,
            nextPlayer: this.turn,
            state: this.state,
            diceValue: previousDice,
            scores: this._scoresState(),
            leaderboard: this._leaderboard(),
        };

        return response;
    }

    undo(playerId) {
        if (this.turn !== playerId) {
            throw new Error('Undo allowed only during your turn');
        }

        const used = this.undoCounts.get(playerId) ?? 0;
        if (used >= MAX_UNDOS_PER_PLAYER) {
            throw new Error('Undo limit reached');
        }

        const playerStack = this.undoStacks.get(playerId);
        if (!playerStack || playerStack.size() < 2) {
            throw new Error('No undo steps available');
        }

        // Remove current state
        playerStack.pop();
        
        // Get previous state
        const snapshot = playerStack.peek();
        if (!snapshot) {
            throw new Error('No undo steps available');
        }

        // Restore game state from snapshot
        this.currentPositions = clone(snapshot.positions);
        this.diceValue = snapshot.diceValue;
        this.state = snapshot.state;
        this.turn = snapshot.turn;
        this.playerQueue.currentIndex = snapshot.queueIndex;
        this._restoreScores(snapshot.scores);

        // Increment undo usage counter
        this.undoCounts.set(playerId, used + 1);

        return {
            gameState: this.getState(),
            undoRemaining: this._remainingUndo(),
            scores: this._scoresState(),
            leaderboard: this._leaderboard(),
        };
    }

    getEligiblePieces(playerId) {
        return [0, 1, 2, 3].filter((piece) => {
            const currentPosition = this.currentPositions[playerId][piece];

            if (currentPosition === HOME_POSITIONS[playerId]) {
                return false;
            }

            if (
                BASE_POSITIONS[playerId].includes(currentPosition) &&
                this.diceValue !== 6
            ) {
                return false;
            }

            if (
                HOME_ENTRANCE[playerId].includes(currentPosition) &&
                this.diceValue > HOME_POSITIONS[playerId] - currentPosition
            ) {
                return false;
            }

            return true;
        });
    }

    _advanceTurn() {
        const nextPlayer = this.playerQueue.next();
        this.turn = nextPlayer;
        this.state = STATE.DICE_NOT_ROLLED;
        this._recordTurnSnapshot();
        return this.turn;
    }

    _ensurePlayerTurn(playerId) {
        if (this.turn !== playerId) {
            throw new Error('Not player turn');
        }
    }

    _getNextPosition(playerId, pieceIndex) {
        const currentPosition = this.currentPositions[playerId][pieceIndex];

        if (currentPosition === TURNING_POINTS[playerId]) {
            return PATHS[playerId].head.value;
        }

        if (HOME_ENTRANCE[playerId].includes(currentPosition)) {
            const homePath = PATHS[playerId];
            const currentNode = homePath.find(currentPosition);
            if (currentNode && currentNode.next) {
                return currentNode.next.value;
            }
        }

        if (BASE_POSITIONS[playerId].includes(currentPosition)) {
            return START_POSITIONS[playerId];
        }

        const mainPathNode = mainPath.find(currentPosition);
        if (mainPathNode && mainPathNode.next) {
            return mainPathNode.next.value;
        }

        return currentPosition;
    }

    _checkForKill(playerId) {
        const opponent = playerId === 'P1' ? 'P2' : 'P1';
        const killedPieces = [];

        [0, 1, 2, 3].forEach((piece) => {
            const currentPosition = this.currentPositions[playerId][piece];
            [0, 1, 2, 3].forEach((opponentPiece) => {
                const opponentPosition = this.currentPositions[opponent][opponentPiece];

                if (
                    currentPosition === opponentPosition &&
                    !SAFE_POSITIONS.includes(currentPosition)
                ) {
                    this.currentPositions[opponent][opponentPiece] =
                        BASE_POSITIONS[opponent][opponentPiece];
                    killedPieces.push({ opponent, piece: opponentPiece });
                }
            });
        });

        return {
            killed: killedPieces.length > 0,
            killedPieces,
        };
    }

    _hasPlayerWon(playerId) {
        return [0, 1, 2, 3].every(
            (piece) => this.currentPositions[playerId][piece] === HOME_POSITIONS[playerId]
        );
    }

    _recordTurnSnapshot() {
        const snapshot = {
            id: ++this.snapshotCounter,
            positions: clone(this.currentPositions),
            diceValue: this.diceValue,
            state: this.state,
            turn: this.turn,
            queueIndex: this.playerQueue.getCurrentIndex(),
            scores: this._scoresState(),
        };
        
        // Push snapshot to the current player's stack
        const playerStack = this.undoStacks.get(this.turn);
        if (playerStack) {
            playerStack.push(snapshot);
        }
    }

    _resetUndoCounts() {
        this.undoCounts.clear();
        PLAYERS.forEach((player) => {
            this.undoCounts.set(player, 0);
        });
    }

    _remainingUndo() {
        const remaining = {};
        PLAYERS.forEach((player) => {
            const used = this.undoCounts.get(player) ?? 0;
            remaining[player] = Math.max(0, MAX_UNDOS_PER_PLAYER - used);
        });
        return remaining;
    }

    _resetScores() {
        this.scores.clear();
        PLAYERS.forEach((player) => {
            this.scores.set(player, 0);
        });
    }

    _restoreScores(snapshotScores = {}) {
        this._resetScores();
        Object.entries(snapshotScores).forEach(([player, score]) => {
            if (this.scores.has(player)) {
                this.scores.set(player, Number(score) || 0);
            }
        });
    }

    _adjustScore(playerId, delta) {
        if (!this.scores.has(playerId) || typeof delta !== 'number') {
            return;
        }
        const current = this.scores.get(playerId) ?? 0;
        this.scores.set(playerId, current + delta);
    }

    _scoresState() {
        const snapshot = {};
        PLAYERS.forEach((player) => {
            snapshot[player] = this.scores.get(player) ?? 0;
        });
        return snapshot;
    }

    _leaderboard() {
        const entries = PLAYERS.map((player) => ({
            id: player,
            score: this.scores.get(player) ?? 0,
        }));
        return this._bubbleSortLeaderboard(entries);
    }

    _bubbleSortLeaderboard(entries) {
        const arr = entries.map((entry) => ({ ...entry }));
        const n = arr.length;
        for (let i = 0; i < n - 1; i += 1) {
            let swapped = false;
            for (let j = 0; j < n - 1 - i; j += 1) {
                const left = arr[j];
                const right = arr[j + 1];
                const shouldSwap =
                    left.score < right.score ||
                    (left.score === right.score && left.id > right.id);
                if (shouldSwap) {
                    [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                    swapped = true;
                }
            }
            if (!swapped) {
                break;
            }
        }
        return arr;
    }

    _countHomeEntries(playerId, movementPath) {
        if (!Array.isArray(movementPath)) {
            return 0;
        }
        const home = HOME_POSITIONS[playerId];
        if (typeof home !== 'number') {
            return 0;
        }
        return movementPath.reduce((total, position) => {
            return total + (position === home ? 1 : 0);
        }, 0);
    }

    runbubbleSortLeaderboardTest() {
        const testEntries = [
            { id: 'P1', score: 10 },
            { id: 'P2', score: 45 },
            { id: 'P3', score: 60 },
            { id: 'P4', score: 18 },
        ];
        const sorted = this._bubbleSortLeaderboard(testEntries);
        console.log('Sorted Leaderboard:', sorted);
    }
}
