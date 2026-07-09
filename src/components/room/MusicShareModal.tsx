/**
 * MusicShareModal — اختيار ملف صوت من الجهاز ومشاركته في الروم
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import {
  Music2,
  Disc3,
  Upload,
  Sparkles,
  Headphones,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { auth } from '@/services/firebase/index';
import { startInstantLocalBroadcast } from '@/services/roomMusicUpload';
import { RoomMusicFileTooLargeError } from '@/constants/roomMusic';
import { lu } from '@/theme/lu-brand';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
}

export function MusicShareModal({ visible, onClose, roomId }: Props) {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const spin = useRef(new Animated.Value(0)).current;

  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spin]);

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reset = () => {
    setPicked(null);
    setTitle('');
    setBroadcasting(false);
  };

  const handleClose = () => {
    if (broadcasting) return;
    reset();
    onClose();
  };

  const handlePick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
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
      reset();
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={!broadcasting ? handleClose : undefined} />
        <View style={styles.sheet}>
          <LinearGradient
            colors={['#3A1316', '#1A0A0C', '#180606']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.handle} />

          <View style={styles.vinylWrap}>
            <LinearGradient
              colors={['#E11414', '#C40E1E', '#FFC53D']}
              style={styles.vinylGlow}
            />
            <Animated.View style={[styles.vinyl, { transform: [{ rotate: spinDeg }] }]}>
              <LinearGradient colors={['#1A0A0C', '#3A1316']} style={styles.vinylInner}>
                <Disc3 size={48} color={lu.colors.pink} strokeWidth={1.8} />
              </LinearGradient>
            </Animated.View>
            <View style={styles.vinylBadge}>
              <Music2 size={18} color="#fff" strokeWidth={2.4} />
            </View>
          </View>

          <Text variant="h3" weight="bold" color="#fff" align="center">
            {t('room.musicShareTitle')}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.65)" align="center" style={styles.sub}>
            {t('room.musicShareSubtitle')}
          </Text>

          <Pressable
            onPress={handlePick}
            disabled={broadcasting}
            style={({ pressed }) => [styles.pickCard, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={['rgba(225, 20, 20,0.25)', 'rgba(240, 61, 61, 0.15)']}
              style={StyleSheet.absoluteFill}
            />
            <Headphones size={28} color={lu.colors.pink} strokeWidth={2.2} />
            <View style={{ flex: 1, marginStart: 14 }}>
              <Text variant="body" weight="semibold" color="#fff">
                {picked ? picked.name : t('room.musicPickFile')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
                {picked ? t('room.musicTapToChange') : 'MP3 · M4A · WAV'}
              </Text>
            </View>
            <Upload size={22} color={lu.colors.blue} />
          </Pressable>

          <TextInput
            style={styles.titleInput}
            placeholder={t('room.musicTitlePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={title}
            onChangeText={setTitle}
            editable={!broadcasting}
            textAlign={I18nManager.isRTL ? 'right' : 'left'}
          />

          <Pressable
            onPress={handleBroadcast}
            disabled={broadcasting || !picked}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={lu.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {broadcasting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Sparkles size={20} color="#fff" strokeWidth={2.4} />
                <Text variant="button" weight="bold" color="#fff" style={{ marginStart: 8 }}>
                  {t('room.musicBroadcast')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 12,
    overflow: 'hidden',
    minHeight: 420,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  vinylWrap: {
    alignSelf: 'center',
    marginBottom: 20,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.35,
  },
  vinyl: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 3,
    backgroundColor: '#111',
  },
  vinylInner: {
    flex: 1,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1A0A0C',
  },
  sub: { marginTop: 8, marginBottom: 22, paddingHorizontal: 12, lineHeight: 20 },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  titleInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressWrap: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: lu.colors.pink,
    borderRadius: 3,
  },
  cta: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
