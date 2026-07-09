import React from 'react';
import { SEGS, fmt } from '../utils/gameLogic';
import { audio } from '../utils/audioEngine';

interface SectorSelectionProps {
  selectedSectors: Set<number>;
  toggleSector: (index: number) => void;
  betAmount: number;
}

export const SectorSelection: React.FC<SectorSelectionProps> = ({ selectedSectors, toggleSector, betAmount }) => {
  return (
    <div className="panel">
      <div className="pt">اختر قطاعات رهانك</div>
      <div className="sgrid">
        {SEGS.map((s, i) => {
          const isSelected = selectedSectors.has(i);
          return (
            <div
              key={i}
              className={`sc ${isSelected ? 'on' : ''}`}
              onClick={() => {
                audio.playClick();
                toggleSector(i);
              }}
            >
              <div className="sdot" style={{ background: s.ac, color: s.ac }}></div>
              <div className="si">
                <div className="sm">
                  <span>
                    <img
                      src={s.icon}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        verticalAlign: 'middle',
                        boxShadow: '0 0 5px currentColor'
                      }}
                      alt={`x${s.mult}`}
                    />
                  </span>
                  x{s.mult}
                </div>
                <div className="ss">
                  {isSelected ? `${fmt(betAmount)} كوين` : 'انقر للاختيار'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

