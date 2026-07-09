export class AudioManager {
    constructor() {
        // Initialize lazily to avoid auto-play policy issues
        this.ctx = null;
        this.enabled = true;
        this.lastTickTime = 0;
        this.masterGain = null;
        this.compressor = null;
        this.noiseBuffer = null;
        this.currentVolume = 0.8;

        // Listen for global sound volume changes
        window.addEventListener('soundVolumeChange', (e) => {
            this.currentVolume = e.detail;
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
            }
        });
    }

    _init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Set up a compressor to prevent clipping and glue sounds together
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

            this.compressor.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            // Create noise buffer for percussion/ticks
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    resume() {
        this._init();
    }

    // --- PLINKO ---
    
    playTick() {
        if (!this.enabled) return;
        this._init();
        if (this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        if (now - this.lastTickTime < 0.03) return; // Prevent machine-gun effect
        this.lastTickTime = now;

        // Wood/plastic click sound: short burst of filtered noise
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // Randomize pitch slightly for organic feel
        filter.frequency.setValueAtTime(1000 + Math.random() * 500, now); 
        filter.Q.setValueAtTime(1.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03); // Very short decay

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);

        noise.start(now);
        noise.stop(now + 0.03);
    }

    playWin(multiplier) {
        if (!this.enabled) return;
        this._init();
        if (this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        
        // Pleasant major chord (C Major or similar depending on multiplier)
        let root = 261.63; // C4
        if (multiplier >= 2) root = 329.63; // E4
        if (multiplier >= 10) root = 392.00; // G4
        if (multiplier >= 50) root = 523.25; // C5

        const playNote = (freq, type, delay, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.05); // smooth attack
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
            
            osc.connect(gain);
            gain.connect(this.compressor);
            
            osc.start(now + delay);
            osc.stop(now + delay + duration);
        };

        // Chime: Root, Major 3rd, Perfect 5th (arpeggio)
        playNote(root, 'sine', 0, 0.4);
        playNote(root * 1.25, 'sine', 0.05, 0.4);
        playNote(root * 1.5, 'sine', 0.1, 0.5);
    }

    // --- CRASH ---

    playCrashTick(multiplier) {
        if (!this.enabled) return;
        this._init();
        if (this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        // Engine rumble ticks very fast
        if (now - this.lastTickTime < 0.03) return;
        this.lastTickTime = now;

        // Engine Rumble: Sawtooth + Lowpass Filter
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        // Base frequency 50Hz, climbs up to 300Hz smoothly
        const freq = 50 + (Math.log10(Math.max(1, multiplier)) * 100);
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        // Filter opens up as multiplier increases, revealing higher harmonics
        const cutoff = 200 + (Math.log10(Math.max(1, multiplier)) * 1000);
        filter.frequency.setValueAtTime(cutoff, now);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    playCrashEnd() {
        if (!this.enabled) return;
        this._init();
        if (this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        
        // Deep explosion impact
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'square'; // harsher impact
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.5); 
        
        oscGain.gain.setValueAtTime(0.6, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        
        // Lowpass to make square sound like deep sub
        const subFilter = this.ctx.createBiquadFilter();
        subFilter.type = 'lowpass';
        subFilter.frequency.setValueAtTime(400, now);
        subFilter.frequency.exponentialRampToValueAtTime(50, now + 0.8);

        osc.connect(subFilter);
        subFilter.connect(oscGain);
        oscGain.connect(this.compressor);
        osc.start(now);
        osc.stop(now + 1.2);

        // Filtered noise explosion
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 1.0);
        filter.Q.setValueAtTime(0.5, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.compressor);
        noise.start(now);
        noise.stop(now + 1.5);
    }

    playCashout() {
        if (!this.enabled) return;
        this._init();
        if (this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        
        // Golden "bling" sound - Ascending magic chime
        const playNote = (freq, delay) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02); // smooth attack
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6); // long tail
            
            osc.connect(gain);
            gain.connect(this.compressor);
            
            osc.start(now + delay);
            osc.stop(now + delay + 0.6);
        };

        // Ascending magic chime (C Major Arp)
        playNote(1046.50, 0);       // C6
        playNote(1318.51, 0.05);    // E6
        playNote(1567.98, 0.1);     // G6
        playNote(2093.00, 0.15);    // C7
    }
}
