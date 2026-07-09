// audio.js - Web Audio API Synthesis for Zero-Dependency Sound Effects

class AudioSynthesizer {
    constructor() {
        this.ctx = null;
        this.enabled = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.enabled = true;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playChip() {
        this.init();
        this.playTone(800, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(1200, 'sine', 0.1, 0.05), 50);
    }

    playTick() {
        this.init();
        this.playTone(400, 'square', 0.05, 0.05);
    }

    playShoot() {
        this.init();
        this.playTone(800, 'square', 0.2, 0.1);
        setTimeout(() => this.playTone(600, 'sawtooth', 0.3, 0.1), 100);
    }

    playWin() {
        this.init();
        this.playTone(440, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.3, 0.1), 200);
    }

    playLose() {
        this.init();
        this.playTone(300, 'sawtooth', 0.2, 0.1);
        setTimeout(() => this.playTone(250, 'sawtooth', 0.4, 0.1), 200);
    }
}

const sfx = new AudioSynthesizer();

// Initialize audio context on first user interaction to bypass browser autoplay blocks
document.addEventListener('click', () => {
    if (!sfx.enabled) sfx.init();
}, { once: true });
