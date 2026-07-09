import React from 'react';
import { audio } from '../utils/audioEngine';

interface BettingPanelProps {
  betAmount: number;
  setBetAmount: (amount: number) => void;
  spinning: boolean;
  betPresets: number[];
  minBet?: number;
  maxBet?: number;
}

function formatPresetLabel(value: number): string {
  if (value >= 1000000) return `${value / 1000000}M`;
  if (value >= 1000) return `${value / 1000}K`;
  return String(value);
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  betAmount,
  setBetAmount,
  spinning,
  betPresets,
  minBet = 1000,
  maxBet = 100000,
}) => {
  const options = betPresets.length
    ? betPresets
    : [minBet, minBet * 5, minBet * 10, minBet * 50, maxBet].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

  return (
    <div className="panel">
      <div className="pt">قيمة الرهان لكل قطاع</div>
      <div className="brow">
        {options.map((value) => (
          <div
            key={value}
            className={`bb ${betAmount === value ? 'on' : ''}`}
            onClick={() => {
              if (!spinning) {
                audio.playClick();
                setBetAmount(value);
              }
            }}
          >
            <div className="bval">{formatPresetLabel(value)}</div>
            <div className="bsub">كوين</div>
          </div>
        ))}
      </div>
    </div>
  );
};
