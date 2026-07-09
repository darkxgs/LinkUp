/**
 * قسم أمير الوكلاء — يظهر لمديري الوكالات فقط
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Crown, Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  type AgencyPrinceConfig,
  type UserAgencyPrince,
  currentMonthKey,
  isAgencyPrinceUser,
} from '@/services/firebase/agencyPrinceSystem';
import { radius, spacing } from '@/theme';

type Props = {
  config: AgencyPrinceConfig;
  userPrince?: UserAgencyPrince | null;
  uid?: string;
  agencyName?: string;
  isAr: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function AgencyPrinceSection({ config, userPrince, uid, agencyName, isAr }: Props) {
  if (!config.enabled) return null;

  const monthKey = currentMonthKey();
  const isPrince = isAgencyPrinceUser(uid, config, userPrince);
  const holder = config.currentHolder;
  const title = isAr ? config.titleAr : config.titleEn;
  const subtitle = isAr ? config.subtitleAr : config.subtitleEn;
  const accent = config.accentColor || '#F59E0B';

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[`${accent}33`, 'rgba(26, 10, 12,0.95)', `${accent}22`]}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <View style={styles.titleBadge}>
              <Crown size={16} color={accent} />
              <Text weight="bold" style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text>
            <Text variant="caption" style={styles.monthLabel}>
              {isAr ? `شهر ${monthKey}` : `Month ${monthKey}`}
            </Text>
          </View>
          <Image
            source={config.crownImageUrl ? { uri: config.crownImageUrl } : undefined}
            style={styles.crownImg}
            contentFit="contain"
          />
        </View>

        {isPrince ? (
          <View style={[styles.statusBox, { borderColor: `${accent}88` }]}>
            <Sparkles size={16} color={accent} />
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.statusTitle}>
                {isAr ? 'أنت أمير الوكلاء هذا الشهر!' : 'You are Prince of Agents this month!'}
              </Text>
              <Text variant="caption" style={styles.statusSub}>
                {agencyName || userPrince?.agencyName || holder?.agencyName}
              </Text>
            </View>
            {config.badgeImageUrl ? (
              <Image source={{ uri: config.badgeImageUrl }} style={styles.badgeImg} contentFit="contain" />
            ) : null}
          </View>
        ) : holder ? (
          <View style={styles.holderBox}>
            <Text variant="caption" style={styles.holderLabel}>
              {isAr ? 'أمير الوكلاء الحالي' : 'Current Prince of Agents'}
            </Text>
            <Text weight="bold" style={styles.holderName}>{holder.agencyName}</Text>
            <Text variant="caption" style={styles.holderMeta}>
              {holder.ownerName} · {fmt(holder.monthlyTotal)} {isAr ? 'لؤلؤ' : 'pearls'}
            </Text>
          </View>
        ) : (
          <Text variant="caption" style={styles.hint}>
            {isAr
              ? 'نافس على المركز الأول بأرباح مضيفيك خلال هذا الشهر.'
              : 'Compete for #1 with your hosts earnings this month.'}
          </Text>
        )}

        <View style={styles.assetsRow}>
          {config.badgeImageUrl ? (
            <View style={styles.assetCell}>
              <Image source={{ uri: config.badgeImageUrl }} style={styles.assetImg} contentFit="contain" />
              <Text variant="caption" align="center" style={styles.assetLabel}>
                {isAr ? 'الشارة' : 'Badge'}
              </Text>
            </View>
          ) : null}
          {config.entryImageUrl ? (
            <View style={styles.assetCell}>
              <Image source={{ uri: config.entryImageUrl }} style={styles.assetImg} contentFit="contain" />
              <Text variant="caption" align="center" style={styles.assetLabel}>
                {isAr ? 'الدخولية' : 'Entry'}
              </Text>
            </View>
          ) : null}
        </View>

        {config.rulesAr.length > 0 && (
          <View style={styles.rulesBox}>
            {(isAr ? config.rulesAr : (config.rulesEn.length ? config.rulesEn : config.rulesAr)).map((line, i) => (
              <Text key={i} variant="caption" style={styles.ruleLine}>• {line}</Text>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  titleCol: { flex: 1 },
  titleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title: { fontSize: 17, color: '#FDE68A' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  monthLabel: { marginTop: 6, color: 'rgba(255,255,255,0.5)' },
  crownImg: { width: 56, height: 56 },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(245,158,11,0.12)',
    marginBottom: 12,
  },
  statusTitle: { color: '#FFF', fontSize: 14 },
  statusSub: { color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  badgeImg: { width: 44, height: 44 },
  holderBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  holderLabel: { color: 'rgba(255,255,255,0.55)' },
  holderName: { color: '#FFF', fontSize: 15, marginTop: 4 },
  holderMeta: { color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  hint: { color: 'rgba(255,255,255,0.6)', marginBottom: 12, lineHeight: 18 },
  assetsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  assetCell: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  assetImg: { width: 48, height: 48 },
  assetLabel: { color: 'rgba(255,255,255,0.75)', marginTop: 4, fontSize: 10 },
  rulesBox: { gap: 4 },
  ruleLine: { color: 'rgba(255,255,255,0.55)', lineHeight: 16, fontSize: 11 },
});
