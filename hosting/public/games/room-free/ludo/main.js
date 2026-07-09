import { Ludo } from './ludo/Ludo.js';
import { NetworkClient } from './ludo/NetworkClient.js';
import { UI } from './ludo/UI.js';
import { PLAYERS } from './ludo/constants.js';
import { AudioManager } from './ludo/AudioManager.js';

createParticleField();
AudioManager.startLobbyMusic();

const overlayElement = document.querySelector('#lobby-overlay');
const stepElements = document.querySelectorAll('#lobby-overlay .modal-step');
const roomCodeLabel = document.querySelector('#room-code-label');
const joinErrorElement = document.querySelector('#join-error');
const modalPlayerList = document.querySelector('#lobby-overlay .player-list');

const playerNameInput = document.querySelector('#player-name-input');
const roomCodeInput = document.querySelector('#room-code-input');

const createRoomBtn = document.querySelector('#create-room-btn');
const joinRoomBtn = document.querySelector('#join-room-btn');
const goToJoinBtn = document.querySelector('#go-to-join-btn');

const backButtons = document.querySelectorAll('[data-step-back]');

let localPlayerId = null;
let currentRoomCode = null;
let cachedPlayerList = [];
let undoRemaining = { P1: 2, P2: 2 };
let currentScores = Object.fromEntries(PLAYERS.map((player) => [player, 0]));
let currentLeaderboard = PLAYERS.map((player) => ({ id: player, score: 0 }));
let globalLeaderboard = [];

const network = new NetworkClient(getWsUrl());

const ludo = new Ludo({
    onDiceRoll: () => network.send('roll_dice'),
    onPieceMoveRequest: (piece) => network.send('move_piece', { piece }),
    onReset: () => network.send('reset_game'),
});

connectNetwork();
attachListeners();
showStep('welcome');
updateUndoButton();
updateScoreboardDisplay();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        UI.showSystemMessage('Connected to server. Waiting for players…');
    }
});

function attachListeners() {
    createRoomBtn?.addEventListener('click', () => {
        AudioManager.enableOnUserGesture();
        const name = getPlayerName();
        if (!name) {
            showJoinError('Please enter a name.');
            return;
        }
        network.send('create_room', { playerName: name });
        showStep('waiting');
        UI.showSystemMessage('Creating room…');
    });

    goToJoinBtn?.addEventListener('click', () => {
        AudioManager.enableOnUserGesture();
        showStep('join');
    });

    joinRoomBtn?.addEventListener('click', () => {
        AudioManager.enableOnUserGesture();
        const name = getPlayerName();
        const code = roomCodeInput.value.trim().toUpperCase();
        if (!name) {
            showJoinError('Please enter your name.');
            return;
        }
        if (!code || code.length !== 6) {
            showJoinError('Room code must be 6 characters.');
            return;
        }
        showJoinError('');
        network.send('join_room', { playerName: name, roomCode: code });
    });

    backButtons.forEach((button) => {
        button.addEventListener('click', () => {
            window.location.reload();
        });
    });

    UI.listenUndoClick(() => {
        if (!network.isConnected) {
            UI.showSystemMessage('Cannot undo while disconnected.');
            return;
        }
        network.send('undo');
    });

    UI.listenLeaderboardOpen(() => {
        updateScoreboardDisplay();
        UI.showLeaderboardOverlay();
    });

    UI.listenLeaderboardClose(() => {
        UI.hideLeaderboardOverlay();
    });
}

