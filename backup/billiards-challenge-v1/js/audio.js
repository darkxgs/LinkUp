// =============================================================================
// audio.js — Simple audio manager to load and play sounds.
// =============================================================================

class AudioManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
    this.audioContext = null;
    
    // We'll initialize AudioContext on first user interaction to comply with browser policies.
    this.initAudioContext = () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Load sounds after context is created so we can decode them
        this.loadSound('collide', 'assets/sounds/BallsCollide.wav');
        this.loadSound('strike', 'assets/sounds/Strike.wav');
        this.loadSound('hole', 'assets/sounds/Hole.wav');
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };

    window.addEventListener('mousedown', this.initAudioContext, { once: true });
    window.addEventListener('touchstart', this.initAudioContext, { once: true });
  }

  async loadSound(name, url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds[name] = audioBuffer;
    } catch (e) {
      console.warn(`Failed to load sound ${name} from ${url}`, e);
    }
  }

  play(name, volume = 1.0) {
    if (!this.enabled || !this.audioContext || !this.sounds[name]) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds[name];
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
  }
}

window.audio = new AudioManager();
