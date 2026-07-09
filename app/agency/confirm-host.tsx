/**
 * توثيق الجنس بعد الانضمام للوكالة
 *
 * الإناث → يحصلن على مزايا المضيفات ويُحتسبن ضمن الحد الأدنى
 * الذكور → يُضافون كأعضاء عاديين (بدون مزايا مضيفات)
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, Users, Crown } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { confirmMyHostGender } from '@/services/agencyApplications';
import PdPolicyCard from '@/components/agency/PdPolicyCard';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase';

type VerifyState = 'loading' | 'ready' | 'no_agency' | 'already_verified_female' | 'already_verified_male';

export default function ConfirmHostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuth();

  const [state, setState] = useState<VerifyState>('loading');
  const [agencyName, setAgencyName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        // فحص عضوية الوكالة
        const memberQ = query(
          collection(firestore, 'agencyMembers'),
          where('uid', '==', user.uid),
          limit(1),
        );
        const memberSnap = await getDocs(memberQ);

        if (memberSnap.empty) {
          setState('no_agency');
          return;
        }

        const memberDoc = memberSnap.docs[0];
        if (!memberDoc) { setState('no_agency'); return; }
        const memberData = memberDoc.data();
        const { agencyId, hostVerified, isFemaleHost } = memberData as {
          agencyId: string;
          hostVerified?: boolean;
          isFemaleHost?: boolean;
        };

        // جلب اسم الوكالة
        const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
        if (agencySnap.exists()) {
          setAgencyName(String(agencySnap.data()?.name ?? ''));
        }

        if (hostVerified === true) {
          setState(isFemaleHost ? 'already_verified_female' : 'already_verified_male');
          return;
        }

        setState('ready');
      } catch {
        setState('no_agency');
      }
    })();
  }, [user?.uid]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const result = await confirmMyHostGender();
      if (result.isFemaleHost) {
        showAlert({
          type: 'success',
          title: t('agencyHostConfirm.doneTitle'),
          message: t('agencyHostConfirm.doneMessageFemale'),
          buttons: [{ text: t('common.ok'), onPress: () => router.back() }],
        });
      } else {
        showAlert({
          type: 'success',
          title: t('agencyHostConfirm.doneTitleMale'),
          message: t('agencyHostConfirm.doneMessageMale'),
          buttons: [{ text: t('common.ok'), onPress: () => router.back() }],
        });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  const renderContent = () => {
    if (state === 'loading') {
      return <ActivityIndicator style={{ marginTop: 60 }} color={lu.colors.pink} />;
    }

    if (state === 'no_agency') {
      return (
        <View style={styles.card}>
          <Users size={48} color={lu.colors.muted} strokeWidth={1.8} />
          <Text variant="h4" weight="bold" align="center" style={{ marginTop: 16 }}>
            {t('agencyHostConfirm.noAgency')}
          </Text>
          <Text variant="bodySmall" color={lu.colors.ink2} align="center" style={styles.hintText}>
            {t('agencyHostConfirm.noAgencyHint')}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.btnOutline}>
            <Text variant="button" color={lu.colors.purple} weight="bold">
              {t('common.back')}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (state === 'already_verified_female') {
      return (
        <View style={styles.card}>
          <Crown size={48} color={lu.colors.pink} strokeWidth={1.8} />
          <Text variant="h4" weight="bold" align="center" style={{ marginTop: 16 }}>
            {t('agencyHostConfirm.alreadyVerifiedFemale')}
          </Text>
          {agencyName ? (
            <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 6 }}>
              {agencyName}
            </Text>
          ) : null}
          <Text variant="bodySmall" color={lu.colors.ink2} align="center" style={styles.hintText}>
            {t('agencyHostConfirm.alreadyVerifiedFemaleHint')}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.btn}>
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
            <Text variant="button" color="#fff" weight="bold">{t('common.ok')}</Text>
          </Pressable>
        </View>
      );
    }

    if (state === 'already_verified_male') {
      return (
        <View style={styles.card}>
          <Users size={48} color={lu.colors.purple} strokeWidth={1.8} />
          <Text variant="h4" weight="bold" align="center" style={{ marginTop: 16 }}>
            {t('agencyHostConfirm.alreadyVerifiedMale')}
          </Text>
          {agencyName ? (
            <Text variant="caption" color={lu.colors.ink2} align="center" style={{ marginTop: 6 }}>
              {agencyName}
            </Text>
          ) : null}
          <Text variant="bodySmall" color={lu.colors.ink2} align="center" style={styles.hintText}>
            {t('agencyHostConfirm.alreadyVerifiedMaleHint')}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.btn}>
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
            <Text variant="button" color="#fff" weight="bold">{t('common.ok')}</Text>
          </Pressable>
        </View>
      );
    }

    // state === 'ready' → اختيار التوثيق
    return (
      <View style={styles.card}>
        <ShieldCheck size={48} color={lu.colors.pink} strokeWidth={1.8} />
        <Text variant="h4" weight="bold" align="center" style={{ marginTop: 16 }}>
          {agencyName || t('agencyHostConfirm.agency')}
        </Text>
        <Text variant="bodySmall" color={lu.colors.ink2} align="center" style={styles.hintText}>
          {t('agencyHostConfirm.hint')}
        </Text>

        {/* توضيح الفرق بين الذكر والأنثى */}
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Crown size={16} color={lu.colors.pink} strokeWidth={2} />
            <Text style={styles.infoLabel} weight="bold">
              {t('agencyHostConfirm.femaleTitle')}
            </Text>
          </View>
          <Text style={styles.infoDesc}>{t('agencyHostConfirm.femaleDesc')}</Text>

          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Users size={16} color={lu.colors.purple} strokeWidth={2} />
            <Text style={styles.infoLabel} weight="bold">
              {t('agencyHostConfirm.maleTitle')}
            </Text>
          </View>
          <Text style={styles.infoDesc}>{t('agencyHostConfirm.maleDesc')}</Text>
        </View>

        <Pressable onPress={handleConfirm} disabled={busy} style={styles.btn}>
          <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text variant="button" color="#fff" weight="bold">
              {t('agencyHostConfirm.confirm')}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <BackChevron />
        </Pressable>
        <Text variant="h3" weight="bold" style={{ flex: 1, textAlign: 'center' }}>
          {t('agencyHostConfirm.title')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}

        {state !== 'loading' && (
          <View style={styles.policyWrap}>
            <PdPolicyCard />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  scrollBody: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  policyWrap: {
    marginTop: spacing.base,
  },
  card: {
    padding: spacing.xl,
    backgroundColor: lu.colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  hintText: {
    marginTop: 10,
    lineHeight: 22,
  },
  infoBox: {
    width: '100%',
    marginTop: 20,
    padding: 14,
    backgroundColor: lu.colors.bg2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: lu.colors.ink,
  },
  infoDesc: {
    fontSize: 12,
    color: lu.colors.ink2,
    lineHeight: 18,
    paddingRight: 4,
  },
  btn: {
    marginTop: spacing.xl,
    width: '100%',
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnOutline: {
    marginTop: spacing.xl,
    width: '100%',
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: lu.colors.purple,
  },
});
