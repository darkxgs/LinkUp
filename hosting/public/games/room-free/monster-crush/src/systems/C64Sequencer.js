/**
 * C64Sequencer
 * A self-contained audio engine port of the C64 BASIC/Assembly sequencer.
 * Handles PAL timing, SID logic, and the specific "Noise Snare" trick.
 */
export default class C64Sequencer {
    constructor(scene) {
        this.scene = scene;
        this.context = null;
        this.oscs = [];
        this.isPlaying = false;
        this.currentStep = 0;
        this.timer = null;
        this.noiseBuffer = null;

        // Configuration
        this.PAL_DELAY = 160; // 50Hz / 8
        this.PAD = "                                "; // 32 chars
        this.MASTER_VOLUME = 0.15; // Match game music volume

        // The Hardcoded Music Data
        this.TRACKS = [
            {
                // Voice 1: Melody (Line 81)
                text: ("Q   :   :   R   Q   :   :   M O" + this.PAD).slice(0, 32),
                mask: 82,
                type: 'triangle',
                vol: 0.35,
                attack: 0.05, release: 1.5,
                mode: 'standard'
            },
            {
                // Voice 2: Accompaniment (Line 82)
                text: ("T VT:RQMO T XVTQ:M YXVTQ:M QRQO" + this.PAD).slice(0, 32),
                mask: 70,
                type: 'square',
                vol: 0.2,
                attack: 0.01, release: 0.1,
                mode: 'standard'
            },
            {
                // Voice 3: Bass & Drums (Line 83)
                text: ("AM AMA MHT HTH TJV JVJ VFR FRF R" + this.PAD).slice(0, 32),
                mask: 46,
                type: 'sawtooth',
                vol: 0.3,
                attack: 0.02, release: 0.2,
                mode: 'bass_snare' // Special Logic
            }
        ];

        // Generate Frequency Table (SID 40 -> Hz)
        this.freqTable = [];
        let f_reg = 40;
        for (let i = 0; i < 255; i++) {
            this.freqTable.push(f_reg * 0.06097); // PAL conversion
            f_reg = f_reg * 1.0595;
        }
    }

    start() {
        if (this.isPlaying) return;

        // Check if music is enabled
        if (localStorage.getItem('sugarSplash_music') === 'false') return;

        // 1. Init Audio Context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();

        // 2. Create Noise Buffer (One-time gen)
        const bSize = this.context.sampleRate * 2;
        this.noiseBuffer = this.context.createBuffer(1, bSize, this.context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bSize; i++) data[i] = Math.random() * 2 - 1;

        // 3. Resume & Setup
        this.context.resume().then(() => {
            this.setupVoices();
            this.isPlaying = true;

            // Start Phaser Timer
            this.timer = this.scene.time.addEvent({
                delay: this.PAL_DELAY,
                callback: this.playStep,
                callbackScope: this,
                loop: true
            });
        });
    }

    stop() {
        if (this.timer) {
            this.timer.remove();
            this.timer = null;
        }
        if (this.context) {
            this.context.close();
            this.context = null;
        }
        this.isPlaying = false;
        this.currentStep = 0;
        this.oscs = [];
    }

    setupVoices() {
        this.oscs = [];
        this.TRACKS.forEach(track => {
            const gain = this.context.createGain();
            gain.gain.value = 0;
            gain.connect(this.context.destination);

            let osc = this.context.createOscillator();
            let noiseSrc = null;
            let noiseGain = null;

            if (track.mode === 'bass_snare') {
                // Voice 3: Sawtooth + Noise Source
                osc.type = 'sawtooth';
                osc.connect(gain);

                noiseSrc = this.context.createBufferSource();
                noiseSrc.buffer = this.noiseBuffer;
                noiseSrc.loop = true;

                noiseGain = this.context.createGain();
                noiseGain.gain.value = 0;

                noiseSrc.connect(noiseGain);
                noiseGain.connect(gain);
                noiseSrc.start();
            }
            else if (track.type === 'square') {
                // Voice 2: Softened Square
                osc.type = 'square';
                const filter = this.context.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 3500;
                osc.connect(filter);
                filter.connect(gain);
            }
            else {
                // Voice 1: Triangle
                osc.type = track.type;
                osc.connect(gain);
            }

            osc.start();
            this.oscs.push({ osc, gain, noiseGain, track });
        });
    }

    playStep() {
        if (!this.context || !this.isPlaying) return;

        if (this.currentStep >= 32) this.currentStep = 0;
        const now = this.context.currentTime;

        this.oscs.forEach((v) => {
            const char = v.track.text[this.currentStep];
            const screenCode = this.getScreenCode(char);

            // --- Note Off / Silence / Snare ---
            if (screenCode >= 32) {
                if (v.track.mode === 'bass_snare') {
                    // Mute Tone, Enable Noise, Trigger Release
                    v.osc.frequency.setValueAtTime(0, now);
                    v.noiseGain.gain.setValueAtTime(0.5 * this.MASTER_VOLUME, now);
                    v.gain.gain.cancelScheduledValues(now);
                    v.gain.gain.setValueAtTime(0.3 * this.MASTER_VOLUME, now);
                    v.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                } else {
                    // Standard Release
                    v.gain.gain.cancelScheduledValues(now);
                    v.gain.gain.setTargetAtTime(0, now, v.track.release * 0.2);
                }
            }
            // --- Note On ---
            else {
                if (v.track.mode === 'bass_snare') {
                    v.noiseGain.gain.setValueAtTime(0, now); // Mute Noise
                }

                const idx = screenCode + v.track.mask;
                if (idx < this.freqTable.length) {
                    v.osc.frequency.setValueAtTime(this.freqTable[idx], now);
                    v.gain.gain.cancelScheduledValues(now);
                    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
                    v.gain.gain.linearRampToValueAtTime(v.track.vol * this.MASTER_VOLUME, now + v.track.attack);
                }
            }
        });

        this.currentStep++;
    }

    getScreenCode(char) {
        if (!char) return 32;
        const code = char.toUpperCase().charCodeAt(0);
        if (code >= 65 && code <= 90) return code - 64;
        return 32;
    }

    destroy() {
        this.stop();
        this.scene = null;
    }
}
