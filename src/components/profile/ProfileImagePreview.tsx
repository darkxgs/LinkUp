/**
 * معاينة صورة بالحجم الكامل — تُغلق بالضغط خارج الصورة أو زر X
 */
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

type Props = {
  uri: string | null;
  onClose: () => void;
};

export function ProfileImagePreview({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          hitSlop={12}
        >
          <X size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
        {uri ? (
          <Image
            source={{ uri }}
            style={{
              width: width - 28,
              height: Math.min(height * 0.72, width - 28),
              borderRadius: 16,
            }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    end: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
