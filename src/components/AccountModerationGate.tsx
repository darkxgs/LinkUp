/**
 * يظهر عند حظر الحساب من لوحة التحكم — يفرض تسجيل الخروج أو انتظار رفع الحظر
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ban } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { repairKycMismatchBan } from '@/services/firebase/kyc';
import { lu } from '@/theme/lu-brand';

const KYC_GENDER_MISMATCH_BAN = 'gender_verification_mismatch';

export function AccountModerationGate() {
  const { t } = useTranslation();
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // حالة الحظر (isBanned/banReason) تصل حيّة عبر مستمع وثيقة المستخدم في authStore،
  // فلا حاجة للاشتراك في الإشعارات لإعادة تحميل المستخدم — أُزيل لتفادي عاصفة refreshUser.

  useEffect(() => {
    if (!user?.uid || !user.isBanned || user.banReason !== KYC_GENDER_MISMATCH_BAN) return;
    void repairKycMismatchBan().then(() => refreshUser());
  }, [user?.uid, user?.isBanned, user?.banReason, refreshUser]);

  if (!user?.isBanned) return null;
  if (user.banReason === KYC_GENDER_MISMATCH_BAN) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(46, 11, 11, 0.92)', 'rgba(46, 11, 11, 0.98)']}
        style={[styles.card, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.iconWrap}>
          <Ban size={40} color="#fff" strokeWidth={2} />
        </View>
        <Text variant="h2" color="#fff" weight="bold" align="center" style={{ marginTop: 20 }}>
          {t('moderation.accountBannedTitle')}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 12, lineHeight: 24 }}>
          {user.banReason || t('moderation.accountBannedBody')}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.6)" align="center" style={{ marginTop: 16 }}>
          {t('moderation.checkNotifications')}
        </Text>
        <Pressable
          onPress={() => router.push('/notifications' as any)}
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
        >
          <Text variant="button" color="#fff" weight="bold">
            {t('notifications.title')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => signOut()}
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.8 }]}
        >
          <Text variant="button" color="rgba(255,255,255,0.9)" weight="bold">
            {t('settings.logout')}
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9999,
    elevation: 99,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: lu.radius.xl,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    marginTop: 28,
    width: '100%',
    paddingVertical: 14,
    borderRadius: lu.radius.pill,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
  },
  btnGhost: {
    marginTop: 12,
    paddingVertical: 12,
  },
});
