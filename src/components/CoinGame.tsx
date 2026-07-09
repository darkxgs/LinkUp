import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Coins, RotateCcw, HelpCircle, TrendingUp } from 'lucide-react';

type CoinSide = 'heads' | 'tails' | null;

export default function CoinGame() {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<CoinSide>(null);
  const [rotation, setRotation] = useState(0);
  
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(50);
  const [selectedSide, setSelectedSide] = useState<CoinSide>(null);
  const [gameResultMsg, setGameResultMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<CoinSide[]>([]);
  const [stats, setStats] = useState({ heads: 0, tails: 0 });

  const coinRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playFlipSound = () => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // صوت رنين معدني للعملة وهي تطير (Metallic ring/hum)
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(885, now + 0.5);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(883, now);
      osc2.frequency.exponentialRampToValueAtTime(878, now + 0.5);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
      osc2.start(now);
      osc2.stop(now + 0.5);

      // صوت نزول العملة
      setTimeout(() => {
        const hitOsc = ctx.createOscillator();
        const hitGain = ctx.createGain();
        hitOsc.connect(hitGain);
        hitGain.connect(ctx.destination);

        hitOsc.type = 'triangle';
        hitOsc.frequency.setValueAtTime(250, ctx.currentTime);
        hitOsc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

        hitGain.gain.setValueAtTime(0.3, ctx.currentTime);
        hitGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        hitOsc.start();
        hitOsc.stop(ctx.currentTime + 0.08);
      }, 500);

    } catch {}
  };

  const flipCoin = () => {
    if (isFlipping) return;

    if (!selectedSide) {
      setWarningMsg('يرجى اختيار توقعك أولاً (شعار أو كتابة)!');
      setTimeout(() => setWarningMsg(null), 3000);
      return;
    }

    if (balance < betAmount) {
      setWarningMsg('الرصيد التجريبي غير كافٍ للرهان!');
      setTimeout(() => setWarningMsg(null), 3000);
      return;
    }

    setIsFlipping(true);
    setGameResultMsg(null);
    playFlipSound();

    if (selectedSide) {
      setBalance(prev => prev - betAmount);
    }

    const nextResult: CoinSide = Math.random() > 0.5 ? 'heads' : 'tails';
    
    // دوران عشوائي سريع ثلاثي الأبعاد
    const extraFlips = (Math.floor(Math.random() * 5) + 5) * 360; // 5 to 9 full flips
    const targetRot = nextResult === 'heads' ? extraFlips : extraFlips + 180;
    
    setRotation(targetRot);

    setTimeout(() => {
      setResult(nextResult);
      setIsFlipping(false);

      // تحديث الإحصائيات
      setStats(prev => ({
        ...prev,
        [nextResult]: prev[nextResult] + 1
      }));
      setHistory(prev => [nextResult, ...prev.slice(0, 19)]);

      // التحقق من نتيجة الرهان
      if (selectedSide) {
        if (selectedSide === nextResult) {
          const winAmt = betAmount * 2;
          setBalance(prev => prev + winAmt);
          setGameResultMsg({ 
            text: `فوز! الوجه الظاهر هو ${nextResult === 'heads' ? 'الشعار' : 'الكتابة'}، كسبت +${winAmt} كوين! 🎉`, 
            success: true 
          });
        } else {
          setGameResultMsg({ 
            text: `خسارة! الوجه الظاهر هو ${nextResult === 'heads' ? 'الشعار' : 'الكتابة'}. حاول مجدداً! ❌`, 
            success: false 
          });
        }
      }
    }, 600); // مدة الدوران
  };

  const totalFlips = stats.heads + stats.tails;

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', padding: '10px 0' }}>
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        {/* هيدر */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#f2454e" /> لعبة رمي العملة 3D (Coin Flip)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>أداة معاينة واختبار احتمالات لعبة العملة ثنائية الأبعاد والتحقق من الاستجابة</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBalance(1000); setHistory([]); setStats({ heads: 0, tails: 0 }); setResult(null); setRotation(0); setGameResultMsg(null); }} style={{ color: 'var(--danger)' }}>
            إعادة تعيين
          </button>
        </div>

        {/* كرت المراهنة التجريبي */}
        <div style={{ background: 'var(--bg-app)', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Coins size={18} color="#F59E0B" />
              <span style={{ fontWeight: 700, fontSize: 15 }}>محفظتك التجريبية: <span style={{ color: '#F59E0B' }}>{balance} كوين</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>قيمة الرهان:</span>
              <input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(Math.max(10, +e.target.value))}
                style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>توقع نتيجة الرمية (شعار أو كتابة):</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setSelectedSide(selectedSide === 'heads' ? null : 'heads')}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                border: '1px solid var(--border)',
                background: selectedSide === 'heads' ? 'linear-gradient(135deg, #f2454e 0%, #d21e2a 100%)' : 'var(--card-bg)',
                color: selectedSide === 'heads' ? '#ffffff' : 'var(--text-primary)',
                boxShadow: selectedSide === 'heads' ? '0 4px 12px rgba(168, 85, 247, 0.3)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              شعار (Heads)
            </button>
            <button
              onClick={() => setSelectedSide(selectedSide === 'tails' ? null : 'tails')}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                border: '1px solid var(--border)',
                background: selectedSide === 'tails' ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' : 'var(--card-bg)',
                color: selectedSide === 'tails' ? '#ffffff' : 'var(--text-primary)',
                boxShadow: selectedSide === 'tails' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              كتابة (Tails)
            </button>
          </div>
        </div>

        {/* تنبيه التحذير من الرصيد أو عدم التوقع */}
        {warningMsg && (
          <div style={{
            padding: 12, borderRadius: 10, textAlign: 'center', marginBottom: 20, fontSize: 13, fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'var(--danger)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ flex: 1, textAlign: 'center' }}>⚠️ {warningMsg}</span>
            <button 
              onClick={() => setWarningMsg(null)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
            >
              ×
            </button>
          </div>
        )}

        {/* تنبيه النتيجة */}
        {gameResultMsg && (
          <div style={{
            padding: 12, borderRadius: 10, textAlign: 'center', marginBottom: 20, fontSize: 13, fontWeight: 700,
            background: gameResultMsg.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${gameResultMsg.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: gameResultMsg.success ? 'var(--success)' : 'var(--danger)',
          }}>
            {gameResultMsg.text}
          </div>
        )}

        {/* ساحة العملة ثلاثية الأبعاد */}
        <div style={{
          height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.04)', borderRadius: 20, marginBottom: 20, perspective: 400
        }}>
          <div 
            ref={coinRef}
            style={{
              width: 100, height: 100, position: 'relative', transformStyle: 'preserve-3d',
              transition: isFlipping ? 'transform 0.6s cubic-bezier(0.2, 0.85, 0.3, 1)' : 'none',
              transform: `rotateY(${rotation}deg)`
            }}
          >
            {/* وجه الشعار (Heads) - ذهبي واقعي */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
              backgroundImage: 'url(/images/gold_coin.png)',
              backgroundSize: 'cover',
              border: '2px solid rgba(255,255,255,0.4)', backfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 0 10px rgba(0,0,0,0.2)'
            }}>
              <span style={{ 
                fontSize: 10, fontWeight: 800, color: '#fff', 
                backgroundColor: 'rgba(225, 18, 18, 0.75)', 
                padding: '2px 8px', borderRadius: 10, marginTop: 55,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>شعار</span>
            </div>

            {/* وجه الكتابة (Tails) - فضي واقعي معدني */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
              backgroundImage: 'url(/images/gold_coin.png)',
              backgroundSize: 'cover',
              filter: 'hue-rotate(140deg) brightness(1.2) contrast(1.1)', // تحويل الذهب إلى فضة واقعية براقة
              border: '2px solid rgba(255,255,255,0.4)', backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 0 10px rgba(0,0,0,0.2)'
            }}>
              <span style={{ 
                fontSize: 10, fontWeight: 800, color: '#fff', 
                backgroundColor: 'rgba(245, 158, 11, 0.85)', 
                padding: '2px 8px', borderRadius: 10, marginTop: 55,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>كتابة</span>
            </div>
          </div>
        </div>

        {/* زر الإطلاق */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button 
            className="btn btn-primary" 
            onClick={flipCoin} 
            disabled={isFlipping}
            style={{ width: '100%', maxWidth: 280, height: 48, fontSize: 16, fontWeight: 'bold', justifyContent: 'center' }}
          >
            {isFlipping ? 'جاري رمي العملة...' : 'ارمي العملة 🪙'}
          </button>
        </div>

        {/* توزيع الإحصائيات */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--bg-app)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>توزيع النتائج (العدد: {totalFlips}):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* شعار */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span>شعار (Heads)</span>
                  <span>{totalFlips > 0 ? ((stats.heads / totalFlips) * 100).toFixed(0) : 0}% ({stats.heads})</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalFlips > 0 ? (stats.heads / totalFlips) * 100 : 0}%`, background: '#e11212' }} />
                </div>
              </div>
              {/* كتابة */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                  <span>كتابة (Tails)</span>
                  <span>{totalFlips > 0 ? ((stats.tails / totalFlips) * 100).toFixed(0) : 0}% ({stats.tails})</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalFlips > 0 ? (stats.tails / totalFlips) * 100 : 0}%`, background: '#F59E0B' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>سجل آخر 10 رميات:</p>
            {history.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>لا توجد رميات سابقة</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {history.map((side, i) => (
                  <span key={i} style={{
                    background: side === 'heads' ? 'rgba(225, 18, 18, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: side === 'heads' ? '#e11212' : '#F59E0B',
                    border: `1px solid ${side === 'heads' ? 'rgba(225, 18, 18, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                  }}>
                    {side === 'heads' ? 'شعار' : 'كتابة'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
