import React, { useEffect, useRef, useState } from 'react';
import { SEGS, N, preloadImages } from '../utils/gameLogic';
import { audio } from '../utils/audioEngine';

interface WheelProps {
  spinTo: number;
  selectedSectors: Set<number>;
  winningSector: number | null;
  spinning: boolean;
}

export const Wheel: React.FC<WheelProps> = ({ spinTo, selectedSectors, winningSector, spinning }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    preloadImages().then(setImages);
  }, []);

  useEffect(() => {
    if (Object.keys(images).length === 0) return;
    
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const W = 300, R = W / 2, PI = Math.PI, sr = (PI * 2) / N;
    
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr;
    cv.height = W * dpr;
    ctx.scale(dpr, dpr);
    cv.style.width = W + 'px';
    cv.style.height = W + 'px';

    ctx.clearRect(0, 0, W, W);
    
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, PI * 2); ctx.fillStyle = '#0d0d22'; ctx.fill();
    
    SEGS.forEach((s, i) => {
      const a0 = i * sr - PI / 2, a1 = a0 + sr, mid = a0 + sr / 2;
      
      ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R - 6, a0, a1); ctx.closePath();
      ctx.fillStyle = s.bg; ctx.fill();
      
      ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R * 0.55, a0, a1); ctx.closePath();
      ctx.globalAlpha = selectedSectors.has(i) ? 1 : 0.3;
      const grd = ctx.createRadialGradient(R, R, 0, R, R, R);
      grd.addColorStop(0, s.ac);
      grd.addColorStop(1, s.bg);
      ctx.fillStyle = selectedSectors.has(i) ? s.ac : s.bg; 
      ctx.fill(); 
      ctx.globalAlpha = 1;
      
      ctx.save(); ctx.translate(R, R); ctx.rotate(a0);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R - 6, 0);
      ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      
      ctx.save(); ctx.translate(R, R); ctx.rotate(mid); ctx.textAlign = 'center';
      
      const img = images[s.icon];
      if (img) {
        const imgSize = 64; // Increased from 48
        ctx.drawImage(img, R * 0.75 - imgSize / 2, -imgSize / 2, imgSize, imgSize);
      }
      
      ctx.fillStyle = '#fff'; 
      ctx.font = `bold ${selectedSectors.has(i) ? 16 : 13}px "Outfit", sans-serif`;
      if(selectedSectors.has(i)) {
        ctx.shadowColor = s.ac;
        ctx.shadowBlur = 10;
      }
      ctx.fillText('x' + s.mult, R * 0.35, 6); 
      ctx.restore();
    });
    
    for(let i = 0; i < N * 2; i++){
      const a = i * (sr / 2) - PI / 2 + (sr / 4);
      ctx.beginPath(); ctx.arc(R + (R - 8) * Math.cos(a), R + (R - 8) * Math.sin(a), i % 2 === 0 ? 4 : 2.5, 0, PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#FFD700' : 'rgba(255,255,255,0.5)'; 
      ctx.fill();
    }
    
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, PI * 2); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(R, R, R * 0.55, 0, PI * 2); ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(R, R, R - 3, 0, PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  }, [images, selectedSectors]);

  // Audio Ticking Effect
  useEffect(() => {
    if (!spinning) return;
    
    let animationFrame: number;
    let lastSector = -1;

    const checkRotation = () => {
      if (!canvasRef.current) return;
      const st = window.getComputedStyle(canvasRef.current);
      const tr = st.getPropertyValue("transform");
      
      if (tr !== 'none') {
        const values = tr.split('(')[1].split(')')[0].split(',');
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        let angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        if (angle < 0) angle += 360;

        const sectorIndex = Math.floor(angle / (360 / N));
        if (lastSector !== -1 && sectorIndex !== lastSector) {
          audio.playTick();
        }
        lastSector = sectorIndex;
      }
      
      animationFrame = requestAnimationFrame(checkRotation);
    };

    animationFrame = requestAnimationFrame(checkRotation);
    return () => cancelAnimationFrame(animationFrame);
  }, [spinning]);

  return (
    <div className="wzone">
      <div className="glow-bg"></div>
      <div className="ptr-container">
        <div className="ptr"></div>
      </div>
      <div className="wouter">
        <canvas 
          id="wc" 
          ref={canvasRef}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transition: spinning ? 'transform 5s cubic-bezier(0.15, 0.9, 0.2, 1.0)' : 'none',
            transform: `rotate(${spinTo}deg)`
          }}
        />
        <div className="hub" id="hub">
          {winningSector !== null ? (
            <img src={SEGS[winningSector].icon} style={{width: 56, height: 56, borderRadius: '50%', objectFit: 'cover'}} />
          ) : (
            <img src={SEGS[2].icon} style={{width: 56, height: 56, borderRadius: '50%', objectFit: 'cover'}} />
          )}
        </div>
      </div>
      <div className={`rtag ${winningSector !== null ? 'win-txt' : ''}`} id="rtag">
        {spinning ? 'جاري الدوران...' : (winningSector !== null ? 'انتهت الجولة!' : 'اضغط لتدوير العجلة')}
      </div>
    </div>
  );
};
