/**
 * اختيار ملف موسيقى — بطاقة عائمة صغيرة (ليست مودال كامل)
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Music2, Upload, X, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { auth } from '@/services/firebase/index';
import { startInstantLocalBroadcast } from '@/services/roomMusicUpload';
import { RoomMusicFileTooLargeError } from '@/constants/roomMusic';
import { lu } from '@/theme/lu-brand';

interface Props {
  roomId: string;
  onClose: () => void;
}

export function MusicSharePicker({ roomId, onClose }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const handlePick = async () => {
    try {
      // الحارس يمنع إفراغ المقعد أثناء فتح منتقي الملفات (التطبيق يذهب للخلفية)
      const { withRoomMediaPickerGuard } = await import('@/utils/roomMediaPickerGuard');
      const res = await withRoomMediaPickerGuard(() =>
        DocumentPicker.getDocumentAsync({
          type: 'audio/*',
          copyToCacheDirectory: true,
        }),
      );
      if (res.canceled || !res.assets?.[0]) return;
      const file = res.assets[0];
      setPicked(file);
      const base = file.name?.replace(/\.[^.]+$/, '') ?? '';
      if (!title) setTitle(base);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('room.musicPickFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    }
  };

  const handleBroadcast = async () => {
    if (!picked?.uri) {
      showAlert({
        type: 'warning',
        title: t('room.musicShareTitle'),
        message: t('room.musicPickFirst'),
      });
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showAlert({ type: 'error', title: t('common.error'), message: t('room.musicLoginRequired') });
      return;
    }

    setBroadcasting(true);
    try {
      await startInstantLocalBroadcast(
        roomId,
        picked,
        {
          onUploadError: (msg) =>
            showAlert({ type: 'error', title: t('common.error'), message: msg }),
        },
        { saveToLibrary: true },
      );
      onClose();
      showAlert({
        type: 'success',
        title: t('room.musicLiveTitle'),
        message: t('room.musicSavedToLibrary'),
      });
    } catch (e: unknown) {
      const msg =
        e instanceof RoomMusicFileTooLargeError
          ? t('room.musicFileTooLarge', { max: e.maxMb })
          : e instanceof Error
            ? e.message
            : t('room.musicUploadFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#3A1316', '#1A0A0C']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Music2 size={18} color={lu.colors.pink} />
        <Text variant="bodySmall" weight="bold" color="#fff" style={{ flex: 1, marginStart: 8 }}>
          {t('room.musicShareTitle')}
        </Text>
        <Pressable onPress={onClose} disabled={broadcasting} hitSlop={8}>
          <X size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <Pressable
        onPress={handlePick}
        disabled={broadcasting}
        style={styles.pickRow}
      >
        <Text variant="caption" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
          {picked ? picked.name : t('room.musicPickFile')}
        </Text>
        <Upload size={16} color={lu.colors.blue} />
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder={t('room.musicTitlePlaceholder')}
        placeholderTextColor="rgba(255,255,255,0.35)"
        value={title}
        onChangeText={setTitle}
        editable={!broadcasting}
      />

      <Pressable
        onPress={handleBroadcast}
        disabled={broadcasting || !picked}
        style={styles.cta}
      >
        <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
        {broadcasting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Sparkles size={16} color="#fff" />
            <Text variant="caption" weight="bold" color="#fff" style={{ marginStart: 6 }}>
              {t('room.musicBroadcast')}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
    gap: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: lu.colors.pink,
  },
  cta: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
