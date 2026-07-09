import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Coins, Flame } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export default function CrashGame() {
  const [gameState, setGameState] = useState<'idle' | 'running' | 'crashed' | 'cashed_out'>('idle');
  const [multiplier, setMultiplier] = useState(1.00);
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(50);
  const [cashOutMult, setCashOutMult] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const runIntervalRef = useRef<number | null>(null);
  const crashPointRef = useRef(1.00);
  const engineSoundRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const stateRef = useRef(gameState);
  const multRef = useRef(multiplier);
  const lastStateRef = useRef(gameState);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ amount: 0 });

  useEffect(() => {
    lastStateRef.current = stateRef.current;
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    multRef.current = multiplier;
  }, [multiplier]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playEngineSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, now);
      gain.gain.setValueAtTime(0.06, now);

      osc.start(now);
      engineSoundRef.current = { osc, gain };
    } catch {}
  };

  const updateEngineFrequency = (mult: number) => {
    try {
      if (engineSoundRef.current && audioCtxRef.current) {
        const freq = Math.min(240, 65 + (mult - 1) * 35);
        engineSoundRef.current.osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      }
    } catch {}
  };

  const stopEngineSound = () => {
    try {
      if (engineSoundRef.current) {
        engineSoundRef.current.osc.stop();
        engineSoundRef.current = null;
      }
    } catch {}
  };

  const playCashOutSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  };

  const playExplosionSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 0.55;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(10, now + 0.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseSource.start(now);
    } catch {}
  };

  const generateCrashPoint = () => {
    if (Math.random() < 0.08) return 1.00;
    const rand = Math.random();
    const crash = parseFloat((95 / (100 - rand * 95) + 0.05).toFixed(2));
    return Math.max(1.01, crash);
  };

  const startFlight = () => {
    if (gameState === 'running') return;
    if (balance < betAmount) {
      alert('الرصيد التجريبي غير كافٍ!');
      return;
    }

    setBalance(prev => prev - betAmount);
    setGameState('running');
    setMultiplier(1.00);
    setCashOutMult(null);
    crashPointRef.current = generateCrashPoint();
    particlesRef.current = [];

    playEngineSound();

    const startTime = Date.now();

    runIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentMult = parseFloat((1 + Math.pow(elapsed * 0.45, 1.7)).toFixed(2));
      setMultiplier(currentMult);
      updateEngineFrequency(currentMult);

      if (currentMult >= crashPointRef.current) {
        clearInterval(runIntervalRef.current!);
        stopEngineSound();
        playExplosionSound();
        setGameState('crashed');
      }
    }, 50);
  };

  const cashOut = () => {
    if (gameState !== 'running') return;
    clearInterval(runIntervalRef.current!);
    stopEngineSound();
    playCashOutSound();

    const win = Math.round(betAmount * multiplier);
    setBalance(prev => prev + win);
    setCashOutMult(multiplier);
    setGameState('cashed_out');
  };

  // Canvas loop for continuous simulation (60 FPS rendering)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Camera Shake
      ctx.save();
      if (shakeRef.current.amount > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current.amount;
        const dy = (Math.random() - 0.5) * shakeRef.current.amount;
        ctx.translate(dx, dy);
        shakeRef.current.amount *= 0.88;
        if (shakeRef.current.amount < 0.2) shakeRef.current.amount = 0;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Space Radar HUD
      ctx.fillStyle = '#060211';
      ctx.fillRect(0, 0, width, height);

      // Radar Concentric Circles
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
      ctx.lineWidth = 1;
      for (let r = 50; r <= width; r += 50) {
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HUD Radar Grid
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.05)';
      ctx.beginPath();
      for (let x = 0; x < width; x += 25) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 25) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Sweeping radar arm
      const sweepAngle = (Date.now() * 0.001) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.lineTo(width / 2 + Math.cos(sweepAngle) * width, height / 2 + Math.sin(sweepAngle) * width);
      ctx.stroke();

      // Axis lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(35, 15);
      ctx.lineTo(35, height - 25);
      ctx.lineTo(width - 15, height - 25);
      ctx.stroke();

      // Draw active flight line
      const currentMult = multRef.current;
      const currentGameState = stateRef.current;
      
      const maxVal = Math.max(3.0, crashPointRef.current);
      const progress = Math.min(1.0, (currentMult - 1) / maxVal);
      const endX = 35 + progress * (width - 65);
      const endY = (height - 25) - progress * (height - 55);

      if (currentGameState === 'running' || currentGameState === 'cashed_out' || currentGameState === 'crashed') {
        // Flight Line
        ctx.strokeStyle = currentGameState === 'crashed' ? 'rgba(239, 68, 68, 0.4)' : '#d21e2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(35, height - 25);
        ctx.quadraticCurveTo((35 + endX) / 2, height - 25, endX, endY);
        ctx.stroke();

        // Spawn particles
        if (currentGameState === 'running') {
          for (let i = 0; i < 2; i++) {
            particlesRef.current.push({
              x: endX - 4,
              y: endY + (Math.random() - 0.5) * 4,
              vx: -2 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 1.5,
              alpha: 1.0,
              size: Math.random() * 3 + 2,
              color: Math.random() > 0.5 ? '#d21e2a' : '#F59E0B'
            });
          }
        }

        // Handle just crashed transition
        if (currentGameState === 'crashed' && lastStateRef.current === 'running') {
          shakeRef.current.amount = 14;
          for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1.5;
            particlesRef.current.push({
              x: endX,
              y: endY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              alpha: 1.0,
              size: Math.random() * 6 + 3,
              color: Math.random() > 0.6 ? '#EF4444' : Math.random() > 0.3 ? '#F59E0B' : '#FFD700'
            });
          }
          lastStateRef.current = 'crashed'; // ensure it only runs once
        }
      }

      // 2. Draw & Update particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.035;
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      // Filter out dead particles
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

      // 3. Draw Rocket Ship or Explosion Text
      if (currentGameState === 'running' || currentGameState === 'cashed_out') {
        ctx.save();
        ctx.shadowColor = '#d21e2a';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#d21e2a';
        // Draw elegant spaceship triangle pointing top-right
        ctx.beginPath();
        ctx.moveTo(endX + 8, endY);
        ctx.lineTo(endX - 8, endY - 4);
        ctx.lineTo(endX - 5, endY);
        ctx.lineTo(endX - 8, endY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (currentGameState === 'crashed') {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText('💥 CRASHED', endX, endY - 14);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* هيدر */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color="#e11212" /> لعبة الصاروخ (Crash Rocket)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>أداة معاينة واختبار احتمالات لعبة انطلاق الصاروخ وتوقيت سحب الأرباح</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBalance(1000); setGameState('idle'); setMultiplier(1.00); setCashOutMult(null); }} style={{ color: 'var(--danger)' }}>
            إعادة تعيين
          </button>
        </div>

        {/* محاكاة الرصيد وتكلفة اللعب */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>رصيدك التجريبي</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <Coins size={16} color="#F59E0B" />
              <span style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{balance} كوين</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>قيمة الرهان:</span>
              <input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(Math.max(10, +e.target.value))}
                disabled={gameState === 'running'}
                style={{ width: 80, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>
          </div>
        </div>

        {/* مؤشر المضاعف المباشر */}
        <div style={{
          background: 'rgba(0,0,0,0.06)', borderRadius: 20, border: '2px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 10px', marginBottom: 20
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>المضاعف الحالي</span>
          <span style={{
            fontSize: 48, fontWeight: 900, 
            color: gameState === 'crashed' ? '#EF4444' : gameState === 'cashed_out' ? '#10B981' : '#e11212',
            textShadow: '0 0 15px rgba(225, 18, 18, 0.3)'
          }}>
            {multiplier.toFixed(2)}x
          </span>

          {gameState === 'crashed' && (
            <span style={{ color: '#EF4444', fontWeight: 800, fontSize: 14, marginTop: 4 }}>💥 انفجر الصاروخ عند {crashPointRef.current.toFixed(2)}x!</span>
          )}
          {gameState === 'cashed_out' && cashOutMult && (
            <span style={{ color: '#10B981', fontWeight: 800, fontSize: 14, marginTop: 4 }}>🎉 سحبت أرباحك بنجاح عند {cashOutMult.toFixed(2)}x!</span>
          )}
        </div>

        {/* الكانفاس للرسم */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <canvas ref={canvasRef} width="400" height="200" style={{ width: '100%', maxWidth: 400, background: '#060211', borderRadius: 12, border: '2px solid var(--border)', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }} />
        </div>

        {/* أزرار التشغيل والتحكم وسحب الأرباح */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {gameState === 'running' ? (
            <button 
              className="btn" 
              onClick={cashOut}
              style={{
                width: '100%', maxWidth: 280, height: 48, fontSize: 16, fontWeight: 'bold', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', border: 'none',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
              }}
            >
              💰 سحب الأرباح (+{Math.round(betAmount * multiplier)} كوين)
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={startFlight} 
              disabled={gameState === 'running'}
              style={{ width: '100%', maxWidth: 280, height: 48, fontSize: 16, fontWeight: 'bold', justifyContent: 'center', gap: 8 }}
            >
              🚀 أطلق الصاروخ
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
