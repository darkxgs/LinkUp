import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Dices, RotateCcw, Coins } from 'lucide-react';

type BetType = 'under7' | 'exactly7' | 'over7' | 'odd' | 'even' | 'doubles' | null;

export default function DiceGame() {
  const [isRolling, setIsRolling] = useState(false);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(6);
  const [mode, setMode] = useState<'single' | 'double'>('double');
  
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(50);
  const [selectedBet, setSelectedBet] = useState<BetType>(null);
  const [gameResultMsg, setGameResultMsg] = useState<{ text: string; success: boolean } | null>(null);

  const [history, setHistory] = useState<number[]>([]);
  const [distribution, setDistribution] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  const dice1Ref = useRef<HTMLDivElement>(null);
  const dice2Ref = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playRollSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);

      setTimeout(() => {
        const osc = ctx.createOscillator();
        const hitGain = ctx.createGain();
        osc.connect(hitGain);
        hitGain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        hitGain.gain.setValueAtTime(0.3, ctx.currentTime);
        hitGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }, 350);

    } catch {}
  };

  const faceRotations: Record<number, { x: number; y: number }> = {
    1: { x: 0, y: 0 },
    2: { x: -90, y: 0 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 },
    5: { x: 90, y: 0 },
    6: { x: 180, y: 0 }
  };

  const rollDice = () => {
    if (isRolling) return;
    
    if (selectedBet && balance < betAmount) {
      alert('الرصيد غير كافٍ للرهان المحدد!');
      return;
    }

    setIsRolling(true);
    setGameResultMsg(null);
    playRollSound();

    if (selectedBet) {
      setBalance(prev => prev - betAmount);
    }

    const nextVal1 = Math.floor(Math.random() * 6) + 1;
    const nextVal2 = Math.floor(Math.random() * 6) + 1;

    const extraTurnsX = (Math.floor(Math.random() * 3) + 3) * 360;
    const extraTurnsY = (Math.floor(Math.random() * 3) + 3) * 360;

    if (dice1Ref.current) {
      const rot = faceRotations[nextVal1]!;
      dice1Ref.current.style.transform = `rotateX(${rot.x + extraTurnsX}deg) rotateY(${rot.y + extraTurnsY}deg)`;
    }

    if (dice2Ref.current && mode === 'double') {
      const rot = faceRotations[nextVal2]!;
      dice2Ref.current.style.transform = `rotateX(${rot.x + extraTurnsX}deg) rotateY(${rot.y + extraTurnsY}deg)`;
    }

    setTimeout(() => {
      setDice1(nextVal1);
      if (mode === 'double') {
        setDice2(nextVal2);
      }
      setIsRolling(false);

      const results = mode === 'double' ? [nextVal1, nextVal2] : [nextVal1];
      setDistribution(prev => {
        const nextDist = { ...prev };
        results.forEach(val => { nextDist[val] = (nextDist[val] || 0) + 1; });
        return nextDist;
      });

      const totalSum = mode === 'double' ? nextVal1 + nextVal2 : nextVal1;
      setHistory(prev => [totalSum, ...prev.slice(0, 19)]);

      if (selectedBet) {
        let didWin = false;
        let payoutMultiplier = 0;

        if (mode === 'double') {
          if (selectedBet === 'under7' && totalSum < 7) { didWin = true; payoutMultiplier = 2; }
          else if (selectedBet === 'exactly7' && totalSum === 7) { didWin = true; payoutMultiplier = 5; }
          else if (selectedBet === 'over7' && totalSum > 7) { didWin = true; payoutMultiplier = 2; }
          else if (selectedBet === 'odd' && totalSum % 2 !== 0) { didWin = true; payoutMultiplier = 2; }
          else if (selectedBet === 'even' && totalSum % 2 === 0) { didWin = true; payoutMultiplier = 2; }
          else if (selectedBet === 'doubles' && nextVal1 === nextVal2) { didWin = true; payoutMultiplier = 6; }
        } else {
          if (selectedBet === 'odd' && totalSum % 2 !== 0) { didWin = true; payoutMultiplier = 2; }
          else if (selectedBet === 'even' && totalSum % 2 === 0) { didWin = true; payoutMultiplier = 2; }
        }

        if (didWin) {
          const winAmt = betAmount * payoutMultiplier;
          setBalance(prev => prev + winAmt);
          setGameResultMsg({ text: `فوز! المجموع هو ${totalSum}، ربحت ${winAmt} كوينز تجريبية! 🎉`, success: true });
        } else {
          setGameResultMsg({ text: `خسارة! المجموع هو ${totalSum}. حاول مجدداً! ❌`, success: false });
        }
      }

    }, 850);
  };

  const resetAll = () => {
    setBalance(1000);
    setHistory([]);
    setDistribution({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    setSelectedBet(null);
    setGameResultMsg(null);
    if (dice1Ref.current) dice1Ref.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    if (dice2Ref.current) dice2Ref.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    setDice1(1);
    setDice2(6);
  };

  const totalRolls = Object.values(distribution).reduce((s, v) => s + v, 0);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* هيدر اللعبة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#e11212" /> محاكاة لعبة النرد الـ 3D التفاعلية
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>لوحة تحكم كاملة لاختبار احتمالات ومضاعفات لعبة النرد</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetAll} style={{ color: 'var(--danger)', gap: 6 }}>
            <RotateCcw size={14} /> إعادة تعيين التجربة
          </button>
        </div>

        {/* وضع اللعب: فردي أو مزدوج */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <button 
            className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setMode('single'); setSelectedBet(null); setGameResultMsg(null); }}
            style={{ justifyContent: 'center' }}
          >
            نرد فردي (1 Die)
          </button>
          <button 
            className={`btn ${mode === 'double' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setMode('double'); setSelectedBet(null); setGameResultMsg(null); }}
            style={{ justifyContent: 'center' }}
          >
            نرد مزدوج (2 Dice)
          </button>
        </div>

        {/* محاكاة المحفظة والرهان التجريبي */}
        <div style={{ background: 'var(--bg-app)', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Coins size={18} color="#F59E0B" />
              <span style={{ fontWeight: 700, fontSize: 15 }}>محفظتك التجريبية: <span style={{ color: '#F59E0B' }}>{balance} كوين</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>مبلغ الرهان:</span>
              <input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(Math.max(10, +e.target.value))}
                style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>توقع نتيجة الرمية (اختياري للرهان):</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mode === 'double' && (
              <>
                <BetButton label="أقل من 7 (×2)" active={selectedBet === 'under7'} onClick={() => setSelectedBet(selectedBet === 'under7' ? null : 'under7')} />
                <BetButton label="بالضبط 7 (×5)" active={selectedBet === 'exactly7'} onClick={() => setSelectedBet(selectedBet === 'exactly7' ? null : 'exactly7')} />
                <BetButton label="أعلى من 7 (×2)" active={selectedBet === 'over7'} onClick={() => setSelectedBet(selectedBet === 'over7' ? null : 'over7')} />
                <BetButton label="زوج متطابق (×6)" active={selectedBet === 'doubles'} onClick={() => setSelectedBet(selectedBet === 'doubles' ? null : 'doubles')} />
              </>
            )}
            <BetButton label="عدد فردي (×2)" active={selectedBet === 'odd'} onClick={() => setSelectedBet(selectedBet === 'odd' ? null : 'odd')} />
            <BetButton label="عدد زوجي (×2)" active={selectedBet === 'even'} onClick={() => setSelectedBet(selectedBet === 'even' ? null : 'even')} />
          </div>
        </div>

        {/* نتيجة الرهان */}
        {gameResultMsg && (
          <div style={{
            padding: 12, 
            borderRadius: 10, 
            background: gameResultMsg.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${gameResultMsg.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: gameResultMsg.success ? 'var(--success)' : 'var(--danger)',
            fontSize: 14,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 20
          }}>
            {gameResultMsg.text}
          </div>
        )}

        {/* منطقة عرض النرد 3D - طاولة الكازينو الخضراء المخملية */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 50,
          minHeight: 200,
          background: 'radial-gradient(circle, #0F5132 0%, #062F1D 100%)',
          border: '10px solid #3e2723',
          borderRadius: 24,
          padding: 30,
          marginBottom: 24,
          boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.85), 0 8px 16px rgba(0,0,0,0.5)',
          position: 'relative'
        }}>
          {/* نرد 1 (عاجي رخامي) */}
          <div style={{ perspective: 400 }}>
            <div ref={dice1Ref} className="dice-cube" style={cubeStyle}>
              <div style={{ ...faceStyle1, transform: 'rotateY(0deg) translateZ(40px)' }}><Dots count={dice1} color="#e11212" /></div>
              <div style={{ ...faceStyle1, transform: 'rotateY(180deg) translateZ(40px)' }}><Dots count={6} color="#e11212" /></div>
              <div style={{ ...faceStyle1, transform: 'rotateY(90deg) translateZ(40px)' }}><Dots count={3} color="#e11212" /></div>
              <div style={{ ...faceStyle1, transform: 'rotateY(-90deg) translateZ(40px)' }}><Dots count={4} color="#e11212" /></div>
              <div style={{ ...faceStyle1, transform: 'rotateX(90deg) translateZ(40px)' }}><Dots count={5} color="#e11212" /></div>
              <div style={{ ...faceStyle1, transform: 'rotateX(-90deg) translateZ(40px)' }}><Dots count={2} color="#e11212" /></div>
            </div>
          </div>

          {/* نرد 2 (ياقوت أحمر كريستالي) - يظهر فقط في نمط المزدوج */}
          {mode === 'double' && (
            <div style={{ perspective: 400 }}>
              <div ref={dice2Ref} className="dice-cube" style={cubeStyle}>
                <div style={{ ...faceStyle2, transform: 'rotateY(0deg) translateZ(40px)' }}><Dots count={dice2} color="#FFD700" /></div>
                <div style={{ ...faceStyle2, transform: 'rotateY(180deg) translateZ(40px)' }}><Dots count={6} color="#FFD700" /></div>
                <div style={{ ...faceStyle2, transform: 'rotateY(90deg) translateZ(40px)' }}><Dots count={3} color="#FFD700" /></div>
                <div style={{ ...faceStyle2, transform: 'rotateY(-90deg) translateZ(40px)' }}><Dots count={4} color="#FFD700" /></div>
                <div style={{ ...faceStyle2, transform: 'rotateX(90deg) translateZ(40px)' }}><Dots count={5} color="#FFD700" /></div>
                <div style={{ ...faceStyle2, transform: 'rotateX(-90deg) translateZ(40px)' }}><Dots count={2} color="#FFD700" /></div>
              </div>
            </div>
          )}
        </div>

        {/* زر رمي النرد */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <button 
            className="btn btn-primary" 
            onClick={rollDice} 
            disabled={isRolling}
            style={{ width: '100%', maxWidth: 280, height: 48, fontSize: 16, fontWeight: 'bold', justifyContent: 'center', gap: 8 }}
          >
            {isRolling ? 'جاري رمي النرد...' : 'ارمِ النرد 🎲'}
          </button>
        </div>

        {/* توزيع الإحصائيات وسجل الرميات */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flexWrap: 'wrap' }}>
          {/* سجل الرميات */}
          <div style={{ background: 'var(--bg-app)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>سجل آخر 20 رمية:</p>
            {history.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>لا توجد رميات بعد</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {history.map((sum, i) => (
                  <span key={i} style={{ 
                    background: i === 0 ? '#e11212' : 'rgba(255, 255, 255, 0.08)',
                    color: i === 0 ? '#fff' : 'var(--text-primary)',
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, border: '1px solid var(--border)'
                  }}>
                    {sum}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* مخطط التوزيع */}
          <div style={{ background: 'var(--bg-app)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>توزيع أرقام الرمي الكلي (العدد: {totalRolls}):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6].map(num => {
                const count = distribution[num] || 0;
                const percent = totalRolls > 0 ? (count / totalRolls) * 100 : 0;
                return (
                  <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 'bold', width: 12 }}>{num}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: 'linear-gradient(90deg, #e11212, #F59E0B)', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 45, textAlign: 'left' }}>{percent.toFixed(0)}% ({count})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function BetButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 'bold',
        cursor: 'pointer',
        border: '1px solid var(--border)',
        background: active ? 'linear-gradient(135deg, #e11212 0%, #f2454e 100%)' : 'var(--card-bg)',
        color: active ? '#ffffff' : 'var(--text-primary)',
        boxShadow: active ? '0 2px 8px rgba(225, 18, 18, 0.3)' : 'none',
        transition: 'all 0.15s ease'
      }}
    >
      {label}
    </button>
  );
}

function Dots({ count, color }: { count: number; color: string }) {
  const dotLayout: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  const activeDots = dotLayout[count] || [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      width: '100%',
      height: '100%',
      padding: 12,
      gap: 6
    }}>
      {Array(9).fill(0).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {activeDots.includes(i) && (
            <div style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              backgroundColor: color,
              backgroundImage: color === '#e11212' 
                ? 'radial-gradient(circle at 30% 30%, #f2a0a0, #e11212)' 
                : color === '#FFD700'
                ? 'radial-gradient(circle at 30% 30%, #ffffff, #FFD700 60%, #b8860b 100%)'
                : 'radial-gradient(circle at 30% 30%, #ff8a80, #d50000)',
              boxShadow: `inset 0 1.5px 2px rgba(0,0,0,0.75), 0 1px 1px rgba(255,255,255,0.2)`
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

const cubeStyle: React.CSSProperties = {
  width: 80,
  height: 80,
  position: 'relative',
  transformStyle: 'preserve-3d',
  transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.3, 1)',
  transform: 'rotateX(0deg) rotateY(0deg)'
};

const faceStyle1: React.CSSProperties = {
  position: 'absolute',
  width: 80,
  height: 80,
  background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f9fafb 40%, #e5e7eb 80%, #d1d5db 100%)',
  border: '1.5px solid rgba(255, 255, 255, 0.75)',
  borderRadius: 16,
  boxShadow: 'inset 0 3px 6px rgba(255,255,255,1), inset -3px -3px 8px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden'
};

const faceStyle2: React.CSSProperties = {
  position: 'absolute',
  width: 80,
  height: 80,
  background: 'radial-gradient(circle at 30% 30%, #ef4444 0%, #b91c1c 60%, #7f1d1d 100%)',
  border: '1.5px solid rgba(255, 100, 100, 0.4)',
  borderRadius: 16,
  boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.3), inset -3px -3px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden'
};
