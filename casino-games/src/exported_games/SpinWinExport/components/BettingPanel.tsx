import React from 'react';
import { audio } from '../utils/audioEngine';

interface BettingPanelProps {
  betAmount: number;
  setBetAmount: (amount: number) => void;
  spinning: boolean;
}

const BET_OPTIONS = [
  { value: 1000, label: '1K' },
  { value: 5000, label: '5K' },
  { value: 10000, label: '10K' },
  { value: 50000, label: '50K' },
  { value: 100000, label: '100K' },
];

export const BettingPanel: React.FC<BettingPanelProps> = ({ betAmount, setBetAmount, spinning }) => {
  return (
    <div className="panel">
      <div className="pt">قيمة الرهان لكل قطاع</div>
      <div className="brow">
        {BET_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className={`bb ${betAmount === opt.value ? 'on' : ''}`}
            onClick={() => {
              if (!spinning) {
                audio.playClick();
                setBetAmount(opt.value);
              }
            }}
          >
            <div className="bval">{opt.label}</div>
            <div className="bsub">كوين</div>
          </div>
        ))}
      </div>
    </div>
  );
};
