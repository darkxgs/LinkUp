/**
 * مركز المساعدة والدعم — تصميم عصري مع دعم كامل للعربية
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageSquare,
  Building2,
  ShieldAlert,
  Mail,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  Users,
  Wallet,
  HelpCircle,
  ClipboardList,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { LinkUpSupportAvatar } from '@/components/support/LinkUpSupportAvatar';
import { sendWelcomeMessageIfNeeded, SUPPORT_UID } from '@/services/supportAccount';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
import { markSupportPriority } from '@/services/firebase/svipPerks';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

const isRTL = I18nManager.isRTL;

const LINK_ITEMS = [
  { key: 'agency',  icon: Building2,   color: '#C40E1E', bg: '#FEF2F2', route: '/agency/center' },
  { key: 'wallet',  icon: Wallet,      color: '#D97706', bg: '#FFFBEB', route: '/wallet' },
  { key: 'report',  icon: ShieldAlert, color: '#DC2626', bg: '#FEF2F2', route: '/report' },
  { key: 'myReports', icon: ClipboardList, color: '#7C3AED', bg: '#F5F3FF', route: '/report/my' },
  { key: 'email',   icon: Mail,        color: '#EA2626', bg: '#FEF0F0', action: 'mailto:support@linkuplivechat.com' },
] as const;

const FAQ_KEYS = ['account', 'wallet', 'agency', 'rooms', 'report'] as const;

export default function SupportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openingChat, setOpeningChat] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(FAQ_KEYS[0]);
  const { user } = useAuth();
  const { vipSystem } = useConfig();
  // امتياز SVIP «خدمة عملاء حصرية»
  const hasPrioritySupport = userHasVipFeature(user, 'exclusiveSupport', vipSystem);

  const openLiveChat = async () => {
    setOpeningChat(true);
    try {
      if (hasPrioritySupport) void markSupportPriority();
      await sendWelcomeMessageIfNeeded();
      router.push(`/chat/${SUPPORT_UID}` as any);
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackChevron size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{t('support.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[...lu.gradients.brand]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBg}
          />
          <View style={styles.heroInner}>
            <View style={styles.heroAvatarWrap}>
              <LinkUpSupportAvatar size={64} />
              <View style={styles.heroOnline} />
            </View>
            <View style={styles.heroText}>
              <Text weight="bold" style={styles.heroTitle}>{t('support.heroTitle')}</Text>
              <Text style={styles.heroSub}>{t('support.heroSubtitle')}</Text>
            </View>
          </View>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Users size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
              <Text style={styles.badgeText}>{t('support.badgeTeam')}</Text>
            </View>
            <View style={[styles.badge, styles.badgeDivider]} />
            <View style={styles.badge}>
              <ShieldCheck size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
              <Text style={styles.badgeText}>{t('support.badgeOfficial')}</Text>
            </View>
            <View style={[styles.badge, styles.badgeDivider]} />
            <View style={styles.badge}>
              <Clock size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
              <Text style={styles.badgeText}>
                {hasPrioritySupport
                  ? t('support.svipPriority', { defaultValue: 'أولوية SVIP ⭐' })
                  : t('support.responseTime')}
              </Text>
            </View>
          </View>
        </View>

        {/* Chat CTA */}
        <Pressable
          onPress={() => void openLiveChat()}
          disabled={openingChat}
          style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.88 }]}
        >
          <LinearGradient
            colors={['#E11414', '#8A0E0E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.chatBtnIcon}>
            {openingChat ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MessageSquare size={22} color="#fff" strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={styles.chatBtnTitle}>{t('support.liveChat')}</Text>
            <Text style={styles.chatBtnSub}>{t('support.liveChatHint')}</Text>
          </View>
        </Pressable>

        {/* Quick links */}
        <Text style={styles.sectionLabel}>{t('support.quickLinks')}</Text>
        <View style={styles.linksCard}>
          {LINK_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <View key={item.key}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: lu.colors.bg2 }]}
                  onPress={() => {
                    if ('action' in item) void Linking.openURL(item.action);
                    else if ('route' in item) router.push(item.route as any);
                  }}
                >
                  <View style={[styles.linkIcon, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} strokeWidth={2.2} />
                  </View>
                  <View style={styles.linkText}>
                    <Text weight="semibold" style={styles.linkTitle}>
                      {t(`support.links.${item.key}.title`)}
                    </Text>
                    <Text style={styles.linkHint}>
                      {t(`support.links.${item.key}.hint`)}
                    </Text>
                  </View>
                  <View style={styles.linkChevron}>
                    <Text style={[styles.chevronGlyph, { color: lu.colors.muted }]}>
                      {isRTL ? '‹' : '›'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* FAQ */}
        <View style={styles.faqHeaderRow}>
          <HelpCircle size={16} color={lu.colors.purple} strokeWidth={2.2} />
          <Text style={styles.sectionLabel}>{t('support.faqTitle')}</Text>
        </View>
        <View style={styles.linksCard}>
          {FAQ_KEYS.map((key, i) => {
            const open = expandedFaq === key;
            return (
              <View key={key}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  onPress={() => setExpandedFaq(open ? null : key)}
                  style={({ pressed }) => [styles.faqRow, pressed && { backgroundColor: lu.colors.bg2 }]}
                >
                  <Text weight="semibold" style={[styles.faqQ, { flex: 1 }]}>
                    {t(`support.faq.${key}.q`)}
                  </Text>
                  {open
                    ? <ChevronUp size={18} color={lu.colors.purple} strokeWidth={2.2} />
                    : <ChevronDown size={18} color={lu.colors.muted} strokeWidth={2.2} />
                  }
                </Pressable>
                {open && (
                  <Text style={styles.faqA}>{t(`support.faq.${key}.a`)}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lu.colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
    backgroundColor: lu.colors.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: lu.colors.ink,
  },

  scroll: {
    paddingHorizontal: 14,
    paddingTop: 16,
    gap: 0,
  },

  // Hero
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    ...lu.shadows.pop,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 14,
  },
  heroAvatarWrap: {
    position: 'relative',
  },
  heroOnline: {
    position: 'absolute',
    bottom: 2,
    end: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 17,
    color: '#fff',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 17,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },

  // Chat CTA
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    overflow: 'hidden',
    gap: 12,
    ...lu.shadows.grad,
  },
  chatBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnTitle: {
    fontSize: 15,
    color: '#fff',
  },
  chatBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink2,
    marginBottom: 8,
    marginStart: 2,
  },

  // Links card
  linksCard: {
    backgroundColor: lu.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    overflow: 'hidden',
    marginBottom: 20,
    ...lu.shadows.card,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 14,
    color: lu.colors.ink,
  },
  linkHint: {
    fontSize: 12,
    color: lu.colors.ink2,
    marginTop: 2,
  },
  linkChevron: {
    width: 24,
    alignItems: 'center',
  },
  chevronGlyph: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: lu.colors.line,
    marginHorizontal: 14,
  },

  // FAQ
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginStart: 2,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  faqQ: {
    fontSize: 14,
    color: lu.colors.ink,
    lineHeight: 20,
  },
  faqA: {
    fontSize: 13,
    color: lu.colors.ink2,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