function connectNetwork() {
    const prime = window.LinkUpRoomBoot?.primeGameServer?.() || Promise.resolve();
    prime
        .then(() => network.connect())
        .then(() => {
            UI.showSystemMessage('Connected to server. Create or join a room.');
            updateUndoButton();
        })
        .catch(() => {
            UI.showSystemMessage('Failed to connect to server. Please refresh.');
            updateUndoButton();
        });

    network.on('error', ({ message }) => {
        if (message) {
            showJoinError(message);
            UI.showSystemMessage(message);
        }
    });

    network.on('room_created', handleRoomReady);
    network.on('room_joined', handleRoomReady);

    network.on('player_joined', (payload = {}) => {
        const players = payload?.players ?? [];
        cachedPlayerList = players;
        handleScorePayload(payload);
        updatePlayers(players);
        if (players.length >= 2) {
            hideOverlay();
            UI.showSystemMessage('Both players are ready!');
            AudioManager.stopLobbyMusic();
        } else {
            showStep('waiting');
            showOverlay();
            UI.showSystemMessage('Waiting for the second player…');
            AudioManager.startLobbyMusic();
        }
        updateUndoButton();
    });

    network.on('player_left', (payload = {}) => {
        const players = payload?.players ?? [];
        cachedPlayerList = players;
        handleScorePayload(payload);
        updatePlayers(players);
        showOverlay();
        showStep('waiting');
        UI.showSystemMessage('A player left the room. Waiting for a new player…');
        AudioManager.startLobbyMusic();
        updateUndoButton();
    });

    network.on('dice_rolled', (payload) => {
        ludo.handleDiceRolled(payload);
        AudioManager.playDiceRoll();
        updateUndoButton();
    });

    network.on('piece_moved', (payload) => {
        handleScorePayload(payload);
        Promise.resolve(ludo.handlePieceMoved(payload)).finally(() => {
            updateUndoButton();
        });
    });

    network.on('game_reset', (payload) => {
        ludo.handleGameReset(payload);
        setUndoRemaining(payload?.gameState?.undoRemaining);
        handleScorePayload(payload);
    });

    network.on('undo_applied', handleUndoApplied);

    network.on('undo_denied', (payload = {}) => {
        const { message } = payload;
        if (message) {
            UI.showSystemMessage(message);
        }
        updateUndoButton();
    });

    network.on('disconnected', () => {
        UI.showSystemMessage('Disconnected from server. Attempting to reconnect…');
        showOverlay();
        showStep('welcome');
        AudioManager.startLobbyMusic();
        updateUndoButton();
    });
}

function handleRoomReady(payload) {
    currentRoomCode = payload?.roomCode ?? currentRoomCode;
    localPlayerId = payload?.playerId ?? localPlayerId;

    if (payload?.players) {
        cachedPlayerList = payload.players;
    }

    if (payload?.gameState) {
        ludo.applyGameState(payload.gameState);
        setUndoRemaining(payload.gameState.undoRemaining);
    }

    handleScorePayload(payload);

    if (payload?.players) {
        updatePlayers(payload.players);
    } else if (cachedPlayerList.length) {
        updatePlayers(cachedPlayerList);
    }

    if (localPlayerId) {
        const playerInfo = cachedPlayerList.find((p) => p.id === localPlayerId);
        ludo.setLocalPlayer(localPlayerId, playerInfo?.name);
        updateUndoButton();
    }

    if (currentRoomCode) {
        ludo.showRoomCode(currentRoomCode);
        if (roomCodeLabel) {
            roomCodeLabel.innerText = currentRoomCode;
        }
    }

    const players = cachedPlayerList ?? [];
    if (players.length >= 2) {
        hideOverlay();
        UI.showSystemMessage('Both players are ready!');
        AudioManager.stopLobbyMusic();
    } else {
        showStep('waiting');
        showOverlay();
        UI.showSystemMessage('Waiting for players to join…');
        AudioManager.startLobbyMusic();
    }
}

function updatePlayers(players = []) {
    ludo.updatePlayersList(players, currentScores);
    renderModalPlayers(players);
    updateScoreboardDisplay();
}

