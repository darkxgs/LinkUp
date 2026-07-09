(() => {
class ParticleSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.ambientParticles = [];
    this.active = false;
    
    // Bind animation frame
    this.tick = this.tick.bind(this);
  }

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    this.active = true;
    this.createAmbientDust(40);
    requestAnimationFrame(this.tick);
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createAmbientDust(count) {
    this.ambientParticles = [];
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.2,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1,
        maxAlpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  emitSparks(x, y, color) {
    if (!this.canvas) return;
    const sparkCount = 25;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 3;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 2,
        color: color || '#ffffff',
        alpha: 1,
        life: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  emitVictoryConfetti() {
    if (!this.canvas) return;
    const confettiColors = ['#FF3B30', '#007AFF', '#34C759', '#FFCC00', '#FF2D55', '#AF52DE', '#FF9500'];
    const confettiCount = 120;
    
    for (let i = 0; i < confettiCount; i++) {
      this.particles.push({
        type: 'confetti',
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 3,
        width: Math.random() * 10 + 6,
        height: Math.random() * 6 + 4,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        wobble: Math.random() * Math.PI,
        wobbleSpeed: Math.random() * 0.05 + 0.02
      });
    }
  }

  tick() {
    if (!this.active || !this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 1. Draw & Update Ambient Dust
    this.ctx.shadowBlur = 0;
    this.ambientParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += 0.01;
      p.alpha = p.maxAlpha * (0.5 + 0.5 * Math.sin(p.phase));
      
      if (p.y < -10) {
        p.y = this.canvas.height + 10;
        p.x = Math.random() * this.canvas.width;
      }
      if (p.x < -10 || p.x > this.canvas.width + 10) {
        p.x = Math.random() * this.canvas.width;
      }
      
      this.ctx.fillStyle = `rgba(96, 165, 250, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // 2. Draw & Update Active FX Particles (Sparks & Confetti)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      if (p.type === 'spark') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94; // friction
        p.vy *= 0.94;
        p.vy += 0.15; // gravity
        p.life -= p.decay;
        
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        this.ctx.fill();
      } 
      else if (p.type === 'confetti') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // slow fall gravity
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        
        // sway left and right
        p.x += Math.sin(p.wobble) * 0.5;
        
        if (p.y > this.canvas.height + 20) {
          this.particles.splice(i, 1);
          continue;
        }
        
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = p.color;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation * Math.PI / 180);
        // Scale width with wobble to give 3D flipping effect
        const scaleX = Math.sin(p.wobble);
        this.ctx.scale(scaleX, 1);
        
        this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        this.ctx.restore();
      }
    }
    
    // Reset shadow blur for other canvas context drawing
    this.ctx.shadowBlur = 0;
    
    requestAnimationFrame(this.tick);
  }
}

window.particleSystem = new ParticleSystem();
})();
