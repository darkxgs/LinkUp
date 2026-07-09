import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';

type Props = {
  visible: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string;
  isAgencyRoom?: boolean;
  /** داخل شاشة الروم — بدون Modal خارجي */
  embedded?: boolean;
};

export function RoomPasswordGateModal({
  visible,
  onSubmit,
  onCancel,
  error = '',
  isAgencyRoom = false,
  embedded = false,
}: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  const resetAndCancel = () => {
    setPassword('');
    onCancel();
  };

  const submit = () => {
    onSubmit(password);
  };

  const content = (
    <View style={embedded ? styles.embeddedOverlay : styles.overlay}>
      <View style={styles.card}>
        <Text variant="h4" weight="bold" color="#fff" align="center">
          {t('room.lockedRoomTitle')}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.6)" align="center" style={styles.hint}>
          {isAgencyRoom ? t('room.lockedAgencyHint') : t('room.lockedRoomHint')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={isAgencyRoom ? t('room.lockedAgencyCodePlaceholder') : t('room.lockedRoomCodePlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.4)"
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
          onSubmitEditing={submit}
        />
        {error ? (
          <Text variant="caption" color="#F87171" align="center" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable onPress={submit} style={styles.btn}>
          <LinearGradient
            colors={[lu.colors.pink, lu.colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            <Text variant="body" weight="bold" color="#fff">
              {t('room.lockedRoomEnter')}
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={resetAndCancel} style={styles.cancelBtn}>
          <Text variant="caption" color="rgba(255,255,255,0.6)" align="center">
            {t('room.lockedRoomCancel')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (embedded) {
    if (!visible) return null;
    return content;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndCancel}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as ViewStyle,
  embeddedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ROOM_DESIGN.shellBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: ROOM_DESIGN.stageMid,
    borderRadius: 20,
    padding: 22,
  },
  hint: { marginTop: 4 },
  input: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  error: { marginTop: 6 },
  btn: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  cancelBtn: { marginTop: 10 },
});
