import React, { useEffect, useState } from 'react';
import './Jackpot.css';

interface JackpotProps {
  amount: number;
  onComplete: () => void;
}

export const JackpotOverlay: React.FC<JackpotProps> = ({ amount, onComplete }) => {
  const [coins, setCoins] = useState<{ id: number, left: number, delay: number, duration: number }[]>([]);

  useEffect(() => {
    // Generate rain coins
    const generated = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 1.5 + Math.random() * 2
    }));
    setCoins(generated);

    const timer = setTimeout(() => {
      onComplete();
    }, 5000); // Overlay lasts 5 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="jackpot-overlay">
      <div className="jackpot-content">
        <h1 className="jackpot-title">JACKPOT!</h1>
        <h2 className="jackpot-amount">+{amount.toLocaleString()} كوين</h2>
      </div>
      {coins.map(c => (
        <div 
          key={c.id} 
          className="jackpot-coin"
          style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`
          }}
        >
          💰
        </div>
      ))}
    </div>
  );
};
