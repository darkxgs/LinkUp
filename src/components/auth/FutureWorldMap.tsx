import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export function FutureWorldMap({ width, height }: { width: number; height: number }) {
  // We use a viewBox of 400x320 to map coordinates
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: 0.12 }]} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 320"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id="mapGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#E11414" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* North America */}
        <Path
          d="M 25,60 C 45,30 80,45 110,35 C 125,30 135,45 140,65 C 145,85 125,95 120,105 C 110,120 85,115 80,125 C 70,145 45,140 35,135 Z"
          fill="none"
          stroke="#FCA5A5"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* South America */}
        <Path
          d="M 80,125 C 90,135 95,145 100,165 C 105,185 110,215 95,245 C 85,260 75,275 70,295 C 70,275 65,235 67,205 C 70,175 65,145 80,125 Z"
          fill="none"
          stroke="#FCA5A5"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* Europe / Asia */}
        <Path
          d="M 170,40 C 185,20 215,15 245,20 C 285,25 315,15 335,30 C 355,45 375,35 385,50 C 395,70 375,100 370,120 C 365,140 375,160 365,180 C 345,200 315,180 295,190 C 275,200 245,190 225,200 C 195,180 175,140 165,110 C 155,90 160,60 170,40 Z"
          fill="none"
          stroke="#FCA5A5"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* Africa */}
        <Path
          d="M 175,110 C 190,100 210,110 225,130 C 235,145 240,170 230,190 C 220,210 210,230 200,250 C 190,270 185,280 180,290 C 175,280 165,250 163,220 C 160,190 163,150 175,110 Z"
          fill="none"
          stroke="#FCA5A5"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* Australia */}
        <Path
          d="M 310,210 C 330,210 340,220 350,235 C 355,250 345,270 330,270 C 310,270 295,260 300,240 C 305,225 308,210 310,210 Z"
          fill="none"
          stroke="#FCA5A5"
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />

        {/* Glowing city nodes */}
        {/* NYC */}
        <Circle cx={105} cy={65} r={3} fill="#ED4444" opacity={0.8} />
        <Circle cx={105} cy={65} r={7} fill="url(#mapGlow)" />

        {/* London */}
        <Circle cx={185} cy={48} r={3} fill="#E11414" opacity={0.8} />
        <Circle cx={185} cy={48} r={7} fill="url(#mapGlow)" />

        {/* Riyadh */}
        <Circle cx={215} cy={118} r={3} fill="#10B981" opacity={0.8} />
        <Circle cx={215} cy={118} r={8} fill="url(#mapGlow)" />

        {/* Tokyo */}
        <Circle cx={350} cy={65} r={3} fill="#E11414" opacity={0.8} />
        <Circle cx={350} cy={65} r={8} fill="url(#mapGlow)" />

        {/* Brazil */}
        <Circle cx={100} cy={195} r={3} fill="#ED4444" opacity={0.8} />
        <Circle cx={100} cy={195} r={7} fill="url(#mapGlow)" />

        {/* Sydney */}
        <Circle cx={340} cy={245} r={3} fill="#E11414" opacity={0.8} />
        <Circle cx={340} cy={245} r={7} fill="url(#mapGlow)" />
      </Svg>
    </View>
  );
}
