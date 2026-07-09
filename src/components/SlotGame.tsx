import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Coins, Award } from 'lucide-react';

interface SymbolConfig {
  char: string;
  name: string;
  color: string;
  multiplier: number;
}

export default function SlotGame() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState<number[]>([0, 0, 0]);
  const [balance, setBalance] = useState(1000);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [isPullingLever, setIsPullingLever] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spinCost = 40;

  const symbols: SymbolConfig[] = [
    { char: '🍒', name: 'كرز', color: '#EF4444', multiplier: 2 },
    { char: '🍋', name: 'ليمون', color: '#10B981', multiplier: 3 },
    { char: '⭐', name: 'نجمة', color: '#FCD34D', multiplier: 5 },
    { char: '🪙', name: 'عملة', color: '#F59E0B', multiplier: 10 },
    { char: '💎', name: 'ألماس', color: '#06B6D4', multiplier: 25 },
    { char: '🔥', name: 'نار', color: '#d21e2a', multiplier: 50 },
    { char: '7️⃣', name: 'سبعة', color: '#EF4444', multiplier: 100 },
  ];

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playReelTick = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  };

  const playWinSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.06);
        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.2);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
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
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(120, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  };

  const spinSlots = () => {
    if (isSpinning) return;
    if (balance < spinCost) {
      alert('الرصيد التجريبي غير كافٍ!');
      return;
    }

    setBalance(prev => prev - spinCost);
    setIsSpinning(true);
    setWinAmount(null);
    setIsPullingLever(true);

    setTimeout(() => {
      setIsPullingLever(false);
    }, 400);

    let spinTicks = 0;
    const interval = setInterval(() => {
      setReels([
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length),
        Math.floor(Math.random() * symbols.length)
      ]);
      playReelTick();
      spinTicks++;

      if (spinTicks >= 18) {
        clearInterval(interval);
        
        const finalReels = [
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length),
          Math.floor(Math.random() * symbols.length)
        ];
        
        setReels(finalReels);
        setIsSpinning(false);

        const [a, b, c] = finalReels;
        if (a === b && b === c) {
          const prizeSymbol = symbols[a]!;
          const win = spinCost * prizeSymbol.multiplier;
          setBalance(prev => prev + win);
          setWinAmount(win);
          playWinSound();
        } else if (a === b || b === c || a === c) {
          let commonIdx = a === b ? a : c;
          const prizeSymbol = symbols[commonIdx!]!;
          const win = Math.round(spinCost * prizeSymbol.multiplier * 0.4);
          setBalance(prev => prev + win);
          setWinAmount(win);
          playWinSound();
        } else {
          playLoseSound();
        }
      }
    }, 90);
  };

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* هيدر */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#d21e2a" /> لعبة لاكي 777 (Slot Machine)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>أداة معاينة واختبار احتمالات ومضاعفات ماكينة السلوت التقليدية</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBalance(1000); setReels([0, 0, 0]); setWinAmount(null); }} style={{ color: 'var(--danger)' }}>
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
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>تكلفة الدورة</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <Coins size={16} color="var(--brand-primary)" />
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-primary)' }}>{spinCost} كوين</span>
            </div>
          </div>
        </div>

        {/* نتيجة الجائزة */}
        <div style={{ minHeight: 38, textAlign: 'center', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {winAmount !== null ? (
            <div style={{
              padding: '6px 20px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', fontWeight: 800, fontSize: 14
            }}>
              تهانينا! فوز بجائزة قيمتها +{winAmount} كوين! 🎉
            </div>
          ) : isSpinning ? (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>جاري تدوير بكرات الحظ... 🎰</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>اضغط على زر الدوران أو اسحب الذراع لتجربة حظك!</span>
          )}
        </div>

        {/* كابينة السلوت الواقعية */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          height: 280,
          margin: '0 auto 24px auto',
          position: 'relative',
          backgroundImage: 'url(/images/slot_cabinet.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.65))',
        }}>
          {/* ذراع الماكينة الجانبي (Lever) */}
          <div 
            onClick={spinSlots}
            style={{
              position: 'absolute',
              right: '-12px',
              top: '25%',
              width: '16px',
              height: '90px',
              cursor: isSpinning ? 'default' : 'pointer',
              transformOrigin: 'center bottom',
              transform: isPullingLever ? 'rotateX(55deg) scaleY(0.8)' : 'rotateX(0deg)',
              transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }} 
          >
            {/* مقبض الذراع الدائري */}
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #ef4444 0%, #7f1d1d 100%)',
              border: '2px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 5px rgba(0,0,0,0.4)',
              marginBottom: '-3px'
            }} />
            {/* ساق المعدن للذراع */}
            <div style={{
              width: '6px',
              flex: 1,
              background: 'linear-gradient(to right, #f3f4f6, #9ca3af, #374151)',
              border: '1px solid rgba(0, 0, 0, 0.4)',
              borderRadius: '3px'
            }} />
          </div>

          {/* شاشة البكرات الزجاجية (تتطابق تماماً مع إطار الكابينة الزجاجي بالمنتصف) */}
          <div style={{
            position: 'absolute',
            top: '31%',
            left: '17.5%',
            width: '65%',
            height: '37%',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px 8px',
            background: 'rgba(5, 5, 10, 0.88)',
            border: '2px solid rgba(236, 72, 153, 0.3)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.95), 0 0 8px rgba(236, 72, 153, 0.15)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            {reels.map((symbolIdx, index) => {
              const sym = symbols[symbolIdx] || symbols[0]!;
              return (
                <div 
                  key={index} 
                  style={{
                    flex: 1,
                    height: '100%',
                    background: 'linear-gradient(to bottom, #111827 0%, #1f2937 25%, #374151 50%, #1f2937 75%, #111827 100%)',
                    border: '1.5px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.4rem',
                    filter: isSpinning ? 'blur(2px)' : 'none',
                    boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)',
                    transform: isSpinning ? `translateY(${Math.sin(Date.now() + index) * 3}px)` : 'translateY(0)',
                    transition: 'transform 0.05s ease-in-out',
                  }}
                >
                  <span style={{ 
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.85))',
                    userSelect: 'none'
                  }}>
                    {sym.char}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* أزرار التحكم */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button 
            className="btn btn-primary" 
            onClick={spinSlots} 
            disabled={isSpinning}
            style={{ 
              width: '100%', 
              maxWidth: 280, 
              height: 48, 
              fontSize: 16, 
              fontWeight: 'bold', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
              background: 'linear-gradient(135deg, #d21e2a 0%, #f05a5a 100%)',
              border: 'none'
            }}
          >
            🎰 تدوير البكرات
          </button>
        </div>

        {/* جدول الأرباح */}
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>جدول مضاعفات الأرباح لتطابق 3 رموز:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {symbols.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--card-bg)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span>{s.char}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--gold-dark)' }}>×{s.multiplier}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
