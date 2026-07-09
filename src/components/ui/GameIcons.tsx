/**
 * GameIcons - مكتبة أيقونات SVG حقيقية للألعاب
 *
 * هذه الأيقونات بديل عن emojis (🦆🐔🐟) لتكون احترافية
 * كلها SVG مخصصة ومرنة (تقبل size, color, fillColor)
 */

import React from 'react';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  G,
  Polygon,
} from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

// ==================== DUCK ====================
export const DuckIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#FCD34D',
  secondaryColor = '#F59E0B',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`duck-body-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
    </Defs>
    {/* Body */}
    <Ellipse cx="36" cy="40" rx="20" ry="14" fill={`url(#duck-body-${color})`} />
    {/* Head */}
    <Circle cx="22" cy="26" r="11" fill={`url(#duck-body-${color})`} />
    {/* Wing detail */}
    <Path
      d="M 38 38 Q 48 36, 52 42 Q 48 46, 40 44 Z"
      fill={secondaryColor}
      opacity="0.6"
    />
    {/* Beak */}
    <Path d="M 11 27 L 18 25 L 18 30 Z" fill="#F97316" />
    <Path d="M 11 28 L 18 28 L 18 30 Z" fill="#EA580C" />
    {/* Eye */}
    <Circle cx="22" cy="23" r="2.5" fill="#1F2937" />
    <Circle cx="23" cy="22" r="0.8" fill="#FFFFFF" />
    {/* Water reflection */}
    <Ellipse cx="36" cy="54" rx="14" ry="2" fill="rgba(255,255,255,0.3)" />
  </Svg>
);

// ==================== CHICKEN ====================
export const ChickenIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#FBBF24',
  secondaryColor = '#EF4444',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`chk-body-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="1" stopColor="#E5E7EB" />
      </LinearGradient>
    </Defs>
    {/* Body */}
    <Ellipse cx="32" cy="38" rx="16" ry="14" fill={`url(#chk-body-${color})`} />
    {/* Head */}
    <Circle cx="32" cy="22" r="10" fill={`url(#chk-body-${color})`} />
    {/* Comb (crest) */}
    <Path d="M 28 14 Q 30 8, 32 12 Q 34 8, 36 14 Q 33 10, 30 14 Z" fill={secondaryColor} />
    {/* Wattle */}
    <Path d="M 30 30 Q 32 35, 28 33 Z" fill={secondaryColor} />
    {/* Beak */}
    <Path d="M 38 22 L 44 23 L 38 26 Z" fill={color} />
    {/* Eye */}
    <Circle cx="34" cy="20" r="2" fill="#1F2937" />
    <Circle cx="35" cy="19" r="0.6" fill="#FFFFFF" />
    {/* Wing */}
    <Path
      d="M 22 34 Q 18 38, 22 44 Q 28 42, 28 36 Z"
      fill="#F3F4F6"
      stroke="#D1D5DB"
      strokeWidth="0.5"
    />
    {/* Legs */}
    <Path d="M 28 50 L 28 56 M 36 50 L 36 56" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ==================== FISH ====================
export const FishIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#C61414',
  secondaryColor = '#A91111',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`fish-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
    </Defs>
    {/* Body */}
    <Path
      d="M 12 32 Q 22 18, 42 22 Q 52 26, 52 32 Q 52 38, 42 42 Q 22 46, 12 32 Z"
      fill={`url(#fish-${color})`}
    />
    {/* Tail */}
    <Path d="M 10 32 L 2 22 L 6 32 L 2 42 Z" fill={secondaryColor} />
    {/* Fin top */}
    <Path d="M 28 22 L 30 14 L 36 22 Z" fill={secondaryColor} />
    {/* Fin bottom */}
    <Path d="M 30 42 L 28 50 L 36 42 Z" fill={secondaryColor} />
    {/* Eye */}
    <Circle cx="44" cy="30" r="3" fill="#FFFFFF" />
    <Circle cx="44" cy="30" r="1.8" fill="#1F2937" />
    <Circle cx="44.5" cy="29.5" r="0.6" fill="#FFFFFF" />
    {/* Scales */}
    <Path d="M 24 30 Q 28 28, 32 30 M 30 34 Q 34 32, 38 34" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />
  </Svg>
);

// ==================== APPLE ====================
export const AppleIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#EF4444',
  secondaryColor = '#DC2626',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`apple-${color}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
    </Defs>
    {/* Body */}
    <Path
      d="M 32 18 Q 18 14, 14 28 Q 12 44, 22 54 Q 32 58, 32 54 Q 32 58, 42 54 Q 52 44, 50 28 Q 46 14, 32 18 Z"
      fill={`url(#apple-${color})`}
    />
    {/* Highlight */}
    <Path
      d="M 20 26 Q 22 22, 26 24 Q 26 30, 22 32 Z"
      fill="rgba(255,255,255,0.4)"
    />
    {/* Stem */}
    <Path d="M 32 18 Q 34 12, 30 8" stroke="#7C2D12" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Leaf */}
    <Path
      d="M 32 14 Q 38 10, 40 14 Q 38 18, 32 16 Z"
      fill="#22C55E"
    />
  </Svg>
);

