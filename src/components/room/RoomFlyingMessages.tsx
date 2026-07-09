/**
 * طبقة الرسائل الطائرة — تعرض رسائل SVIP وهي تعبر شاشة الغرفة أفقياً.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { subscribeFlyingMessages, type FlyingMessage } from '@/services/firebase/roomFlyingMessages';

const { width: SCREEN_W } = Dimensions.get('window');

type ActiveFlyer = FlyingMessage & { topPct: number };

function Flyer({ msg, onDone }: { msg: ActiveFlyer; onDone: (id: string) => void }) {
  const tx = useRef(new Animated.Value(SCREEN_W)).current;
  useEffect(() => {
    Animated.timing(tx, {
      toValue: -SCREEN_W * 1.1,
      duration: 7000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => onDone(msg.id));
  }, [tx, msg.id, onDone]);

  return (
    <Animated.View
      style={[styles.flyer, { top: `${msg.topPct}%`, transform: [{ translateX: tx }] }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(235, 33, 33, 0.92)', 'rgba(225, 20, 20,0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {msg.avatar ? (
        <Image source={{ uri: msg.avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={msg.avatar} />
      ) : null}
      <Text variant="caption" weight="bold" color="#FFD86F" numberOfLines={1} style={styles.name}>
        {msg.name}
      </Text>
      <Text variant="caption" weight="bold" color="#fff" numberOfLines={1} style={styles.text}>
        {msg.text}
      </Text>
    </Animated.View>
  );
}

export function RoomFlyingMessages({ roomId }: { roomId: string }) {
  const [flyers, setFlyers] = useState<ActiveFlyer[]>([]);
  const rowRef = useRef(0);

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeFlyingMessages(roomId, (msg) => {
      rowRef.current = (rowRef.current + 1) % 3;
      const topPct = 14 + rowRef.current * 9;
      setFlyers((prev) => [...prev.slice(-6), { ...msg, topPct }]);
    });
    return unsub;
  }, [roomId]);

  const handleDone = useCallback((id: string) => {
    setFlyers((prev) => prev.filter((f) => f.id !== id));
  }, []);

  if (!flyers.length) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {flyers.map((f) => (
        <Flyer key={f.id} msg={f} onDone={handleDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
  flyer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: SCREEN_W * 0.8,
  },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.25)' },
  name: { maxWidth: 90 },
  text: { flexShrink: 1 },
});
