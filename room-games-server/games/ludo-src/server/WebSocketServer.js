import { WebSocketServer } from 'ws';
import { GameCore } from './GameCore.js';
import { PLAYERS } from '../client/ludo/constants.js';

export class LudoServer {
    constructor({ port = 8080, server, path: wsPath, noServer = false } = {}) {
        const wsOpts = { perMessageDeflate: false };
        if (noServer) {
            Object.assign(wsOpts, { noServer: true, path: wsPath });
        } else if (server) {
            Object.assign(wsOpts, { server, path: wsPath });
        } else {
            Object.assign(wsOpts, { port });
        }
        this.wss = new WebSocketServer(wsOpts);
        this.rooms = new Map();
        this.clients = new Map();
        this.globalScores = new Map();

        this.wss.on('connection', (ws) => this._handleConnection(ws));
        if (!server && !noServer) {
            console.log(`Ludo server listening on ws://localhost:${port}`);
        }
    }

    _handleConnection(ws) {
        ws.on('message', (message) => {
            try {
                const parsed = JSON.parse(message.toString());
                this._handleMessage(ws, parsed);
            } catch (error) {
                console.error('Invalid message received', error);
            }
        });

        ws.on('close', () => {
            this._handleDisconnect(ws);
        });
    }

    _handleMessage(ws, message) {
        const { type, payload } = message;

        switch (type) {
            case 'create_room':
                this._createRoom(ws, payload);
                break;
            case 'join_room':
                this._joinRoom(ws, payload);
                break;
            case 'roll_dice':
                this._rollDice(ws);
                break;
            case 'move_piece':
                this._movePiece(ws, payload);
                break;
            case 'reset_game':
                this._resetGame(ws);
                break;
            case 'undo':
                this._undo(ws);
                break;
            default:
                console.warn('Unknown message type', type);
        }
    }

    _createRoom(ws, { playerName }) {
        const roomCode = this._generateRoomCode();
        const game = new GameCore();

        this.rooms.set(roomCode, {
            game,
            players: new Map(), // playerId -> { ws, name }
            scoreTotals: this._emptyScoreTotals(),
            playerNames: {},
        });

        this._addPlayerToRoom(roomCode, ws, playerName);

        ws.send(
            JSON.stringify({
                type: 'room_created',
                payload: {
                    roomCode,
                    playerId: 'P1',
                    gameState: game.getState(),
                    players: this._roomPlayerList(roomCode),
                    sharedLeaderboard: this._globalLeaderboard(),
                },
            })
        );
    }

