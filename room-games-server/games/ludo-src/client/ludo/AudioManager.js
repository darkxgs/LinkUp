const SOUND_DEFINITIONS = {
    lobby: {
        src: '/assets/audio/lobby-loop.mp3',
        loop: true,
        volume: 0.4,
    },
    dice: {
        src: '/assets/audio/dice-roll.mp3',
        volume: 0.85,
    },
    piece: {
        src: '/assets/audio/piece-move.mp3',
        volume: 0.7,
    },
    turn: {
        src: '/assets/audio/turn-swap.mp3',
        volume: 0.75,
    },
};

class AudioController {
    constructor() {
        this.isInitialized = false;
        this.isUnlocked = false;
        this.sounds = new Map();
        this.baseVolumes = new Map();
        this.fadeTimers = new Map();
        this.pendingLobbyStart = false;
        this.turnSwapTimer = null;
    }

    init() {
        if (this.isInitialized) {
            return;
        }
        Object.entries(SOUND_DEFINITIONS).forEach(([key, config]) => {
            const audio = new Audio(config.src);
            audio.preload = 'auto';
            audio.loop = Boolean(config.loop);
            audio.volume = typeof config.volume === 'number' ? config.volume : 1;
            this.sounds.set(key, audio);
            this.baseVolumes.set(key, audio.volume);
        });

        this.isInitialized = true;
        this._registerUnlockHandlers();
    }

    startLobbyMusic() {
        this.init();
        this.pendingLobbyStart = true;
        this._stopFade('lobby');
        const lobbySound = this.sounds.get('lobby');
        if (!lobbySound) {
            return;
        }
        if (!this.isUnlocked) {
            return;
        }
        if (!lobbySound.paused) {
            return;
        }
        lobbySound.volume = this._getBaseVolume('lobby');
        lobbySound.currentTime = 0;
        lobbySound.play().catch(() => {});
    }

    stopLobbyMusic({ fade = true } = {}) {
        this.init();
        this.pendingLobbyStart = false;
        const lobbySound = this.sounds.get('lobby');
        if (!lobbySound) {
            return;
        }
        if (fade) {
            this._fadeOut('lobby', 320);
            return;
        }
        this._stopFade('lobby');
        lobbySound.pause();
        lobbySound.currentTime = 0;
        lobbySound.volume = this._getBaseVolume('lobby');
    }

    playDiceRoll() {
        this._playOneShot('dice');
    }

    playPieceMove() {
        this._playOneShot('piece');
    }

    playTurnSwap() {
        this._playOneShot('turn');
    }

    handleTurnChange(previousTurn, nextTurn, { delayMs = 500 } = {}) {
        if (!previousTurn || !nextTurn || previousTurn === nextTurn) {
            return;
        }
        if (this.turnSwapTimer) {
            clearTimeout(this.turnSwapTimer);
        }
        const delay = Math.max(0, Number.isFinite(delayMs) ? delayMs : 0);
        if (delay === 0) {
            this.playTurnSwap();
            return;
        }
        this.turnSwapTimer = setTimeout(() => {
            this.turnSwapTimer = null;
            this.playTurnSwap();
        }, delay);
    }

    enableOnUserGesture() {
        this.init();
        if (this.isUnlocked) {
            return;
        }
        this._unlockAudio().catch(() => {});
    }

    _playOneShot(key) {
        this.init();
        if (!this.isUnlocked) {
            return;
        }
        const sound = this.sounds.get(key);
        if (!sound) {
            return;
        }
        const baseVolume = this._getBaseVolume(key);
        if (!sound.paused) {
            try {
                const clone = sound.cloneNode(true);
                clone.volume = baseVolume;
                clone.currentTime = 0;
                clone.play().catch(() => {});
            } catch (error) {
                sound.pause();
                sound.currentTime = 0;
                sound.volume = baseVolume;
                sound.play().catch(() => {});
            }
            return;
        }
        sound.currentTime = 0;
        sound.volume = baseVolume;
        sound.play().catch(() => {});
    }

    _fadeOut(key, durationMs) {
        const sound = this.sounds.get(key);
        if (!sound) {
            return;
        }
        const baseVolume = this._getBaseVolume(key);
        const totalSteps = Math.max(1, Math.floor(durationMs / 40));
        const fadeStep = baseVolume / totalSteps;
        this._stopFade(key);
        this.fadeTimers.set(
            key,
            setInterval(() => {
                const nextVolume = Math.max(0, sound.volume - fadeStep);
                sound.volume = nextVolume;
                if (nextVolume <= 0.01) {
                    sound.pause();
                    sound.currentTime = 0;
                    sound.volume = baseVolume;
                    this._stopFade(key);
                }
            }, 40)
        );
    }

    _stopFade(key) {
        const timer = this.fadeTimers.get(key);
        if (timer) {
            clearInterval(timer);
            this.fadeTimers.delete(key);
        }
    }

    _getBaseVolume(key) {
        return this.baseVolumes.get(key) ?? 1;
    }

    _registerUnlockHandlers() {
        const unlock = () => {
            this.enableOnUserGesture();
        };
        ['pointerdown', 'keydown'].forEach((eventName) => {
            window.addEventListener(eventName, unlock, { once: true, capture: true });
        });
    }

    async _unlockAudio() {
        const sounds = Array.from(this.sounds.values());
        if (!sounds.length) {
            this.isUnlocked = true;
            return;
        }
        await Promise.all(
            sounds.map(async (audio) => {
                const wasMuted = audio.muted;
                const wasPaused = audio.paused;
                const previousTime = audio.currentTime;
                audio.muted = true;
                try {
                    await audio.play();
                } catch (error) {
                    return;
                } finally {
                    audio.pause();
                    audio.currentTime = previousTime;
                    audio.muted = wasMuted;
                }
            })
        );
        this.isUnlocked = true;
        if (this.pendingLobbyStart) {
            this.startLobbyMusic();
        }
    }
}

export const AudioManager = new AudioController();
