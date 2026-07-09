/**
 * تقديم مشكلة شحن — يفتح محادثة بوت الشحن
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import { LuArrowIcon } from '@/components/icons/LuDesignIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { WALLET_DESIGN } from '@/components/wallet/walletDesign';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { sendRechargeProblemToBot, RECHARGE_BOT_UID } from '@/services/rechargeBot';

const CATEGORIES = [
  { id: 'recharge', key: 'wallet.problemRecharge' },
  { id: 'app', key: 'wallet.problemApp' },
  { id: 'suggestion', key: 'wallet.problemSuggestion' },
  { id: 'other', key: 'wallet.problemOther' },
] as const;

export default function RechargeProblemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const accountId = getDisplayAccountId(user?.publicAccountId, user?.uid ?? '');

  const submit = async (categoryId: string, categoryLabel: string) => {
    if (!user) return;
    if (loading) return; // صفوف الفئات ليست معطّلة أثناء الإرسال — منع بلاغات مكررة
    setLoading(true);
    try {
      await sendRechargeProblemToBot({
        publicAccountId: accountId,
        category: categoryLabel,
        details: categoryId === selected ? details : undefined,
      });
      router.replace(`/chat/${RECHARGE_BOT_UID}` as any);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text weight="bold" style={styles.headerTitle}>{t('wallet.problemTitle')}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={WALLET_DESIGN.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.subtitle}>{t('wallet.problemSubtitle')}</Text>

        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => {
              if (cat.id === 'other' || cat.id === 'recharge') {
                setSelected(cat.id);
              } else {
                void submit(cat.id, t(cat.key));
              }
            }}
            style={styles.row}
          >
            <Text style={styles.rowText}>{t(cat.key)}</Text>
            <LuArrowIcon size={16} color={WALLET_DESIGN.muted} direction="left" />
          </Pressable>
        ))}

        {selected ? (
          <View style={styles.form}>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('wallet.problemDetailsPlaceholder')}
              placeholderTextColor={WALLET_DESIGN.muted}
              multiline
              style={styles.input}
            />
            <Pressable
              onPress={() => void submit(selected, t(CATEGORIES.find((c) => c.id === selected)!.key))}
              disabled={loading}
              style={[styles.sendBtn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text weight="bold" style={styles.sendText}>{t('wallet.problemSend')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WALLET_DESIGN.line,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    color: WALLET_DESIGN.ink,
  },
  backBtn: {
    position: 'absolute',
    end: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
    color: WALLET_DESIGN.muted,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WALLET_DESIGN.line,
  },
  rowText: { fontSize: 15, color: WALLET_DESIGN.ink },
  form: { padding: 16, gap: 12 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: WALLET_DESIGN.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: WALLET_DESIGN.ink,
    textAlignVertical: 'top',
    fontFamily: lu.fonts.body,
  },
  sendBtn: {
    backgroundColor: WALLET_DESIGN.purple,
    borderRadius: 99,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontSize: 14 },
});
