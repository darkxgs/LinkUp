/**
 * RelationshipIcons - تصميم فخم مطابق لـ Sada
 */

import React from 'react';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
  G,
  Polygon,
} from 'react-native-svg';

interface IconProps {
  size?: number;
}

// ==================== HEART GEM (شارة الجوهرة) ====================
export const HeartGemIcon: React.FC<IconProps & { color?: string }> = ({
  size = 90,
  color = '#FCD34D',
}) => (
  <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
    <Defs>
      <LinearGradient id={`gem-bg-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FEFCE8" />
        <Stop offset="0.4" stopColor={color} />
        <Stop offset="1" stopColor="#D97706" />
      </LinearGradient>
      <LinearGradient id={`gem-heart-${color}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FEF3C7" />
        <Stop offset="0.5" stopColor={color} />
        <Stop offset="1" stopColor="#D97706" />
      </LinearGradient>
    </Defs>

    {/* Outer hexagon */}
    <Polygon
      points="50,3 92,28 92,72 50,97 8,72 8,28"
      fill={`url(#gem-bg-${color})`}
      stroke="#D97706"
      strokeWidth="2.5"
    />

    {/* Inner hexagon outline */}
    <Polygon
      points="50,10 85,30 85,70 50,90 15,70 15,30"
      fill="none"
      stroke="#FEFCE8"
      strokeWidth="1.5"
      opacity="0.7"
    />

    {/* Faceted heart in center */}
    <Path
      d="M 50 65
         Q 32 50, 28 38
         Q 28 25, 40 25
         Q 47 25, 50 32
         Q 53 25, 60 25
         Q 72 25, 72 38
         Q 68 50, 50 65 Z"
      fill={`url(#gem-heart-${color})`}
      stroke="#D97706"
      strokeWidth="1.5"
    />

    {/* Heart left facet */}
    <Path
      d="M 50 32 L 50 65 L 28 38 Q 28 25, 40 25 Z"
      fill="#D97706"
      opacity="0.35"
    />

    {/* Heart top highlight */}
    <Path
      d="M 40 25 Q 47 25, 50 32 L 50 28 L 42 28 Z"
      fill="#FEFCE8"
      opacity="0.7"
    />

    {/* Bottom pendant tip */}
    <Polygon
      points="42,97 50,113 58,97"
      fill={`url(#gem-bg-${color})`}
      stroke="#D97706"
      strokeWidth="1.5"
    />

    {/* Pendant highlight */}
    <Polygon
      points="46,98 50,108 50,98"
      fill="#FEFCE8"
      opacity="0.5"
    />

    {/* Top edge shine */}
    <Path
      d="M 12 28 L 50 8 L 88 28"
      stroke="#FEFCE8"
      strokeWidth="1.5"
      fill="none"
      opacity="0.6"
    />
  </Svg>
);

// ==================== WINGS CROWN - فخم بأجنحة كبيرة ====================
export const WingsCrownIcon: React.FC<IconProps> = ({ size = 400 }) => {
  const h = size * 0.55;
  return (
    <Svg width={size} height={h} viewBox="0 0 500 280">
      <Defs>
        {/* Gold gradients */}
        <LinearGradient id="wc-gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FEF9C3" />
          <Stop offset="0.3" stopColor="#FCD34D" />
          <Stop offset="0.7" stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#92400E" />
        </LinearGradient>
        <LinearGradient id="wc-gold-bright" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFBEB" />
          <Stop offset="0.5" stopColor="#FCD34D" />
          <Stop offset="1" stopColor="#D97706" />
        </LinearGradient>
        {/* Pink wing gradient */}
        <LinearGradient id="wc-wing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE6E9" />
          <Stop offset="0.5" stopColor="#FCA5A5" />
          <Stop offset="1" stopColor="#E11414" />
        </LinearGradient>
        <LinearGradient id="wc-wing-light" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE4E6" />
          <Stop offset="1" stopColor="#FBD5D5" />
        </LinearGradient>
        {/* Heart pink */}
        <RadialGradient id="wc-heart-pink" cx="0.4" cy="0.3" r="0.7">
          <Stop offset="0" stopColor="#FFE6E9" />
          <Stop offset="0.4" stopColor="#FF6670" />
          <Stop offset="1" stopColor="#8A0E0E" />
        </RadialGradient>
        {/* Rose gradient */}
        <RadialGradient id="wc-rose" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FBD5D5" />
          <Stop offset="0.6" stopColor="#FF6670" />
          <Stop offset="1" stopColor="#8A0E0E" />
        </RadialGradient>
      </Defs>

      {/* ===== LEFT WING ===== */}
      <G>
        {/* Wing main body */}
        <Path
          d="M 250 130
             Q 200 100, 150 95
             Q 100 85, 60 100
             Q 30 115, 25 145
             Q 30 170, 70 175
             Q 50 185, 35 200
             Q 70 220, 120 210
             Q 100 225, 90 240
             Q 145 250, 200 220
             Q 230 200, 245 165
             Z"
          fill="url(#wc-wing)"
          opacity="0.95"
        />
        {/* Wing feather layers */}
        <Path
          d="M 250 135
             Q 215 115, 175 110
             Q 140 105, 110 115
             Q 90 125, 95 145
             Q 110 155, 145 152
             Q 130 165, 125 178
             Q 160 185, 200 170
             Q 230 155, 245 140
             Z"
          fill="url(#wc-wing-light)"
          opacity="0.7"
        />
        {/* Individual feathers */}
        <Path d="M 80 110 Q 65 120, 70 140 Q 90 130, 95 115 Z" fill="#FFE6E9" opacity="0.8" />
        <Path d="M 110 105 Q 95 120, 100 145 Q 125 135, 130 110 Z" fill="#FBD5D5" opacity="0.85" />
        <Path d="M 145 105 Q 130 125, 140 150 Q 165 140, 170 115 Z" fill="#FFE6E9" opacity="0.8" />
        <Path d="M 180 110 Q 170 130, 180 155 Q 200 145, 205 120 Z" fill="#FBD5D5" opacity="0.7" />
        {/* Lower feathers */}
        <Path d="M 80 175 Q 70 195, 90 210 Q 110 200, 105 180 Z" fill="#FCA5A5" opacity="0.7" />
        <Path d="M 115 185 Q 110 210, 135 222 Q 155 210, 150 185 Z" fill="#FBD5D5" opacity="0.8" />
        <Path d="M 160 195 Q 155 215, 180 225 Q 200 215, 195 195 Z" fill="#FCA5A5" opacity="0.7" />
        {/* Wing edge highlight */}
        <Path
          d="M 250 130 Q 200 100, 150 95 Q 100 85, 60 100"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        {/* Pink roses on wing */}
        <Circle cx="100" cy="140" r="8" fill="url(#wc-rose)" />
        <Circle cx="100" cy="140" r="4" fill="#8A0E0E" opacity="0.5" />
        <Circle cx="135" cy="170" r="6" fill="url(#wc-rose)" />
        <Circle cx="170" cy="200" r="7" fill="url(#wc-rose)" />
      </G>

      {/* ===== RIGHT WING (mirrored) ===== */}
      <G>
        <Path
          d="M 250 130
             Q 300 100, 350 95
             Q 400 85, 440 100
             Q 470 115, 475 145
             Q 470 170, 430 175
             Q 450 185, 465 200
             Q 430 220, 380 210
             Q 400 225, 410 240
             Q 355 250, 300 220
             Q 270 200, 255 165
             Z"
          fill="url(#wc-wing)"
          opacity="0.95"
        />
        <Path
          d="M 250 135
             Q 285 115, 325 110
             Q 360 105, 390 115
             Q 410 125, 405 145
             Q 390 155, 355 152
             Q 370 165, 375 178
             Q 340 185, 300 170
             Q 270 155, 255 140
             Z"
          fill="url(#wc-wing-light)"
          opacity="0.7"
        />
        <Path d="M 420 110 Q 435 120, 430 140 Q 410 130, 405 115 Z" fill="#FFE6E9" opacity="0.8" />
        <Path d="M 390 105 Q 405 120, 400 145 Q 375 135, 370 110 Z" fill="#FBD5D5" opacity="0.85" />
        <Path d="M 355 105 Q 370 125, 360 150 Q 335 140, 330 115 Z" fill="#FFE6E9" opacity="0.8" />
        <Path d="M 320 110 Q 330 130, 320 155 Q 300 145, 295 120 Z" fill="#FBD5D5" opacity="0.7" />
        <Path d="M 420 175 Q 430 195, 410 210 Q 390 200, 395 180 Z" fill="#FCA5A5" opacity="0.7" />
        <Path d="M 385 185 Q 390 210, 365 222 Q 345 210, 350 185 Z" fill="#FBD5D5" opacity="0.8" />
        <Path d="M 340 195 Q 345 215, 320 225 Q 300 215, 305 195 Z" fill="#FCA5A5" opacity="0.7" />
        <Path
          d="M 250 130 Q 300 100, 350 95 Q 400 85, 440 100"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
        <Circle cx="400" cy="140" r="8" fill="url(#wc-rose)" />
        <Circle cx="400" cy="140" r="4" fill="#8A0E0E" opacity="0.5" />
        <Circle cx="365" cy="170" r="6" fill="url(#wc-rose)" />
        <Circle cx="330" cy="200" r="7" fill="url(#wc-rose)" />
      </G>

      {/* ===== CROWN BASE ===== */}
      {/* Main band */}
      <Path
        d="M 130 200
           Q 250 220, 370 200
           L 370 240
           Q 250 260, 130 240
           Z"
        fill="url(#wc-gold)"
        stroke="#92400E"
        strokeWidth="1.5"
      />
      {/* Band shine */}
      <Path
        d="M 140 210 Q 250 225, 360 210"
        stroke="#FEF9C3"
        strokeWidth="2"
        fill="none"
        opacity="0.8"
      />
      {/* Decorative dots on band */}
      <Circle cx="180" cy="220" r="4" fill="#FEF9C3" />
      <Circle cx="220" cy="225" r="3" fill="#FEF9C3" />
      <Circle cx="280" cy="225" r="3" fill="#FEF9C3" />
      <Circle cx="320" cy="220" r="4" fill="#FEF9C3" />

      {/* ===== CROWN SPIKES ===== */}
      {/* Center large spike */}
      <Path
        d="M 250 130
           L 240 195
           L 250 205
           L 260 195
           Z"
        fill="url(#wc-gold-bright)"
        stroke="#92400E"
        strokeWidth="1.5"
      />
      {/* Center spike inner shine */}
      <Path d="M 248 140 L 248 198" stroke="#FEF9C3" strokeWidth="1.5" opacity="0.8" />

      {/* Left spike */}
      <Path
        d="M 195 165
           L 188 200
           L 195 210
           L 210 200
           Z"
        fill="url(#wc-gold-bright)"
        stroke="#92400E"
        strokeWidth="1.5"
      />

      {/* Right spike */}
      <Path
        d="M 305 165
           L 312 200
           L 305 210
           L 290 200
           Z"
        fill="url(#wc-gold-bright)"
        stroke="#92400E"
        strokeWidth="1.5"
      />

      {/* ===== HEART ON TOP OF CROWN ===== */}
      <Circle cx="250" cy="125" r="22" fill="url(#wc-gold-bright)" stroke="#92400E" strokeWidth="2" />
      <Path
        d="M 250 138
           Q 235 125, 235 118
           Q 235 110, 242 110
           Q 247 110, 250 115
           Q 253 110, 258 110
           Q 265 110, 265 118
           Q 265 125, 250 138 Z"
        fill="url(#wc-heart-pink)"
      />
      {/* Heart highlight */}
      <Ellipse cx="244" cy="118" rx="3" ry="2" fill="#FFE6E9" opacity="0.8" />

      {/* Small hearts on sides of crown */}
      <Circle cx="195" cy="155" r="7" fill="url(#wc-rose)" />
      <Path d="M 195 158 Q 191 154, 191 152 Q 191 150, 193 150 Q 195 150, 195 152 Q 195 150, 197 150 Q 199 150, 199 152 Q 199 154, 195 158 Z" fill="#FFFFFF" opacity="0.6" />

      <Circle cx="305" cy="155" r="7" fill="url(#wc-rose)" />
      <Path d="M 305 158 Q 301 154, 301 152 Q 301 150, 303 150 Q 305 150, 305 152 Q 305 150, 307 150 Q 309 150, 309 152 Q 309 154, 305 158 Z" fill="#FFFFFF" opacity="0.6" />

      {/* Sparkles around crown */}
      <G fill="#FEF9C3">
        <Circle cx="55" cy="60" r="2.5" opacity="0.9" />
        <Circle cx="445" cy="60" r="2.5" opacity="0.9" />
        <Circle cx="90" cy="40" r="1.8" opacity="0.7" />
        <Circle cx="410" cy="40" r="1.8" opacity="0.7" />
        <Circle cx="250" cy="40" r="3" opacity="0.9" />
        <Circle cx="170" cy="50" r="1.5" opacity="0.6" />
        <Circle cx="330" cy="50" r="1.5" opacity="0.6" />
      </G>

      {/* Roses at bottom corners */}
      <G>
        <Circle cx="120" cy="245" r="10" fill="url(#wc-rose)" />
        <Circle cx="115" cy="240" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="125" cy="245" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="120" cy="250" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="120" cy="245" r="3" fill="#8A0E0E" />
      </G>
      <G>
        <Circle cx="380" cy="245" r="10" fill="url(#wc-rose)" />
        <Circle cx="375" cy="240" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="385" cy="245" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="380" cy="250" r="5" fill="#FBD5D5" opacity="0.7" />
        <Circle cx="380" cy="245" r="3" fill="#8A0E0E" />
      </G>
    </Svg>
  );
};

// ==================== GLOW HEART (قلب كبير بتوهج) ====================
export const GlowHeartIcon: React.FC<IconProps> = ({ size = 130 }) => (
  <Svg width={size} height={size} viewBox="0 0 130 130">
    <Defs>
      <RadialGradient id="gh-glow" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FBD5D5" stopOpacity="0.6" />
        <Stop offset="0.5" stopColor="#FCA5A5" stopOpacity="0.3" />
        <Stop offset="1" stopColor="#E11414" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="gh-shine" cx="0.35" cy="0.25" r="0.4">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
        <Stop offset="0.5" stopColor="#FBD5D5" stopOpacity="0.5" />
        <Stop offset="1" stopColor="#FBD5D5" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="gh-body" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FBD5D5" />
        <Stop offset="0.5" stopColor="#FF6670" />
        <Stop offset="1" stopColor="#C40E1E" />
      </LinearGradient>
    </Defs>

    {/* Glow */}
    <Circle cx="65" cy="65" r="60" fill="url(#gh-glow)" />

    {/* Sparkles */}
    <G fill="#FCD34D">
      <Path d="M 28 38 L 31 41 L 34 38 L 31 35 Z" />
      <Path d="M 102 33 L 104 35 L 106 33 L 104 31 Z" opacity="0.8" />
      <Path d="M 107 80 L 110 83 L 113 80 L 110 77 Z" opacity="0.7" />
      <Path d="M 20 80 L 22 83 L 25 80 L 22 77 Z" opacity="0.6" />
    </G>

    {/* Heart */}
    <Path
      d="M 65 100
         Q 30 70, 25 45
         Q 25 30, 40 30
         Q 55 30, 65 45
         Q 75 30, 90 30
         Q 105 30, 105 45
         Q 100 70, 65 100 Z"
      fill="url(#gh-body)"
      stroke="#C40E1E"
      strokeWidth="1.5"
    />

    {/* Heart shine */}
    <Path
      d="M 48 42
         Q 45 36, 48 33
         Q 54 33, 56 40
         Q 54 48, 48 42 Z"
      fill="url(#gh-shine)"
    />

    {/* Small drops */}
    <Circle cx="42" cy="58" r="2" fill="#FFFFFF" opacity="0.6" />
    <Circle cx="58" cy="50" r="1.5" fill="#FFFFFF" opacity="0.7" />
  </Svg>
);

// ==================== MIRROR FRAME ====================
export const MirrorFrameIcon: React.FC<IconProps & { width?: number; height?: number }> = ({
  width = 280,
  height = 320,
}) => (
  <Svg width={width} height={height} viewBox="0 0 280 320">
    <Defs>
      <LinearGradient id="mf-gold" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FCD34D" />
        <Stop offset="0.5" stopColor="#FEF3C7" />
        <Stop offset="1" stopColor="#FCD34D" />
      </LinearGradient>
    </Defs>
    <Path
      d="M 30 30 Q 30 10, 50 10 L 230 10 Q 250 10, 250 30 L 250 290 Q 250 310, 230 310 L 50 310 Q 30 310, 30 290 Z"
      fill="none"
      stroke="url(#mf-gold)"
      strokeWidth="3"
    />
    <Circle cx="45" cy="45" r="4" fill="#FCD34D" opacity="0.7" />
    <Circle cx="235" cy="45" r="4" fill="#FCD34D" opacity="0.7" />
    <Circle cx="45" cy="275" r="4" fill="#FCD34D" opacity="0.7" />
    <Circle cx="235" cy="275" r="4" fill="#FCD34D" opacity="0.7" />
  </Svg>
);

// ==================== ROSE ====================
export const RoseIcon: React.FC<IconProps> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Defs>
      <RadialGradient id="rose-r" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FBD5D5" />
        <Stop offset="0.6" stopColor="#FF6670" />
        <Stop offset="1" stopColor="#8A0E0E" />
      </RadialGradient>
    </Defs>
    <Circle cx="12" cy="12" r="6" fill="url(#rose-r)" />
    <Circle cx="9" cy="9" r="3" fill="#FBD5D5" opacity="0.7" />
    <Circle cx="15" cy="9" r="3" fill="#FBD5D5" opacity="0.7" />
    <Circle cx="9" cy="15" r="3" fill="#FBD5D5" opacity="0.7" />
    <Circle cx="15" cy="15" r="3" fill="#FBD5D5" opacity="0.7" />
    <Circle cx="12" cy="12" r="2" fill="#8A0E0E" />
  </Svg>
);
