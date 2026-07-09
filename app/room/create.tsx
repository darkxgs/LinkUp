/**
 * إنشاء غرفة مباشرة — يُنشئ الغرفة بإعدادات افتراضية وينقل للروم.
 * التعديل (الاسم، الصورة، الخصوصية، …) من إعدادات الروم داخل الغرفة.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Radio } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { quickCreateRoom } from '@/services/firebase/rooms';
import { colors } from '@/theme';

export default function CreateRoomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      router.replace('/(tabs)/home' as any);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const roomId = await quickCreateRoom();
        if (!cancelled) router.replace(`/room/${roomId}` as any);
      } catch (e: any) {
        if (cancelled) return;
        Alert.alert(
          t('rooms.createFailed'),
          e?.message ?? t('common.errorOccurred'),
          [{ text: t('common.ok'), onPress: () => router.back() }],
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, router, t]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FCA5A5', '#E11414', '#B00E0E']} style={StyleSheet.absoluteFill} />
      <Radio size={40} color="#FCD34D" strokeWidth={2.5} />
      <ActivityIndicator size="large" color={colors.white} style={{ marginTop: 24 }} />
      <Text variant="body" color="rgba(255,255,255,0.9)" style={{ marginTop: 16 }}>
        {t('rooms.createRoom')}…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