    _joinRoom(ws, { playerName, roomCode }) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    payload: { message: 'Room not found' },
                })
            );
            return;
        }

        if (room.players.size >= 2) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    payload: { message: 'Room full' },
                })
            );
            return;
        }

        const playerId = room.players.has('P1') ? 'P2' : 'P1';
        this._addPlayerToRoom(roomCode, ws, playerName, playerId);

        ws.send(
            JSON.stringify({
                type: 'room_joined',
                payload: {
                    roomCode,
                    playerId,
                    gameState: room.game.getState(),
                    players: this._roomPlayerList(roomCode),
                    sharedLeaderboard: this._globalLeaderboard(),
                },
            })
        );

        this._broadcastToRoom(roomCode, {
            type: 'player_joined',
            payload: {
                players: this._roomPlayerList(roomCode),
                sharedLeaderboard: this._globalLeaderboard(),
            },
        });
    }

    _rollDice(ws) {
        const { roomCode, playerId } = this.clients.get(ws) || {};
        if (!roomCode) {
            return;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }

        try {
            const result = room.game.rollDice(playerId);
            this._broadcastToRoom(roomCode, {
                type: 'dice_rolled',
                payload: result,
            });
        } catch (error) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    payload: { message: error.message },
                })
            );
        }
    }

    _movePiece(ws, { piece }) {
        const { roomCode, playerId } = this.clients.get(ws) || {};
        if (!roomCode) {
            return;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }

        try {
            const result = room.game.movePiece(playerId, piece);
            this._updateGlobalScores(roomCode, result.scores);
            this._broadcastToRoom(roomCode, {
                type: 'piece_moved',
                payload: {
                    ...result,
                    sharedLeaderboard: this._globalLeaderboard(),
                },
            });
        } catch (error) {
            console.error('move_piece failed', error);
            ws.send(
                JSON.stringify({
                    type: 'error',
                    payload: { message: error.message },
                })
            );
        }
    }

    _resetGame(ws) {
        const { roomCode } = this.clients.get(ws) || {};
        if (!roomCode) {
            return;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }

        room.game.resetGame();
        this._updateGlobalScores(roomCode, room.game.getState().scores);
        this._broadcastToRoom(roomCode, {
            type: 'game_reset',
            payload: {
                gameState: room.game.getState(),
                players: this._roomPlayerList(roomCode),
                sharedLeaderboard: this._globalLeaderboard(),
            },
        });
    }

    _undo(ws) {
        const { roomCode, playerId } = this.clients.get(ws) || {};
        if (!roomCode) {
            return;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }

        try {
            const result = room.game.undo(playerId);
            this._updateGlobalScores(roomCode, result.scores);
            this._broadcastToRoom(roomCode, {
                type: 'undo_applied',
                payload: {
                    ...result,
                    undoBy: playerId,
                    sharedLeaderboard: this._globalLeaderboard(),
                },
            });
        } catch (error) {
            console.error('undo failed', error);
            ws.send(
                JSON.stringify({
                    type: 'undo_denied',
                    payload: { message: error.message },
                })
            );
        }
    }

    _handleDisconnect(ws) {
        const info = this.clients.get(ws);
        if (!info) {
            return;
        }
        const { roomCode, playerId } = info;
        this.clients.delete(ws);

        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }

        this._removePlayerContribution(room, playerId);
        room.players.delete(playerId);
        this._broadcastToRoom(roomCode, {
            type: 'player_left',
            payload: {
                players: this._roomPlayerList(roomCode),
                sharedLeaderboard: this._globalLeaderboard(),
            },
        });

        if (room.players.size === 0) {
            this._clearRoomContribution(room);
            this.rooms.delete(roomCode);
        }
    }

    _addPlayerToRoom(roomCode, ws, playerName, playerId = 'P1') {
        const room = this.rooms.get(roomCode);
        const name = playerName || playerId;
        room.players.set(playerId, { ws, name });
        this.clients.set(ws, { roomCode, playerId });
        room.scoreTotals[playerId] = room.scoreTotals[playerId] ?? 0;
        room.playerNames[playerId] = name;
        if (!this.globalScores.has(name)) {
            this.globalScores.set(name, room.scoreTotals[playerId] ?? 0);
        }
    }

    _broadcastToRoom(roomCode, message) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return;
        }
        const serialized = JSON.stringify(message);
        for (const { ws } of room.players.values()) {
            ws.send(serialized);
        }
    }

    _roomPlayerList(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return [];
        }
        return Array.from(room.players.entries()).map(([id, info]) => ({
            id,
            name: info.name,
        }));
    }

    _generateRoomCode() {
        let code;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.rooms.has(code));
        return code;
    }

    _emptyScoreTotals() {
        return PLAYERS.reduce((acc, player) => {
            acc[player] = 0;
            return acc;
        }, {});
    }

    _updateGlobalScores(roomCode, newScores = {}) {
        const room = this.rooms.get(roomCode);
        if (!room || !newScores) {
            return;
        }

        PLAYERS.forEach((playerId) => {
            const playerEntry = room.players.get(playerId);
            if (!playerEntry) {
                return;
            }
            const playerName = playerEntry.name || playerId;
            const previous = room.scoreTotals?.[playerId] ?? 0;
            const current = typeof newScores[playerId] === 'number' ? newScores[playerId] : previous;
            const delta = current - previous;
            if (delta !== 0) {
                const existing = this.globalScores.get(playerName) ?? 0;
                this.globalScores.set(playerName, existing + delta);
            }
            room.scoreTotals[playerId] = current;
        });
    }

    _clearRoomContribution(room) {
        if (!room?.players) {
            return;
        }
        PLAYERS.forEach((playerId) => {
            const playerEntry = room.players.get(playerId);
            const playerName = playerEntry?.name || room.playerNames?.[playerId] || playerId;
            const contribution = room.scoreTotals?.[playerId] ?? 0;
            if (!playerName) {
                return;
            }
            const existing = this.globalScores.get(playerName) ?? 0;
            const updated = existing - contribution;
            if (updated <= 0) {
                this.globalScores.delete(playerName);
            } else {
                this.globalScores.set(playerName, updated);
            }
            room.scoreTotals[playerId] = 0;
        });
    }

    _removePlayerContribution(room, playerId) {
        if (!room) {
            return;
        }
        const playerEntry = room.players.get(playerId);
        const playerName = playerEntry?.name || room.playerNames?.[playerId] || playerId;
        const contribution = room.scoreTotals?.[playerId] ?? 0;
        if (!playerName) {
            return;
        }
        if (contribution !== 0) {
            const existing = this.globalScores.get(playerName) ?? 0;
            const updated = existing - contribution;
            if (updated <= 0) {
                this.globalScores.delete(playerName);
            } else {
                this.globalScores.set(playerName, updated);
            }
        }
        room.scoreTotals[playerId] = 0;
        if (room.playerNames) {
            delete room.playerNames[playerId];
        }
    }

    _globalLeaderboard() {
        const entries = Array.from(this.globalScores.entries()).map(([name, score]) => ({
            id: name,
            name,
            score,
        }));
        return this._bubbleSort(entries);
    }

    _bubbleSort(entries) {
        const arr = entries.map((entry) => ({ ...entry }));
        const n = arr.length;
        for (let i = 0; i < n - 1; i += 1) {
            let swapped = false;
            for (let j = 0; j < n - 1 - i; j += 1) {
                const left = arr[j];
                const right = arr[j + 1];
                const shouldSwap =
                    left.score < right.score ||
                    (left.score === right.score && (left.name ?? left.id) > (right.name ?? right.id));
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
}
