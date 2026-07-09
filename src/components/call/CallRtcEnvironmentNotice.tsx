import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, MonitorSmartphone } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { spacing, radius } from '@/theme';
import {
  resolveRtcEnvironmentKind,
  rtcNoticeI18nKeys,
} from '@/utils/rtcEnvironmentMessage';

interface Props {
  error?: string | null;
}

/** بطاقة لطيفة عند تشغيل المكالمة على Expo Go أو المحاكي */
export function CallRtcEnvironmentNotice({ error }: Props) {
  const { t } = useTranslation();
  const kind = resolveRtcEnvironmentKind(error);
  if (!kind) return null;

  const keys = rtcNoticeI18nKeys(kind);
  const Icon = kind === 'expo-go' ? Smartphone : MonitorSmartphone;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconCircle}>
          <Icon size={22} color="#fff" strokeWidth={2.2} />
        </View>
        <Text variant="body" weight="bold" color="#fff" style={styles.title}>
          {t(keys.title)}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.88)" style={styles.message}>
          {t(keys.message)}
        </Text>
        <View style={styles.hintRow}>
          <Text variant="caption" color="rgba(255,255,255,0.65)" style={styles.hint}>
            {t(keys.hint)}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(225, 20, 20,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
  },
  hintRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  hint: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
