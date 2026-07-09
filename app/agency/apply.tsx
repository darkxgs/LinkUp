/**
 * تقديم طلب فتح وكالة — تصميم خطوات عربي
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, CheckCircle2 } from 'lucide-react-native';

import { Text, useAlert, CountryPickerSheet } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { getCountryByCode } from '@/data/countries';
import { useAuth } from '@/hooks/useAuth';
import { submitAgencyApplication } from '@/services/agencyApplications';
import { sendAgencyApplicationConfirmation, SUPPORT_UID } from '@/services/supportAccount';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { lu } from '@/theme/lu-brand';

const MIN_HOSTS = 10;

export default function AgencyApplyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const accountId = getDisplayAccountId(user?.publicAccountId, user?.uid ?? '');

  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromChat = source === 'chat';

  const [agencyName, setAgencyName]         = useState('');
  const [countryCode, setCountryCode]       = useState('PS');
  const [phone, setPhone]                   = useState('');
  const [minHostsRequired, setMinHostsRequired] = useState(String(MIN_HOSTS));
  const [submitting, setSubmitting]         = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const selectedCountry = getCountryByCode(countryCode);
  const parsedMinHosts  = Math.max(MIN_HOSTS, parseInt(minHostsRequired, 10) || MIN_HOSTS);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/agency/center' as any);
  };

  const handleSubmit = async () => {
    if (!agencyName.trim()) {
      showAlert({ type: 'error', title: t('common.error'), message: t('agencyApply.nameRequired') });
      return;
    }
    if (!phone.trim()) {
      showAlert({ type: 'error', title: t('common.error'), message: t('agencyApply.phoneRequired') });
      return;
    }
    if (parsedMinHosts < MIN_HOSTS) {
      showAlert({ type: 'error', title: t('common.error'), message: t('agencyApply.hostsMin', { count: MIN_HOSTS }) });
      return;
    }

    setSubmitting(true);
    try {
      await submitAgencyApplication({
        agencyName: agencyName.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        phone: phone.trim(),
        minHostsRequired: parsedMinHosts,
      });

      if (fromChat && user?.uid) {
        await sendAgencyApplicationConfirmation(user.uid);
      }

      showAlert({
        type: 'success',
        title: t('agencyApply.sentTitle'),
        message: t('agencyApply.sentMessage'),
        buttons: [{
          text: t('common.ok'),
          onPress: () => {
            if (fromChat) router.replace(`/chat/${SUPPORT_UID}` as any);
            else router.replace('/agency/center' as any);
          },
        }],
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header with gradient */}
      <LinearGradient
        colors={['#B00E0E', '#E11414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 4 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={styles.backBtn} hitSlop={10}>
            <BackChevron color="#fff" size={22} />
          </Pressable>
          <Text weight="bold" style={styles.headerTitle}>
            {t('agencyApply.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.heroSub}>{t('agencyApply.intro')}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}>
            <Text weight="bold" style={styles.stepNum}>١</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={styles.stepTitle}>{t('agencyApply.sectionAgency')}</Text>
            <Text style={styles.stepHint}>{t('agencyApply.sectionAgencyHint')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* معرّف الحساب */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('agencyApply.accountId')}</Text>
            <View style={styles.readOnlyField}>
              <Text weight="bold" style={styles.readOnlyText}>{accountId}</Text>
            </View>
          </View>

          {/* اسم الوكالة */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('agencyApply.agencyName')}</Text>
            <TextInput
              style={styles.input}
              value={agencyName}
              onChangeText={setAgencyName}
              placeholder={t('agencyApply.agencyNamePh')}
              placeholderTextColor={lu.colors.muted}
            />
          </View>

          {/* الدولة */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('agencyApply.country')}</Text>
            <Pressable style={styles.selectField} onPress={() => setCountryPickerOpen(true)}>
              <Text style={[styles.selectText, !selectedCountry && { color: lu.colors.muted }]} numberOfLines={1}>
                {selectedCountry
                  ? `${selectedCountry.name} (${selectedCountry.code})`
                  : t('agencyApply.countryPh')}
              </Text>
              <ChevronDown size={17} color={lu.colors.muted} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* الهاتف */}
          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.label}>{t('agencyApply.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+970..."
              keyboardType="phone-pad"
              placeholderTextColor={lu.colors.muted}
            />
          </View>
        </View>

        {/* Step 2 */}
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: lu.colors.pinkSoft }]}>
            <Text weight="bold" style={[styles.stepNum, { color: lu.colors.pink }]}>٢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={styles.stepTitle}>{t('agencyApply.hostsTarget')}</Text>
            <Text style={styles.stepHint}>{t('agencyApply.hostsTargetHint', { min: MIN_HOSTS })}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {/* عدد المضيفات */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('agencyApply.minHostsLabel')}</Text>
            <TextInput
              style={styles.input}
              value={minHostsRequired}
              onChangeText={(v) => setMinHostsRequired(v.replace(/[^0-9]/g, ''))}
              placeholder={String(MIN_HOSTS)}
              keyboardType="number-pad"
              placeholderTextColor={lu.colors.muted}
            />
          </View>

          {/* ملاحظة بعد الموافقة */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>ⓘ {'  '}{t('agencyApply.hostsAfterApproval')}</Text>
          </View>

          {/* شروط الوكالة */}
          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={[styles.label, { marginBottom: 10 }]}>{t('agencyApply.conditions')}</Text>
            {[
              t('agencyApply.cond1', { min: MIN_HOSTS }),
              t('agencyApply.cond2'),
              t('agencyApply.cond3'),
            ].map((cond, i) => (
              <View key={i} style={styles.condRow}>
                <CheckCircle2 size={15} color={lu.colors.purple} strokeWidth={2.2} style={{ marginTop: 1 }} />
                <Text style={styles.condText}>{cond}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* زر الإرسال */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && { opacity: 0.8 }]}
        >
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text weight="bold" style={styles.submitLabel}>
              {t('agencyApply.submit')}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <CountryPickerSheet
        visible={countryPickerOpen}
        title={t('agencyApply.countryPickerTitle')}
        selectedCode={countryCode}
        onSelect={(c) => setCountryCode(c.code)}
        onClose={() => setCountryPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lu.colors.bg,
  },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: '#fff',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },

  // Scroll
  scroll: { flex: 1, marginTop: -10 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  // Step header
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lu.colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: {
    fontSize: 15,
    color: lu.colors.purple,
  },
  stepTitle: {
    fontSize: 15,
    color: lu.colors.ink,
    marginBottom: 2,
  },
  stepHint: {
    fontSize: 12,
    color: lu.colors.ink2,
    lineHeight: 17,
  },

  // Card
  card: {
    backgroundColor: lu.colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: lu.colors.line,
    ...lu.shadows.card,
  },

  // Field
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.ink2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: lu.colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
  },
  readOnlyField: {
    backgroundColor: lu.colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  readOnlyText: {
    fontSize: 14,
    color: lu.colors.ink2,
    letterSpacing: 0.5,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lu.colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
  },

  // Info box
  infoBox: {
    backgroundColor: lu.colors.purpleSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: lu.colors.purple,
    lineHeight: 18,
  },

  // Conditions
  condRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  condText: {
    flex: 1,
    fontSize: 13,
    color: lu.colors.ink,
    lineHeight: 19,
  },

  // Submit
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 18,
    ...lu.shadows.grad,
  },
  submitLabel: {
    fontSize: 15,
    color: '#fff',
  },
});
