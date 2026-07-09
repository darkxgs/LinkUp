import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { FutureWorldMap } from './FutureWorldMap';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Pin SVG Path
const PIN_PATH = 'M10 2C6.13 2 3 5.13 3 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';

interface NodeData {
  id: string;
  fx: number; // fraction of width
  fy: number; // fraction of height
  size: number;
  isCenter?: boolean;
  avatar: string;
  phaseOffset: number; // for floating offset
}

const NODES: NodeData[] = [
  {
    id: 'center',
    fx: 0.5,
    fy: 0.51,
    size: 84,
    isCenter: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    phaseOffset: 0,
  },
  {
    id: 'top',
    fx: 0.48,
    fy: 0.26,
    size: 50,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 0.5,
  },
  {
    id: 'topRight',
    fx: 0.74,
    fy: 0.33,
    size: 54,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 1.2,
  },
  {
    id: 'right',
    fx: 0.90,
    fy: 0.48,
    size: 52,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 2.1,
  },
  {
    id: 'bottomRight',
    fx: 0.76,
    fy: 0.64,
    size: 50,
    avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 3.4,
  },
  {
    id: 'bottomLeft',
    fx: 0.28,
    fy: 0.66,
    size: 50,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 4.5,
  },
  {
    id: 'left',
    fx: 0.10,
    fy: 0.51,
    size: 54,
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    phaseOffset: 5.8,
  },
];

// Connection lines: index mapping in NODES
const EDGES = [
  { from: 0, to: 1, bend: 0.18 },
  { from: 0, to: 2, bend: -0.15 },
  { from: 0, to: 3, bend: 0.20 },
  { from: 0, to: 4, bend: -0.18 },
  { from: 0, to: 5, bend: 0.15 },
  { from: 0, to: 6, bend: -0.20 },
  // Outer Ring
  { from: 1, to: 2, bend: 0.22 },
  { from: 2, to: 3, bend: 0.22 },
  { from: 3, to: 4, bend: 0.22 },
  { from: 4, to: 5, bend: 0.22 },
  { from: 5, to: 6, bend: 0.22 },
  { from: 6, to: 1, bend: 0.22 },
];

function FloatingAvatar({
  node,
  x,
  y,
  time,
  scaleFactor = 1,
}: {
  node: NodeData;
  x: number;
  y: number;
  time: Animated.SharedValue<number>;
  scaleFactor?: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // Subtle float translation offset based on phase offset and time
    const t = time.value + node.phaseOffset;
    const translateY = Math.sin(t) * 5;
    const translateX = Math.cos(t * 0.8) * 3;
    
    // Scale pulse for the center avatar
    let scale = 1;
    if (node.isCenter) {
      scale = 1 + Math.sin(time.value * 1.5) * 0.03;
    }

    return {
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });

  const avatarSize = node.size * scaleFactor;
  const pinOffset = 6 * scaleFactor;
  const pinSizeW = 18 * scaleFactor;
  const pinSizeH = 22 * scaleFactor;
  const framePad = (node.isCenter ? 3.5 : 2.5) * scaleFactor;
  const frameSize = avatarSize + framePad * 2;
  const glowSize = frameSize + (node.isCenter ? 10 : 6) * scaleFactor;
  const frameColors = node.isCenter
    ? (['#FFFFFF', '#FF8A8A', '#E11414', '#9B0A0A'] as const)
    : (['#FFFFFF', '#FFD6D6', '#F06161'] as const);

  return (
    <Animated.View
      style={[
        styles.avatarContainer,
        {
          left: x - avatarSize / 2,
          top: y - avatarSize / 2,
          width: avatarSize,
          height: avatarSize + 20 * scaleFactor, // space for pin
        },
        animatedStyle,
      ]}
    >
      {/* Outer glow — red neon matching onboarding */}
      <View
        style={[
          styles.glowRing,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            borderColor: node.isCenter ? 'rgba(255, 120, 120, 0.55)' : 'rgba(225, 20, 20, 0.35)',
            shadowColor: '#E11414',
            shadowOpacity: node.isCenter ? 0.9 : 0.55,
            shadowRadius: (node.isCenter ? 18 : 12) * scaleFactor,
          },
        ]}
      />

      <LinearGradient
        colors={[...frameColors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: frameSize,
          height: frameSize,
          borderRadius: frameSize / 2,
          padding: framePad,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#E11414',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: node.isCenter ? 0.45 : 0.28,
          shadowRadius: (node.isCenter ? 10 : 6) * scaleFactor,
        }}
      >
        <Image
          source={{ uri: node.avatar }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: '#291B1B',
          }}
          contentFit="cover"
        />
      </LinearGradient>

      {/* Location Pin */}
      <View style={[styles.pinWrapper, { bottom: 0, transform: [{ translateY: pinOffset }] }]}>
        <Svg width={pinSizeW} height={pinSizeH} viewBox="0 0 20 22">
          <Path
            d={PIN_PATH}
            fill={node.isCenter ? '#E11414' : '#E11414'}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
          <Circle cx="10" cy="9" r="3" fill="#FFFFFF" />
        </Svg>
      </View>
    </Animated.View>
  );
}

