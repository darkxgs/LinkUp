import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Award, Coins, Play, RotateCcw } from 'lucide-react';

interface Prize {
  name: string;
  color: string;
  textColor: string;
  type: 'coins' | 'item' | 'empty';
  value: number;
}

export default function WheelGame() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [balance, setBalance] = useState(1000);
  const [rotation, setRotation] = useState(0);
  const [prizeHistory, setPrizeHistory] = useState<string[]>([]);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [spinCount, setSpinCount] = useState(0);

  const wheelRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const spinCost = 30;

  const prizes: Prize[] = [
    { name: '10 كوين', color: 'rgba(225, 18, 18, 0.65)', textColor: '#FFFFFF', type: 'coins', value: 10 },
    { name: 'إطار فضي', color: 'rgba(20, 184, 166, 0.65)', textColor: '#FFFFFF', type: 'item', value: 0 },
    { name: 'حظاً أوفر', color: 'rgba(75, 85, 99, 0.65)', textColor: '#FFFFFF', type: 'empty', value: 0 },
    { name: '50 كوين', color: 'rgba(236, 72, 153, 0.65)', textColor: '#FFFFFF', type: 'coins', value: 50 },
    { name: 'هدية قلب', color: 'rgba(59, 130, 246, 0.65)', textColor: '#FFFFFF', type: 'item', value: 0 },
    { name: '100 كوين', color: 'rgba(245, 158, 11, 0.65)', textColor: '#000000', type: 'coins', value: 100 },
    { name: 'عضوية VIP', color: 'rgba(239, 68, 68, 0.65)', textColor: '#FFFFFF', type: 'item', value: 0 },
    { name: '500 كوين', color: 'rgba(16, 185, 129, 0.65)', textColor: '#FFFFFF', type: 'coins', value: 500 },
  ];

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playTickSound = () => {
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
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  };

  const playWinSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.22);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.22);
      });
    } catch {}
  };

  const playLoseSound = () => {
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
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  };

  const startSpin = () => {
    if (isSpinning) return;
    if (balance < spinCost) {
      alert('الرصيد التجريبي غير كافٍ لتدوير العجلة!');
      return;
    }

    setBalance(prev => prev - spinCost);
    setIsSpinning(true);
    setSelectedPrize(null);

    const prizeCount = prizes.length;
    const targetPrizeIndex = spinCount === 0 ? 7 : Math.floor(Math.random() * prizeCount);
    setSpinCount(prev => prev + 1);
    const prizeDeg = 360 / prizeCount;

    const targetDegree = 360 - (targetPrizeIndex * prizeDeg) - (prizeDeg / 2);
    const totalSpinRotation = rotation + 1800 + targetDegree - (rotation % 360);

    setRotation(totalSpinRotation);

    let currentAngle = rotation;
    const start = Date.now();
    const duration = 4000;

    const triggerTicks = () => {
      const elapsed = Date.now() - start;
      if (elapsed < duration) {
        const progress = elapsed / duration;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const angle = rotation + (totalSpinRotation - rotation) * easeProgress;

        const lastSector = Math.floor(currentAngle / prizeDeg);
        const currentSector = Math.floor(angle / prizeDeg);

        if (currentSector !== lastSector) {
          playTickSound();
          if (pointerRef.current) {
            pointerRef.current.style.transform = 'rotate(-18deg)';
            setTimeout(() => {
              if (pointerRef.current) {
                pointerRef.current.style.transform = 'rotate(0deg)';
              }
            }, 60);
          }
        }

        currentAngle = angle;
        requestAnimationFrame(triggerTicks);
      }
    };

    requestAnimationFrame(triggerTicks);

    setTimeout(() => {
      setIsSpinning(false);
      const prize = prizes[targetPrizeIndex];
      setSelectedPrize(prize);

      if (prize.type === 'coins') {
        setBalance(prev => prev + prize.value);
        playWinSound();
      } else if (prize.type === 'item') {
        playWinSound();
      } else {
        playLoseSound();
      }

      setPrizeHistory(prev => [prize.name, ...prev.slice(0, 14)]);
    }, duration);
  };

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* الهيدر */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#F59E0B" /> عجلة الحظ التفاعلية (Lucky Wheel)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>لوحة معاينة وضبط عجلة الحظ قبل إدراجها داخل الـ WebView بالتطبيق</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBalance(1000); setPrizeHistory([]); setSelectedPrize(null); }} style={{ color: 'var(--danger)' }}>
            إعادة التعيين
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
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>تكلفة الدورة الواحدة</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <Coins size={16} color="var(--brand-primary)" />
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-primary)' }}>{spinCost} كوين</span>
            </div>
          </div>
        </div>

        {/* نتيجة الجائزة الحالية */}
        <div style={{ minHeight: 38, textAlign: 'center', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selectedPrize ? (
            <div style={{
              padding: '8px 20px',
              borderRadius: 20,
              background: selectedPrize.type === 'empty' ? 'rgba(75, 85, 99, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${selectedPrize.type === 'empty' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              color: selectedPrize.type === 'empty' ? 'var(--text-muted)' : 'var(--success)',
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Award size={16} />
              {selectedPrize.type === 'empty' ? 'حظاً أوفر في المرة القادمة!' : `مبروك! حصلت على: ${selectedPrize.name}`}
            </div>
          ) : isSpinning ? (
            <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, animation: 'pulse 1s infinite' }}>جاري تدوير العجلة... 🌀</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>اضغط على زر "حظ!" لبدء تدوير العجلة!</span>
          )}
        </div>

        {/* منصة تدوير العجلة البصرية */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 280, marginBottom: 24 }}>
          {/* مؤشر الاستقرار العلوي (Pointer) */}
          <div 
            ref={pointerRef}
            style={{
              position: 'absolute',
              top: 4,
              left: 'calc(50% - 15px)',
              width: 30,
              height: 45,
              backgroundImage: 'linear-gradient(to bottom, #FFD700, #B8860B 35%, #EF4444 40%, #991B1B 100%)',
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
              zIndex: 10,
              transformOrigin: '50% 10%',
              transition: 'transform 0.05s ease-out'
            }} 
          />

          {/* العجلة الدائرية SVG */}
          <svg
            ref={wheelRef}
            width="240"
            height="240"
            viewBox="0 0 200 200"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none',
              filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.6))',
              backgroundImage: 'url(/images/casino_wheel.png)',
              backgroundSize: '102% 102%',
              backgroundPosition: 'center',
              borderRadius: '50%',
              border: '6px solid #180b0d',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
            }}
          >
            {prizes.map((prize, idx) => {
              const count = prizes.length;
              const angle = 360 / count;
              const startAngle = idx * angle;
              const endAngle = (idx + 1) * angle;

              const radStart = (startAngle * Math.PI) / 180;
              const radEnd = (endAngle * Math.PI) / 180;

              const x1 = 100 + 100 * Math.cos(radStart);
              const y1 = 100 + 100 * Math.sin(radStart);
              const x2 = 100 + 100 * Math.cos(radEnd);
              const y2 = 100 + 100 * Math.sin(radEnd);

              const d = `M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`;

              const textAngle = startAngle + angle / 2;
              const textRad = (textAngle * Math.PI) / 180;
              const tx = 100 + 56 * Math.cos(textRad);
              const ty = 100 + 56 * Math.sin(textRad);

              return (
                <g key={idx}>
                  <path d={d} fill={prize.color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  <text
                    x={tx}
                    y={ty}
                    fill={prize.textColor}
                    fontSize="7.5"
                    fontWeight="900"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${textAngle + 180}, ${tx}, ${ty})`}
                  >
                    {prize.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* زر التدوير الأوسط العائم */}
          <button
            onClick={startSpin}
            disabled={isSpinning}
            style={{
              position: 'absolute',
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #B8860B 100%)',
              border: '4px solid #ffffff',
              boxShadow: '0 6px 15px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.6)',
              color: '#000000',
              fontWeight: 900,
              fontSize: 13,
              cursor: isSpinning ? 'default' : 'pointer',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s',
              transform: isSpinning ? 'scale(0.95)' : 'scale(1)'
            }}
          >
            {isSpinning ? '🌀' : 'حظ!'}
          </button>
        </div>

        {/* سجل الجوائز الفائزة */}
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>سجل جوائزك الأخيرة:</p>
          {prizeHistory.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>لا توجد جوائز بعد، ابدأ التدوير!</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {prizeHistory.map((item, i) => (
                <span key={i} style={{
                  background: i === 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.06)',
                  color: i === 0 ? '#F59E0B' : 'var(--text-primary)',
                  border: i === 0 ? '1px solid #F59E0B' : '1px solid var(--border)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

