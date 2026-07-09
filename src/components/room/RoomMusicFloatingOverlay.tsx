import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToRoomMusic, type RoomMusic } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { FloatingMusicBubble } from './FloatingMusicBubble';
import { MusicSharePicker } from './MusicSharePicker';

export function RoomMusicFloatingOverlay() {
  const activeRoomId = useRoomMusicUiStore((s) => s.activeRoomId);
  const showSharePicker = useRoomMusicUiStore((s) => s.showSharePicker);
  const closeSharePicker = useRoomMusicUiStore((s) => s.closeSharePicker);
  const insets = useSafeAreaInsets();
  const [music, setMusic] = useState<RoomMusic | null>(null);

  useEffect(() => {
    if (!activeRoomId) {
      setMusic(null);
      return;
    }
    return subscribeToRoomMusic(activeRoomId, (m) => {
      setMusic(m);
      if (!m) {
        closeSharePicker();
        useRoomMusicUiStore.getState().clearIfRoom(activeRoomId);
      }
    });
  }, [activeRoomId, closeSharePicker]);

  if (!activeRoomId) return null;

  // استخدام View مطلق بدلاً من Modal لتجنّب تعارض Modal مع لوحة الأدوات المتحركة
  if (showSharePicker && !music) {
    return (
      <View style={styles.overlay} pointerEvents="box-none">
        {/* خلفية شبه شفافة — اضغط لإغلاق */}
        <Pressable style={styles.backdrop} onPress={closeSharePicker} pointerEvents="auto" />
        {/* بطاقة الاختيار — معلّقة في أعلى الشاشة */}
        <View
          style={[styles.pickerAnchor, { top: insets.top + 72 }]}
          pointerEvents="auto"
        >
          <MusicSharePicker roomId={activeRoomId} onClose={closeSharePicker} />
        </View>
      </View>
    );
  }

  if (!music) return null;

  return <FloatingMusicBubble roomId={activeRoomId} music={music} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99998,
    elevation: 99998,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerAnchor: {
    position: 'absolute',
    start: 14,
  },
});