// ==================== TREE ====================
export const TreeIcon: React.FC<IconProps> = ({
  size = 64,
  color = '#22C55E',
  secondaryColor = '#15803D',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`tree-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
    </Defs>
    {/* Trunk */}
    <Path d="M 28 44 L 28 60 L 36 60 L 36 44 Z" fill="#7C2D12" />
    <Path d="M 30 44 L 30 60" stroke="#451A03" strokeWidth="1" />
    {/* Canopy - multiple circles for depth */}
    <Circle cx="22" cy="32" r="14" fill={`url(#tree-${color})`} />
    <Circle cx="42" cy="32" r="14" fill={`url(#tree-${color})`} />
    <Circle cx="32" cy="22" r="14" fill={`url(#tree-${color})`} />
    <Circle cx="32" cy="36" r="16" fill={`url(#tree-${color})`} />
  </Svg>
);

// ==================== TRUCK ====================
export const TruckIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#EF4444',
  secondaryColor = '#1F2937',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`truck-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color} />
        <Stop offset="1" stopColor="#DC2626" />
      </LinearGradient>
    </Defs>
    {/* Cargo */}
    <Path d="M 4 22 L 36 22 L 36 44 L 4 44 Z" fill={`url(#truck-${color})`} />
    {/* Cabin */}
    <Path d="M 36 28 L 50 28 L 56 36 L 56 44 L 36 44 Z" fill={`url(#truck-${color})`} />
    {/* Window */}
    <Path d="M 38 30 L 48 30 L 52 36 L 38 36 Z" fill="#C61414" opacity="0.7" />
    {/* Wheels */}
    <Circle cx="14" cy="46" r="6" fill={secondaryColor} />
    <Circle cx="14" cy="46" r="3" fill="#9CA3AF" />
    <Circle cx="46" cy="46" r="6" fill={secondaryColor} />
    <Circle cx="46" cy="46" r="3" fill="#9CA3AF" />
    {/* Headlight */}
    <Circle cx="54" cy="38" r="1.5" fill="#FCD34D" />
  </Svg>
);

// ==================== ROCKET ====================
export const RocketIcon: React.FC<IconProps> = ({
  size = 64,
  color = '#ED4444',
  secondaryColor = '#EF4444',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`rocket-body-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="1" stopColor="#E5E7EB" />
      </LinearGradient>
      <LinearGradient id={`rocket-flame-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FCD34D" />
        <Stop offset="0.5" stopColor="#F97316" />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
    </Defs>
    {/* Flames */}
    <Path d="M 26 50 L 32 62 L 38 50 L 36 56 L 32 60 L 28 56 Z" fill={`url(#rocket-flame-${color})`} />
    <Path d="M 24 48 L 32 58 L 40 48 Z" fill="#F97316" opacity="0.7" />
    {/* Body */}
    <Path
      d="M 32 6 L 42 26 L 42 50 L 22 50 L 22 26 Z"
      fill={`url(#rocket-body-${color})`}
      stroke="#9CA3AF"
      strokeWidth="0.5"
    />
    {/* Window */}
    <Circle cx="32" cy="28" r="6" fill={color} />
    <Circle cx="32" cy="28" r="4" fill="#AF1E1E" />
    <Circle cx="33" cy="27" r="1.5" fill="rgba(255,255,255,0.6)" />
    {/* Fins */}
    <Path d="M 22 40 L 14 50 L 22 50 Z" fill={secondaryColor} />
    <Path d="M 42 40 L 50 50 L 42 50 Z" fill={secondaryColor} />
    {/* Tip */}
    <Path d="M 32 6 L 38 18 L 26 18 Z" fill={secondaryColor} />
  </Svg>
);

// ==================== TREASURE BOX ====================
export const TreasureBoxIcon: React.FC<IconProps & { opened?: boolean }> = ({
  size = 48,
  color = '#FCD34D',
  secondaryColor = '#7C2D12',
  opened = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`box-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#A16207" />
        <Stop offset="1" stopColor={secondaryColor} />
      </LinearGradient>
      <LinearGradient id={`gold-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FCD34D" />
        <Stop offset="1" stopColor="#F59E0B" />
      </LinearGradient>
    </Defs>
    {/* Box body */}
    <Path d="M 8 32 L 8 56 L 56 56 L 56 32 Z" fill={`url(#box-${color})`} />
    {/* Lid */}
    {opened ? (
      <Path d="M 6 32 L 30 8 L 36 8 L 12 32 Z" fill={`url(#box-${color})`} />
    ) : (
      <Path d="M 6 22 L 8 30 L 56 30 L 58 22 Q 32 14, 6 22 Z" fill={`url(#box-${color})`} />
    )}
    {/* Gold inside if opened */}
    {opened && (
      <>
        <Circle cx="20" cy="42" r="5" fill={`url(#gold-${color})`} />
        <Circle cx="32" cy="46" r="6" fill={`url(#gold-${color})`} />
        <Circle cx="44" cy="42" r="5" fill={`url(#gold-${color})`} />
      </>
    )}
    {/* Lock/Clasp */}
    {!opened && (
      <>
        <Path d="M 28 26 L 36 26 L 36 36 L 28 36 Z" fill={color} />
        <Circle cx="32" cy="31" r="1.5" fill="#1F2937" />
      </>
    )}
    {/* Bands */}
    <Path d="M 8 38 L 56 38" stroke={color} strokeWidth="2" />
    {/* Wood texture */}
    <Path d="M 14 44 L 14 54 M 24 44 L 24 54 M 40 44 L 40 54 M 50 44 L 50 54" stroke="#451A03" strokeWidth="0.5" opacity="0.6" />
  </Svg>
);

// ==================== DICE ====================
export const DiceIcon: React.FC<IconProps & { face?: 1 | 2 | 3 | 4 | 5 | 6 }> = ({
  size = 48,
  color = '#FFFFFF',
  secondaryColor = '#1F2937',
  face = 6,
}) => {
  const dotPositions: Record<number, { cx: number; cy: number }[]> = {
    1: [{ cx: 32, cy: 32 }],
    2: [{ cx: 20, cy: 20 }, { cx: 44, cy: 44 }],
    3: [{ cx: 18, cy: 18 }, { cx: 32, cy: 32 }, { cx: 46, cy: 46 }],
    4: [{ cx: 18, cy: 18 }, { cx: 46, cy: 18 }, { cx: 18, cy: 46 }, { cx: 46, cy: 46 }],
    5: [{ cx: 18, cy: 18 }, { cx: 46, cy: 18 }, { cx: 32, cy: 32 }, { cx: 18, cy: 46 }, { cx: 46, cy: 46 }],
    6: [{ cx: 18, cy: 18 }, { cx: 46, cy: 18 }, { cx: 18, cy: 32 }, { cx: 46, cy: 32 }, { cx: 18, cy: 46 }, { cx: 46, cy: 46 }],
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`dice-${face}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E5E7EB" />
        </LinearGradient>
      </Defs>
      {/* Face */}
      <Path
        d="M 8 12 L 8 52 Q 8 56, 12 56 L 52 56 Q 56 56, 56 52 L 56 12 Q 56 8, 52 8 L 12 8 Q 8 8, 8 12 Z"
        fill={`url(#dice-${face})`}
        stroke="#9CA3AF"
        strokeWidth="1"
      />
      {/* Dots */}
      {(dotPositions[face] ?? []).map((dot, i) => (
        <Circle key={i} cx={dot.cx} cy={dot.cy} r="3.5" fill={secondaryColor} />
      ))}
    </Svg>
  );
};

// ==================== SOCCER BALL ====================
export const SoccerBallIcon: React.FC<IconProps> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
    {/* Pentagon center */}
    <Polygon
      points="32,18 42,26 38,38 26,38 22,26"
      fill="#1F2937"
    />
    {/* Surrounding pentagons (partial) */}
    <Path d="M 32 18 L 32 6 M 42 26 L 54 24 M 38 38 L 46 50 M 26 38 L 18 50 M 22 26 L 10 24" stroke="#1F2937" strokeWidth="2" />
  </Svg>
);

// ==================== GOAL NET ====================
export const GoalNetIcon: React.FC<IconProps> = ({ size = 64, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 128 64">
    {/* Goal frame */}
    <Path d="M 8 56 L 8 12 L 120 12 L 120 56" stroke={color} strokeWidth="3" fill="none" />
    {/* Net lines vertical */}
    {[20, 32, 44, 64, 84, 96, 108].map((x) => (
      <Path key={x} d={`M ${x} 12 L ${x} 56`} stroke={color} strokeWidth="0.5" opacity="0.6" />
    ))}
    {/* Net lines horizontal */}
    {[20, 28, 36, 44, 52].map((y) => (
      <Path key={y} d={`M 8 ${y} L 120 ${y}`} stroke={color} strokeWidth="0.5" opacity="0.6" />
    ))}
  </Svg>
);

// ==================== EGG (good vs bad fruit) ====================
export const EggIcon: React.FC<IconProps & { broken?: boolean }> = ({
  size = 32,
  color = '#FBBF24',
  broken = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`egg-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="1" stopColor="#E5E7EB" />
      </LinearGradient>
    </Defs>
    {broken ? (
      <>
        {/* Cracked egg */}
        <Path d="M 14 20 L 22 16 L 20 24 L 28 22 L 26 30 L 34 28 L 50 22 L 48 50 Q 32 60, 16 50 Z" fill={`url(#egg-${color})`} />
        {/* Yolk */}
        <Ellipse cx="34" cy="40" rx="10" ry="8" fill={color} />
        <Ellipse cx="32" cy="38" rx="3" ry="2" fill="rgba(255,255,255,0.5)" />
      </>
    ) : (
      <>
        {/* Whole egg */}
        <Path
          d="M 32 8 Q 16 14, 14 36 Q 14 54, 32 56 Q 50 54, 50 36 Q 48 14, 32 8 Z"
          fill={`url(#egg-${color})`}
          stroke="#9CA3AF"
          strokeWidth="0.5"
        />
        {/* Highlight */}
        <Path d="M 22 18 Q 26 14, 28 20 Q 26 26, 22 24 Z" fill="rgba(255,255,255,0.6)" />
      </>
    )}
  </Svg>
);

// ==================== FRUIT (Generic) ====================
export const FruitIcon: React.FC<IconProps & { type?: 'golden' | 'silver' | 'bronze' | 'rotten' }> = ({
  size = 40,
  type = 'golden',
}) => {
  const colors = {
    golden: { main: '#FCD34D', dark: '#F59E0B', stem: '#15803D' },
    silver: { main: '#E5E7EB', dark: '#9CA3AF', stem: '#15803D' },
    bronze: { main: '#FB923C', dark: '#EA580C', stem: '#15803D' },
    rotten: { main: '#7C2D12', dark: '#451A03', stem: '#7C2D12' },
  };
  const c = colors[type];

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`fruit-${type}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.main} />
          <Stop offset="1" stopColor={c.dark} />
        </LinearGradient>
      </Defs>
      {/* Fruit body */}
      <Path
        d="M 32 18 Q 18 14, 14 28 Q 12 44, 22 54 Q 32 58, 32 54 Q 32 58, 42 54 Q 52 44, 50 28 Q 46 14, 32 18 Z"
        fill={`url(#fruit-${type})`}
      />
      {/* Highlight */}
      {type !== 'rotten' && (
        <Path
          d="M 20 26 Q 22 22, 26 24 Q 26 30, 22 32 Z"
          fill="rgba(255,255,255,0.5)"
        />
      )}
      {/* Stem */}
      <Path d="M 32 18 Q 34 12, 30 8" stroke="#7C2D12" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Leaf */}
      <Path
        d="M 32 14 Q 38 10, 40 14 Q 38 18, 32 16 Z"
        fill={type === 'rotten' ? '#7C2D12' : '#22C55E'}
      />
      {/* Rotten effect */}
      {type === 'rotten' && (
        <>
          <Circle cx="24" cy="32" r="3" fill="#1F2937" opacity="0.6" />
          <Circle cx="40" cy="38" r="2" fill="#1F2937" opacity="0.6" />
          <Circle cx="32" cy="46" r="2.5" fill="#1F2937" opacity="0.6" />
        </>
      )}
      {/* Golden sparkle */}
      {type === 'golden' && (
        <>
          <Path d="M 38 22 L 40 26 L 44 24 L 42 28 L 46 30 L 42 32 L 44 36 L 40 34 L 38 38 L 36 34 Z" fill="#FFFFFF" opacity="0.9" />
        </>
      )}
    </Svg>
  );
};

// ==================== COIN (Casino) ====================
export const CasinoCoinIcon: React.FC<IconProps> = ({
  size = 32,
  color = '#FCD34D',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id={`coin-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FCD34D" />
        <Stop offset="0.5" stopColor="#F59E0B" />
        <Stop offset="1" stopColor="#D97706" />
      </LinearGradient>
    </Defs>
    {/* Outer rim */}
    <Circle cx="32" cy="32" r="28" fill={`url(#coin-grad-${size})`} stroke="#D97706" strokeWidth="2" />
    {/* Inner circle */}
    <Circle cx="32" cy="32" r="22" fill="none" stroke="#D97706" strokeWidth="1" opacity="0.5" />
    {/* Star */}
    <Path
      d="M 32 16 L 36 26 L 47 26 L 38 33 L 41 44 L 32 38 L 23 44 L 26 33 L 17 26 L 28 26 Z"
      fill="#7C2D12"
    />
    {/* Shine */}
    <Path
      d="M 18 18 Q 14 22, 14 28 Q 18 28, 22 22 Z"
      fill="#FFFFFF"
      opacity="0.6"
    />
  </Svg>
);

// ==================== EXPORTS ====================
export const GameIcons = {
  Duck: DuckIcon,
  Chicken: ChickenIcon,
  Fish: FishIcon,
  Apple: AppleIcon,
  Tree: TreeIcon,
  Truck: TruckIcon,
  Rocket: RocketIcon,
  TreasureBox: TreasureBoxIcon,
  Dice: DiceIcon,
  SoccerBall: SoccerBallIcon,
  GoalNet: GoalNetIcon,
  Egg: EggIcon,
  Fruit: FruitIcon,
  CasinoCoin: CasinoCoinIcon,
};
