import React, { useState, useCallback, useEffect } from 'react';
import { Modal } from 'antd';
import { IconRefresh, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { CurrencyIcon, CasinoIcon, CURRENCY_NAME } from '../../config/currency';
import { useLinkUpWallet } from '../../bridge/useLinkUpWallet';
import { buildBetPresets, useCasinoBetLimits } from '../../bridge/useCasinoBetLimits';
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
  const { balance, ready, gameConfig, placeBet: bridgePlaceBet, recordResult } = useLinkUpWallet();
  const [betAmount, setBetAmount] = useState(1000);
  const { minBet, maxBet, betPresets } = useCasinoBetLimits(gameConfig, setBetAmount);
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
  
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const doSpin = useCallback(async () => {
    if (spinning || !ready) return;
    audio.playClick();

    if (selectedSectors.size === 0) {
      setToastMsg({ text: 'اختر قطاع واحد على الأقل!' });
      return;
    }
    const totalBet = selectedSectors.size * betAmount;
    if (totalBet < minBet || totalBet > maxBet) {
      setToastMsg({ text: `الرهان يجب أن يكون بين ${minBet.toLocaleString()} و ${maxBet.toLocaleString()} كوين` });
      return;
    }
    if (balance < totalBet) {
      setToastMsg({ text: 'رصيدك ما يكفي!' });
      return;
    }

    try {
      await bridgePlaceBet(totalBet);
    } catch (e: any) {
      setToastMsg({ text: e?.message || 'رصيد غير كافٍ' });
      return;
    }

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
      let profit = -totalBet; // Start with loss of the total bet placed on this spin

      if (selectedSectors.has(winIdx)) {
        const prize = betAmount * s.mult;
        profit = prize - totalBet;
        void recordResult({
          stake: totalBet,
          winAmount: prize,
          isWin: true,
          multiplier: s.mult,
          result: { sector: winIdx, mult: s.mult },
        }).catch(() => {});
        
        if (s.mult >= 15) {
          audio.playJackpot();
          setJackpotPrize(prize);
        } else {
          setToastMsg({ text: `مبروك! ربحت ${Math.round(prize).toLocaleString()} ${CURRENCY_NAME}`, duration: 3500 });
          triggerBurst();
          audio.playWin();
        }
      } else {
        setToastMsg({ text: 'حظك أحسن المرة الجاية!' });
        audio.playLose();
        void recordResult({
          stake: totalBet,
          winAmount: 0,
          isWin: false,
          result: { sector: winIdx },
        }).catch(() => {});
      }

      setHistoryRecords(prev => [{
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        totalBet: totalBet,
        multiplier: s.mult,
        color: s.color,
        profit: profit,
        isWin: selectedSectors.has(winIdx)
      }, ...prev].slice(0, 30));

    }, 5100);
  }, [spinning, ready, selectedSectors, betAmount, balance, totalDeg, minBet, maxBet, bridgePlaceBet, recordResult]);

  return (
    <div className="spin-win-app" dir="rtl">
    <div id="sw-scaler" className="sw-scaler">
      <div id="sw-wrapper" className="sw-wrapper">
        <div id="sw-container" className="sw-container">

          {jackpotPrize !== null && (
            <JackpotOverlay amount={jackpotPrize} onComplete={() => setJackpotPrize(null)} />
          )}

          <Modal
            title="سجلي (My History)"
            open={isHistoryOpen}
            onCancel={() => setIsHistoryOpen(false)}
            footer={null}
            className="history-window box-modal-3d"
            centered
            styles={{ content: { background: '#0a0b10', padding: 0 } }}
          >
            <div className="dashboard-section" style={{ padding: '24px' }}>
              <div className="history-list">
                {historyRecords.length === 0 ? (
                  <div className="empty-state" style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>لا يوجد سجل حتى الآن</div>
                ) : (
                  historyRecords.map(r => (
                    <div key={r.id} className="history-card glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: r.color, boxShadow: `0 0 10px ${r.color}` }}></div>
                         <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{r.multiplier}x</div>
                      </div>
                      <div style={{ color: r.isWin ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                         {r.isWin ? '+' : ''}{Math.abs(r.profit).toLocaleString()} <CasinoIcon size={16} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Modal>

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
              <CurrencyIcon size={18} />
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

            <div className="btn-container" style={{ padding: '0 16px 20px', background: 'transparent', borderTop: 'none' }}>
              <button className="sbn" disabled={spinning} onClick={doSpin}>
                <IconRefresh size={22} className={spinning ? 'spinning-icon' : ''} />
                دور العجلة {selectedSectors.size > 0 ? `(الإجمالي: ${fmt(selectedSectors.size * betAmount)})` : ''}
              </button>
            </div>

            <BettingPanel betAmount={betAmount} setBetAmount={setBetAmount} spinning={spinning} betPresets={betPresets.length ? betPresets : buildBetPresets(minBet, maxBet, 5)} minBet={minBet} maxBet={maxBet} />
            
            <SectorSelection selectedSectors={selectedSectors} toggleSector={toggleSector} betAmount={betAmount} />

            <PrizesBar />

            <div className="srow">
              <div className="stat" style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                رصيد: <CurrencyIcon size={14} /> <em>{fmt(balance)}</em>
              </div>
              <button className="rb" onClick={() => setIsHistoryOpen(true)}>سجلي</button>
              <div className="stat" style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                فائز اليوم: <CasinoIcon size={14} /> <em>0</em>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
);
}




