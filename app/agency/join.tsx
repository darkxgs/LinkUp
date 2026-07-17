/**
 * انضم للوكالة — كود دعوة أو طلب عبر الدعم (Luxurious Redesign)
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { KeyRound, Headphones, FileText } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { acceptAgencyInviteByCode, userHasAgencyMembership, hasPendingAgencyJoinRequest } from '@/services/agencyService';
import { isHostessVerified } from '@/services/firebase/hostTasks';
import { sendAgencyJoinRequestToSupport, SUPPORT_UID } from '@/services/supportAccount';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { resolveDisplayName } from '@/utils/displayName';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

const { width } = Dimensions.get('window');
const CITY_SKYLINE_URL = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';

export default function AgencyJoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ code?: string; agencyId?: string; agencyName?: string }>();

  const [code, setCode] = useState(String(params.code ?? ''));
  const [busy, setBusy] = useState(false);

  const accountId = getDisplayAccountId(user?.publicAccountId, user?.uid ?? '');
  const displayName = resolveDisplayName({ displayName: user?.profile?.displayName });

  const handleJoinByCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      showAlert({ type: 'error', title: t('common.error'), message: t('agencyHub.codeRequired') });
      return;
    }
    if (user?.uid && (await userHasAgencyMembership(user.uid))) {
      showAlert({ type: 'warning', title: t('common.error'), message: t('agencyHub.alreadyInAgency') });
      return;
    }
    // حارس الطلب المعلّق — يمنع تكرار الإرسال بينما طلب سابق بانتظار موافقة الوكيل
    if (user?.uid && (await hasPendingAgencyJoinRequest(user.uid))) {
      showAlert({
        type: 'warning',
        title: t('agency.text451502'),
        message: t('agency.joinRequestAlreadyPending', 'لديك طلب انضمام معلّق بالفعل — بانتظار موافقة الوكيل'),
      });
      return;
    }
    // شرط الانضمام بالكود: حساب موثّق (عاملة تحقق)
    if (!isHostessVerified(user)) {
      showAlert({
        type: 'warning',
        title: t('agency.text451502'),
        message: t('agency.joinRequiresVerification', 'شرط الانضمام للوكالة: توثيق الحساب أولاً'),
        buttons: [
          { text: t('common.ok') },
          { text: 'توثيق الحساب', onPress: () => router.push('/wallet/kyc' as any) },
        ],
      });
      return;
    }

    setBusy(true);
    try {
      const result = await acceptAgencyInviteByCode(trimmed);
      if (result.pending) {
        // موافقة الانضمام مفعّلة: أُرسل الطلب ولم يُنفَّذ الانضمام — لا تنقل كـ«منضم»
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: 'تم إرسال طلب الانضمام — بانتظار موافقة الوكيل',
          buttons: [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/profile' as any) }],
        });
      } else if (result.needsGenderVerification) {
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: t('agency.joinedNeedsVerification', { name: result.agencyName }),
          buttons: [
            { text: t('common.ok'), onPress: () => router.replace('/(tabs)/profile' as any) },
            { text: 'توثيق الحساب', onPress: () => router.push('/wallet/kyc' as any) },
          ],
        });
      } else {
        showAlert({
          type: 'success',
          title: t('agency.text451502'),
          message: t('agencyHub.joinedSuccess', { name: result.agencyName }),
          buttons: [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/profile' as any) }],
        });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  const handleSupportRequest = async () => {
    if (!user?.uid) return;
    if (await userHasAgencyMembership(user.uid)) {
      showAlert({ type: 'warning', title: t('common.error'), message: t('agencyHub.alreadyInAgency') });
      return;
    }

    setBusy(true);
    try {
      await sendAgencyJoinRequestToSupport({
        publicAccountId: accountId,
        displayName,
        agencyId: params.agencyId ? String(params.agencyId) : undefined,
        agencyName: params.agencyName ? String(params.agencyName) : undefined,
        inviteCode: code.trim() || undefined,
      });
      showAlert({
        type: 'success',
        title: t('agencyHub.supportSentTitle'),
        message: t('agencyHub.supportSentBody'),
        buttons: [
          {
            text: t('agencyHub.openSupportChat'),
            onPress: () => router.replace(`/chat/${SUPPORT_UID}` as any),
          },
        ],
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={{ uri: CITY_SKYLINE_URL }}
        style={{ width: '100%', height: 350, position: 'absolute', top: 0 }}
        imageStyle={{ opacity: 0.6 }}
      >
        <LinearGradient
          colors={['rgba(20, 10, 12, 0.1)', 'rgba(20, 10, 12, 0.8)', '#140A0C']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <BlurView intensity={20} tint="light" style={styles.glassBtn}>
            <BackChevron color="#fff" size={22} />
          </BlurView>
        </Pressable>
        <View style={styles.headerTitles}>
          <Text variant="h2" weight="bold" color="#fff" align="right" style={styles.mainTitle}>
            {t('agencyHub.joinTitle')}
          </Text>
        </View>
      </View>

      <View style={{ padding: spacing.xl, flex: 1, marginTop: 40 }}>
        <View style={styles.glassCard}>
          <Text variant="body" color="rgba(255,255,255,0.75)" style={{ marginBottom: spacing.lg, lineHeight: 24, textAlign: 'right' }}>
            {t('agencyHub.joinHint')}
          </Text>

          <Text variant="bodySmall" color="rgba(255,255,255,0.55)" align="right" style={styles.label}>
            {t('agencyHub.inviteCodeLabel')}
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t('agencyHub.inviteCodePh')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="none"
            style={styles.input}
            textAlign="right"
          />

          <Pressable onPress={handleJoinByCode} disabled={busy} style={styles.primaryBtn}>
            <LinearGradient colors={['rgba(225, 20, 20, 0.8)', 'rgba(225, 20, 20, 0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassTopBorder} />
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text variant="button" weight="bold" color="#fff">
                  {t('agencyHub.joinWithCode')}
                </Text>
                <KeyRound size={20} color="#fff" />
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="rgba(255,255,255,0.45)">
              {t('common.or', 'أو')}
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable onPress={handleSupportRequest} disabled={busy} style={styles.secondaryBtn}>
            <LinearGradient colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']} style={StyleSheet.absoluteFill} />
            <Text variant="button" weight="bold" color="#FCA5A5">
              {t('agencyHub.requestViaSupport')}
            </Text>
            <Headphones size={20} color="#FCA5A5" />
          </Pressable>
          <Text variant="caption" color="rgba(255,255,255,0.45)" align="center" style={{ marginTop: 14 }}>
            {t('agencyHub.supportHint')}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#140A0C' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitles: {
    flex: 1,
  },
  mainTitle: {
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  glassCard: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  label: { marginBottom: 12 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  glassTopBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  secondaryBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.35)',
    overflow: 'hidden',
  },
});
