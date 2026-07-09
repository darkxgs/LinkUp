import React from 'react';
import { casinoAsset } from '../../../config/assets.js';

const PRIZES = [
  { img: casinoAsset('/assets/trophy.png'), value: '500M' },
  { img: casinoAsset('/assets/medal_gold.png'), value: '200M' },
  { img: casinoAsset('/assets/gift.png'), value: '100M' },
  { img: casinoAsset('/assets/box.png'), value: '50M' },
  { img: casinoAsset('/assets/box.png'), value: '20M' },
];

export const PrizesBar: React.FC = () => {
  return (
    <div className="pbar">
      {PRIZES.map((prize, i) => (
        <div className="pot" key={i}>
          <div className="pico">
            <img
              src={prize.img}
              width="48"
              height="48"
              style={{ borderRadius: '8px' }}
              alt={prize.value}
            />
          </div>
          <div className="pv">{prize.value}</div>
        </div>
      ))}
    </div>
  );
};
