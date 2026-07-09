/**
 * خط زمني العلاقة — مطابق Level-1.png
 * خط متموّج + قلب 3D مركزي + شريط المستوى + أرقام
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from '@/components/ui';
import { REL_ASSETS, REL_DESIGN } from './relationshipDesign';
import { TimelineLockedHeart } from './RelationshipTimelineHeart';
import { RelationshipLevelRibbon } from './RelationshipLevelRibbon';

const WINDOW = 5;
const LOCKED_SIZE = 34;
const ACTIVE_SIZE = 64;
const NODE_GAP = 22;
const RIBBON_W = 118;

type Props = {
  levels: number[];
  displayLevel: number;
  currentLevel: number;
  levelLabel: string;
  statusLabel: string;
  isReached: boolean;
  onSelect: (level: number) => void;
};

/** خط متموّج مستمر — ينحني بلطف عند كل قلب كما في Level-1.png */
function buildWavePath(
  points: { x: number; dip: number }[],
  width: number,
  pad: number,
): string {
  if (points.length < 2) return '';
  const baseY = 28;
  const steps = 64;
  const startX = Math.max(0, points[0]!.x - pad);
  const endX = Math.min(width, points[points.length - 1]!.x + pad);

  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + t * (endX - startX);
    let y = baseY;
    for (const p of points) {
      const dist = (x - p.x) / 22;
      y += p.dip * Math.exp(-dist * dist);
    }
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

export function RelationshipTimeline({
  levels,
  displayLevel,
  currentLevel,
  levelLabel,
  statusLabel,
  isReached,
  onSelect,
}: Props) {
  const { width: W } = useWindowDimensions();
  const trackW = W - 36;

  const layout = useMemo(() => {
    const slotW = LOCKED_SIZE + NODE_GAP;
    const activeSlotW = ACTIVE_SIZE + NODE_GAP + 8;
    const centerIdx = levels.indexOf(displayLevel);
    const slots = levels.map((_, i) => (i === centerIdx ? activeSlotW : slotW));
    const totalW = slots.reduce((a, b) => a + b, 0);
    const startX = Math.max(0, (trackW - totalW) / 2);

    let x = startX;
    const nodes = levels.map((lv, i) => {
      const isActive = lv === displayLevel;
      const slot = slots[i]!;
      const cx = x + slot / 2;
      const node = {
        level: lv,
        x: cx,
        isActive,
        slotW: slot,
        dip: isActive ? 14 : 8,
      };
      x += slot;
      return node;
    });

    const wavePoints = nodes.map((n) => ({ x: n.x, dip: n.dip }));
    const wavePath = buildWavePath(wavePoints, trackW, 20);
    const centerNode = nodes.find((n) => n.isActive);

    return {
      nodes,
      wavePath,
      centerX: centerNode?.x ?? trackW / 2,
      totalW: x - startX,
      height: 132,
    };
  }, [levels, displayLevel, trackW]);

  return (
    <View style={[styles.wrap, { width: trackW, height: layout.height }]}>
      {/* الخط المتموّج */}
      <Svg
        width={trackW}
        height={layout.height}
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${trackW} ${layout.height}`}
      >
        <Defs>
          <LinearGradient id="waveGrad" x1="0" y1="0" x2={String(trackW)} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FECACA" stopOpacity={0.2} />
            <Stop offset="0.5" stopColor="#E0CACA" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FECACA" stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        <Path
          d={layout.wavePath}
          stroke="url(#waveGrad)"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* خط أساسي رفيع */}
        <Path
          d={layout.wavePath}
          stroke="#E5D5D5"
          strokeWidth={1}
          fill="none"
          strokeOpacity={0.45}
        />
      </Svg>

      {/* العقد */}
      {layout.nodes.map((node) => {
        const label = String(node.level).padStart(2, '0');
        const reached = node.level <= currentLevel;

        return (
          <Pressable
            key={node.level}
            onPress={() => onSelect(node.level)}
            style={[
              styles.node,
              {
                left: node.x - (node.isActive ? ACTIVE_SIZE / 2 : LOCKED_SIZE / 2),
                top: node.isActive ? 0 : 10,
                width: node.isActive ? ACTIVE_SIZE : LOCKED_SIZE,
              },
            ]}
          >
            {node.isActive ? (
              <View style={styles.activeCol}>
                <View style={styles.activeHeartShadow}>
                  <Image
                    source={REL_ASSETS.heart3d}
                    style={{ width: ACTIVE_SIZE, height: ACTIVE_SIZE }}
                    contentFit="contain"
                  />
                </View>
                <View style={styles.ribbonUnder}>
                  <RelationshipLevelRibbon label={levelLabel} width={RIBBON_W} />
                </View>
              </View>
            ) : (
              <View style={styles.lockedWrap}>
                <TimelineLockedHeart size={LOCKED_SIZE} />
                <Text style={[styles.num, reached && styles.numReached]}>{label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* شارة الحالة تحت شريط المستوى — كما في Level-1.png */}
      <View style={[styles.statusRow, { left: layout.centerX - RIBBON_W / 2 - 8 }]}>
        <View style={styles.statusBg}>
          <View style={[styles.statusPill, isReached ? styles.statusReached : styles.statusLocked]}>
            <Text weight="bold" style={[styles.statusText, isReached ? styles.statusTextReached : styles.statusTextLocked]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** يحسب نافذة 5 مستويات حول المستوى المعروض */
export function timelineWindow(displayLevel: number, total = 15): number[] {
  const half = Math.floor(WINDOW / 2);
  let start = Math.max(1, displayLevel - half);
  let end = Math.min(total, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
  },
  activeCol: {
    alignItems: 'center',
  },
  activeHeartShadow: {
    shadowColor: REL_DESIGN.heartRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  ribbonUnder: {
    marginTop: -6,
    alignItems: 'center',
  },
  lockedWrap: {
    alignItems: 'center',
  },
  num: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '600',
    color: '#8B93A7',
    letterSpacing: 0.2,
  },
  numReached: {
    color: '#A6A6AE',
  },
  statusRow: {
    position: 'absolute',
    top: ACTIVE_SIZE + 34,
    width: RIBBON_W + 40,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  statusBg: {
    backgroundColor: 'rgba(250, 230, 230, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusLocked: {
    backgroundColor: REL_DESIGN.statusLockedBg,
  },
  statusReached: {
    backgroundColor: REL_DESIGN.statusReachedBg,
  },
  statusText: {
    fontSize: 11,
  },
  statusTextLocked: {
    color: REL_DESIGN.statusLockedText,
  },
  statusTextReached: {
    color: REL_DESIGN.statusReachedText,
  },
});
