import React from 'react';

const PRIZES = [
  { img: '/assets/trophy.png', value: '500M' },
  { img: '/assets/medal_gold.png', value: '200M' },
  { img: '/assets/gift.png', value: '100M' },
  { img: '/assets/box.png', value: '50M' },
  { img: '/assets/box.png', value: '20M' },
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
