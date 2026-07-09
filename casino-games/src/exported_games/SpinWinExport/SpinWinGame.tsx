import React, { useState, useCallback, useEffect } from 'react';
import { IconCoin, IconRefresh, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { Wheel } from './components/Wheel';
import { BettingPanel } from './components/BettingPanel';
import { SectorSelection } from './components/SectorSelection';
import { PrizesBar } from './components/PrizesBar';
import { Toast } from './components/Toast';
import { JackpotOverlay } from './components/JackpotOverlay';
import { SEGS, SDG, fmt, getRandomSectorIndex } from './utils/gameLogic';
import { audio } from './utils/audioEngine';
import './SpinWinGame.css';

export default function SpinWinGame() {
  const [balance, setBalance] = useState(50000);
  const [betAmount, setBetAmount] = useState(10000);
  const [selectedSectors, setSelectedSectors] = useState<Set<number>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [spinTo, setSpinTo] = useState(0);
  const [winningSector, setWinningSector] = useState<number | null>(null);
  const [totalDeg, setTotalDeg] = useState(0);
  const [toastMsg, setToastMsg] = useState<{ text: string, duration?: number } | null>(null);
  const [jackpotPrize, setJackpotPrize] = useState<number | null>(null);
  const [sparks, setSparks] = useState<{ id: number, tx: string, ty: string, size: number, color: string, delay: number }[]>([]);
  const [bgParticles, setBgParticles] = useState<{ id: number, sz: number, top: number, left: number, op: number, dur: number, del: number }[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  // Init audio engine on first interaction
  useEffect(() => {
    const initAudio = () => {
      audio.init();
      window.removeEventListener('pointerdown', initAudio);
    };
    window.addEventListener('pointerdown', initAudio);
    return () => window.removeEventListener('pointerdown', initAudio);
  }, []);

  const toggleMute = () => {
    setIsMuted(audio.toggleMute());
  };

  useEffect(() => {
    const particles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      sz: Math.random() * 3 + 1,
      top: Math.random() * 100,
      left: Math.random() * 100,
      op: 0.05 + Math.random() * 0.15,
      dur: 10 + Math.random() * 20,
      del: -(Math.random() * 20)
    }));
    setBgParticles(particles);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const scaler = document.getElementById('app-scaler');
      const wrapper = document.getElementById('scale-wrapper');
      const container = document.getElementById('app-container');
      if (!scaler || !wrapper || !container) return;
      
      scaler.style.height = `${window.innerHeight}px`;
      
      const scale = Math.min(window.innerWidth / 480, 1);
      
      wrapper.style.transform = `scale(${scale})`;
      container.style.height = `${window.innerHeight / scale}px`;
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSector = (index: number) => {
    if (spinning) return;
    const newSet = new Set(selectedSectors);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      if (newSet.size >= 4) {
        setToastMsg({ text: 'يمكنك اختيار 4 قطاعات كحد أقصى!', duration: 2000 });
        return;
      }
      newSet.add(index);
    }
    setSelectedSectors(newSet);
  };

  const triggerBurst = () => {
    const colors = ['#FFD700', '#fff', '#FFE033', '#FFC200', '#e74c3c', '#3498db'];
    const newSparks = Array.from({ length: 40 }).map((_, i) => {
      const sz = 4 + Math.random() * 8;
      const a = Math.random() * 360;
      const dist = 80 + Math.random() * 140;
      return {
        id: Date.now() + i,
        tx: Math.cos(a * Math.PI / 180) * dist + 'px',
        ty: Math.sin(a * Math.PI / 180) * dist + 'px',
        size: sz,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.2
      };
    });
    setSparks(newSparks);
    setTimeout(() => setSparks([]), 1400);
  };

  const doSpin = useCallback(() => {
    if (spinning) return;
    audio.playClick();

    if (selectedSectors.size === 0) {
      setToastMsg({ text: 'اختر قطاع واحد على الأقل!' });
      return;
    }
    const totalBet = selectedSectors.size * betAmount;
    if (balance < totalBet) {
      setToastMsg({ text: 'رصيدك ما يكفي!' });
      return;
    }

    setBalance(prev => prev - totalBet);
    setSpinning(true);
    setWinningSector(null);

    const winIdx = getRandomSectorIndex();
    const base = (-(winIdx * SDG + SDG / 2)) % 360 + 360;
    
    let nextSpinTo = base;
    while (nextSpinTo < totalDeg + 6 * 360) nextSpinTo += 360;
    
    setSpinTo(nextSpinTo);
    setTotalDeg(nextSpinTo);

    setTimeout(() => {
      setSpinning(false);
      setWinningSector(winIdx);
      
      const s = SEGS[winIdx];
      if (selectedSectors.has(winIdx)) {
        const prize = betAmount * s.mult;
        setBalance(prev => prev + prize);
        
        if (s.mult >= 15) {
          audio.playJackpot();
          setJackpotPrize(prize);
        } else {
          setToastMsg({ text: `مبروك! ربحت ${Math.round(prize).toLocaleString()} كوين`, duration: 3500 });
          triggerBurst();
          audio.playWin();
        }
      } else {
        setToastMsg({ text: 'حظك أحسن المرة الجاية!' });
        audio.playLose();
      }
    }, 5100);
  }, [spinning, selectedSectors, betAmount, balance, totalDeg]);

  return (
    <div id="app-scaler" className="app-scaler">
      <div id="scale-wrapper" className="scale-wrapper">
        <div id="app-container" className="app-container">

          {jackpotPrize !== null && (
            <JackpotOverlay amount={jackpotPrize} onComplete={() => setJackpotPrize(null)} />
          )}

          {bgParticles.map(p => (
            <div key={p.id} className="bg-particle" style={{
              width: p.sz, height: p.sz, top: `${p.top}%`, left: `${p.left}%`,
              '--max-op': p.op, animationDuration: `${p.dur}s`, animationDelay: `${p.del}s`
            } as React.CSSProperties} />
          ))}

          {sparks.map(s => (
            <div key={s.id} className="spark" style={{
              width: s.size, height: s.size, background: s.color, color: s.color,
              left: '50%', top: '35%', '--tx': s.tx, '--ty': s.ty, animationDelay: `${s.delay}s`
            } as React.CSSProperties} />
          ))}

          <Toast message={toastMsg?.text || null} duration={toastMsg?.duration} onClose={() => setToastMsg(null)} />

          <div className="topbar">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="rnd">جولة #183,543</div>
              <button onClick={toggleMute} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>
                {isMuted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
              </button>
            </div>
            <div className="gname">SPIN & WIN</div>
            <div className="cpill">
              <IconCoin size={18} />
              <span>{Math.round(balance).toLocaleString()}</span>
            </div>
          </div>

          <div className="content-scroll">
            <Wheel 
              spinTo={spinTo} 
              selectedSectors={selectedSectors} 
              winningSector={winningSector} 
              spinning={spinning} 
            />

            <BettingPanel betAmount={betAmount} setBetAmount={setBetAmount} spinning={spinning} />
            
            <SectorSelection selectedSectors={selectedSectors} toggleSector={toggleSector} betAmount={betAmount} />

            <PrizesBar />

            <div className="srow">
              <div className="stat">رصيد: <em>{fmt(balance)}</em></div>
              <button className="rb">سجلي</button>
              <div className="stat">فائز اليوم: <em>0</em></div>
            </div>
          </div>

          <div className="btn-container">
            <button className="sbn" disabled={spinning} onClick={doSpin}>
              <IconRefresh size={22} className={spinning ? 'spinning-icon' : ''} />
              دور العجلة
            </button>
          </div>
        </div>
      </div>
    </div>
);
}