function renderModalPlayers(players = []) {
    if (!modalPlayerList) return;
    if (players.length) {
        modalPlayerList.innerHTML = players
            .map((player) => {
                const score = typeof currentScores[player.id] === 'number' ? currentScores[player.id] : 0;
                const label = `${player.id}${player.name ? ' — ' + player.name : ''}`;
                return `<div>${label}<span class="score">${score} pts</span></div>`;
            })
            .join('');
        return;
    }

    if ((globalLeaderboard ?? []).length) {
        modalPlayerList.innerHTML = globalLeaderboard
            .map((entry) => {
                const name = entry.name ?? entry.id;
                const label = name && entry.id && name !== entry.id ? `${name} (${entry.id})` : name;
                const score = typeof entry.score === 'number' ? entry.score : 0;
                return `<div>${label}<span class="score">${score} pts</span></div>`;
            })
            .join('');
        return;
    }

    modalPlayerList.innerHTML = '<p>No players connected yet.</p>';
}

function getPlayerName() {
    return playerNameInput.value.trim();
}

function showJoinError(message) {
    if (joinErrorElement) {
        joinErrorElement.innerText = message ?? '';
    }
}

function showStep(stepName) {
    stepElements.forEach((step) => {
        const isMatch = step.getAttribute('data-step') === stepName;
        step.classList.toggle('hidden', !isMatch);
    });
}

function showOverlay() {
    overlayElement?.classList.add('visible');
}

function hideOverlay() {
    overlayElement?.classList.remove('visible');
}

function getWsUrl() {
    if (window.LinkUpRoomBoot) {
        return window.LinkUpRoomBoot.wsPath('ludo');
    }
    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss' : 'ws';
    const configuredPort = window.__LUDO_WS_PORT__;
    const hostWithPort = window.location.host;

    if (configuredPort) {
        const hostname = window.location.hostname || 'localhost';
        return `${protocol}://${hostname}:${configuredPort}/ws/ludo`;
    }

    if (hostWithPort) {
        return `${protocol}://${hostWithPort}/ws/ludo`;
    }

    return `${protocol}://localhost:8080/ws/ludo`;
}

function handleUndoApplied(payload = {}) {
    const { undoBy, gameState, undoRemaining: remaining } = payload;
    if (gameState) {
        ludo.applyGameState(gameState);
    }

    handleScorePayload(payload);

    const snapshotRemaining = remaining ?? gameState?.undoRemaining;
    setUndoRemaining(snapshotRemaining);

    if (undoBy) {
        const remainingForPlayer = snapshotRemaining?.[undoBy];
        const suffix = typeof remainingForPlayer === 'number'
            ? ` (${remainingForPlayer} undo${remainingForPlayer === 1 ? '' : 's'} left for ${undoBy})`
            : '';
        UI.showSystemMessage(`Undo applied by ${undoBy}.${suffix}`);
    } else {
        UI.showSystemMessage('Undo applied.');
    }
}

function setUndoRemaining(newValues) {
    if (!newValues) {
        return;
    }
    undoRemaining = {
        P1: typeof newValues.P1 === 'number' ? newValues.P1 : 0,
        P2: typeof newValues.P2 === 'number' ? newValues.P2 : 0,
    };
    updateUndoButton();
}

function updateUndoButton() {
    const remaining = localPlayerId
        ? undoRemaining[localPlayerId] ?? 0
        : Math.max(undoRemaining.P1 ?? 0, undoRemaining.P2 ?? 0);
    const isPlayersTurn = typeof ludo.isLocalTurnActive === 'function' ? ludo.isLocalTurnActive() : false;
    const enabled = Boolean(localPlayerId) && network.isConnected && remaining > 0 && isPlayersTurn;
    UI.setUndoState({
        remaining: Math.max(0, remaining),
        enabled,
    });
}

function handleScorePayload(payload) {
    if (!payload) {
        return;
    }

    if (payload.gameState) {
        handleScorePayload(payload.gameState);
    }

    const { scores, leaderboard, sharedLeaderboard } = payload;
    if (scores || leaderboard || sharedLeaderboard) {
        setScores(scores, leaderboard, sharedLeaderboard);
    }
}

