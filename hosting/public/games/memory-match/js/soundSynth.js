(() => {
class SoundSynth {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('match_shapes_muted') === 'true';
  }

  initContext() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('match_shapes_muted', this.isMuted.toString());
    return this.isMuted;
  }

  getMuteState() {
    return this.isMuted;
  }

  createOscillator(type, freq, duration, gainStart = 0.1) {
    this.initContext();
    if (!this.ctx || this.isMuted) return null;
    
    // Resume context if suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    return { osc, gainNode, time: this.ctx.currentTime };
  }

  playFlip() {
    const sound = this.createOscillator('sine', 150, 0.15, 0.15);
    if (!sound) return;
    sound.osc.frequency.exponentialRampToValueAtTime(450, sound.time + 0.12);
    sound.osc.start(sound.time);
    sound.osc.stop(sound.time + 0.15);
  }

  playMatch() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Sparkling arpeggio (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const now = this.ctx.currentTime;
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      
      gainNode.gain.setValueAtTime(0, now + idx * 0.06);
      gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.4);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  }

  playMismatch() {
    const sound = this.createOscillator('sawtooth', 120, 0.35, 0.2);
    if (!sound) return;
    
    // Add low-pass filter sweep to make it a fat synthetic buzz
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, sound.time);
    filter.frequency.exponentialRampToValueAtTime(80, sound.time + 0.3);
    
    sound.osc.disconnect();
    sound.osc.connect(filter);
    filter.connect(sound.gainNode);
    
    sound.osc.frequency.linearRampToValueAtTime(70, sound.time + 0.3);
    sound.osc.start(sound.time);
    sound.osc.stop(sound.time + 0.35);
  }

  playShuffle() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    // Play a sequence of quick click sweeps
    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      // alternating pitch sweeps
      const startFreq = i % 2 === 0 ? 300 : 150;
      const endFreq = i % 2 === 0 ? 100 : 400;
      
      osc.frequency.setValueAtTime(startFreq, now + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + i * 0.08 + 0.06);
      
      gainNode.gain.setValueAtTime(0.08, now + i * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.06);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.06);
    }
  }

  playTick() {
    // Sharp woodblock pop
    const sound = this.createOscillator('sine', 900, 0.05, 0.1);
    if (!sound) return;
    sound.osc.start(sound.time);
    sound.osc.stop(sound.time + 0.05);
  }

  playClick() {
    // Tiny UI feedback pop
    const sound = this.createOscillator('sine', 1200, 0.03, 0.08);
    if (!sound) return;
    sound.osc.start(sound.time);
    sound.osc.stop(sound.time + 0.03);
  }

  playVictory() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    // Major chord progression: C4 -> E4 -> G4 -> C5 -> E5 -> G5 -> C6
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gainNode.gain.setValueAtTime(0, now + idx * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.6);
    });
  }

  playDefeat() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(55, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.2);

    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }
}

window.soundSynth = new SoundSynth();
})();