function CurvedEdge({
  edge,
  nodes,
  progress,
}: {
  edge: typeof EDGES[0];
  nodes: { x: number; y: number }[];
  progress: Animated.SharedValue<number>;
}) {
  const fromNode = nodes[edge.from]!;
  const toNode = nodes[edge.to]!;

  // Midpoint calculation
  const mx = (fromNode.x + toNode.x) / 2;
  const my = (fromNode.y + toNode.y) / 2;

  // Vector perpendicular calculation
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L;
  const py = dx / L;

  // Control point for curve
  const offset = L * edge.bend;
  const cx = mx + px * offset;
  const cy = my + py * offset;

  // Path data
  const pathD = `M ${fromNode.x} ${fromNode.y} Q ${cx} ${cy} ${toNode.x} ${toNode.y}`;

  // Animated particle movement on Bezier curve
  const particleProps = useAnimatedProps(() => {
    const t = (progress.value + edge.from * 0.15) % 1;
    const mt = 1 - t;
    // Bezier quadratic calculation
    const pxVal = mt * mt * fromNode.x + 2 * mt * t * cx + t * t * toNode.x;
    const pyVal = mt * mt * fromNode.y + 2 * mt * t * cy + t * t * toNode.y;
    return {
      cx: pxVal,
      cy: pyVal,
      opacity: Math.sin(t * Math.PI),
    };
  });

  return (
    <>
      {/* Curved Line */}
      <Path
        d={pathD}
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth={1.8}
        opacity={0.48}
        strokeLinecap="round"
      />

      {/* Light Particle */}
      <AnimatedCircle r={3.5} fill="#FFFFFF" animatedProps={particleProps} />
    </>
  );
}

export function MatchNetworkOverlay({
  width,
  height,
  scaleFactor = 1,
}: {
  width: number;
  height: number;
  scaleFactor?: number;
}) {
  const progress = useSharedValue(0);
  const time = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.linear }),
      -1,
      false
    );
    time.value = withRepeat(
      withTiming(100, { duration: 100000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const nodes = NODES.map((n) => ({
    x: n.fx * width,
    y: n.fy * height,
  }));

  return (
    <View style={{ width, height, position: 'relative' }}>

      {/* SVG Curves & Particles */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FCA5A5" />
            <Stop offset="0.5" stopColor="#F26161" />
            <Stop offset="1" stopColor="#F06A6A" />
          </SvgLinearGradient>
        </Defs>

        {EDGES.map((edge, i) => (
          <CurvedEdge key={`edge-${i}`} edge={edge} nodes={nodes} progress={progress} />
        ))}
      </Svg>

      {/* Render Avatars Over SVG */}
      {NODES.map((node, i) => (
        <FloatingAvatar
          key={node.id}
          node={node}
          x={nodes[i]!.x}
          y={nodes[i]!.y}
          time={time}
          scaleFactor={scaleFactor}
        />
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  avatarContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    opacity: 0.6,
  },
  pinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 6 }],
  },
});