function setScores(scores, leaderboard, sharedLeaderboard) {
    if (scores) {
        PLAYERS.forEach((player) => {
            const value = scores[player];
            currentScores[player] = typeof value === 'number' ? value : 0;
        });
    }

    if (leaderboard && Array.isArray(leaderboard) && leaderboard.length) {
        currentLeaderboard = leaderboard.map((entry) => ({
            id: entry.id,
            score: typeof entry.score === 'number' ? entry.score : currentScores[entry.id] ?? 0,
        }));
    } else {
        currentLeaderboard = PLAYERS.map((player) => ({
            id: player,
            score: currentScores[player] ?? 0,
        }));
    }

    if (Array.isArray(sharedLeaderboard)) {
        globalLeaderboard = sharedLeaderboard.map((entry) => ({
            id: entry.id ?? entry.name,
            name: entry.name ?? entry.id ?? '',
            score: typeof entry.score === 'number' ? entry.score : 0,
        }));
    }

    const players = cachedPlayerList ?? [];
    ludo.updatePlayersList(players, currentScores);
    renderModalPlayers(players);
    updateScoreboardDisplay();
}

function updateScoreboardDisplay() {
    const source = (globalLeaderboard ?? []).length ? globalLeaderboard : currentLeaderboard ?? [];
    const entries = source.map((entry) => {
        const id = entry.id;
        const scoreValue = typeof entry.score === 'number' ? entry.score : currentScores[id] ?? 0;
        const name = entry.name ?? getPlayerDisplayName(id);
        return {
            id,
            name,
            score: scoreValue,
        };
    });
    UI.updateScoreboard(entries);
}

function getPlayerDisplayName(playerId) {
    const player = (cachedPlayerList ?? []).find((p) => p.id === playerId);
    return player?.name ?? playerId;
}

function createParticleField(count = 48) {
    const container = document.querySelector('.particle-field');
    if (!container || container.childElementCount) {
        return;
    }

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
        const particle = document.createElement('span');
        const size = (Math.random() * 4 + 3).toFixed(2);
        const startX = `${Math.random() * 100}%`;
        const delay = `${(Math.random() * 20).toFixed(2)}s`;
        const duration = `${(18 + Math.random() * 16).toFixed(2)}s`;
        const driftX = `${(Math.random() * 200 - 100).toFixed(2)}px`;
        const liftY = `${(-80 - Math.random() * 80).toFixed(2)}vh`;
        const alpha = (0.35 + Math.random() * 0.45).toFixed(2);
        const blur = `${(Math.random() * 2.5).toFixed(2)}px`;

        particle.style.setProperty('--size', `${size}px`);
        particle.style.setProperty('--start-x', startX);
        particle.style.setProperty('--delay', delay);
        particle.style.setProperty('--duration', duration);
        particle.style.setProperty('--travel-x', driftX);
        particle.style.setProperty('--travel-y', liftY);
        particle.style.setProperty('--alpha', alpha);
        particle.style.setProperty('--blur', blur);

        fragment.appendChild(particle);
    }

    container.appendChild(fragment);
}

if (window.LinkUpRoomBoot) {
    window.LinkUpRoomBoot.applyRtlShell();
    const boot = window.LinkUpRoomBoot.parse();
    if (boot.playerName && playerNameInput) playerNameInput.value = boot.playerName;
    if (boot.joinCode && roomCodeInput) roomCodeInput.value = boot.joinCode.toUpperCase().slice(0, 6);
    network.on('connected', () => {
        const name = getPlayerName();
        if (!name) return;
        setTimeout(() => {
            if (boot.autoCreate) {
                network.send('create_room', { playerName: name });
                showStep('waiting');
            } else if ((boot.autoJoin || boot.joinCode) && boot.joinCode) {
                network.send('join_room', {
                    playerName: name,
                    roomCode: boot.joinCode.toUpperCase().slice(0, 6),
                });
            }
        }, 500);
    });
}