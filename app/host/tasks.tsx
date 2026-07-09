/**
 * صفحة مهام المضيفة — مكافآت يومية بالكوينز (تحصيل يدوي)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  MessageCircle,
  Phone,
  Video,
  Mic,
  Trophy,
  Clock,
  Coins,
} from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { lu } from '@/theme/lu-brand';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import {
  readHostTasksProgress,
  getHostTaskProgressList,
  agencyParticipantFromUserDoc,
  collectHostTaskReward,
  type HostTaskProgressView,
  type HostTaskKey,
} from '@/services/firebase/hostTasks';
import { canEarnHostTasks } from '@/utils/genderAccess';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';

function TaskIcon({ keyName, size }: { keyName: string; size: number }) {
  const color = lu.colors.purple;
  switch (keyName) {
    case 'message':
      return <MessageCircle size={size} color={color} />;
    case 'voice':
      return <Phone size={size} color={lu.colors.blue} />;
    case 'video':
      return <Video size={size} color={lu.colors.magenta} />;
    case 'voice_pk':
      return <Mic size={size} color={lu.colors.purple} />;
    case 'video_pk':
      return <Trophy size={size} color="#F5A623" />;
    case 'online':
      return <Clock size={size} color={lu.colors.blue} />;
    default:
      return <Coins size={size} color={color} />;
  }
}

function progressUnit(key: HostTaskKey, isAr: boolean): string {
  if (key === 'dailyOnline') return isAr ? 'دقيقة' : 'min';
  if (key === 'messages') return isAr ? 'رسالة' : 'msgs';
  if (key === 'videoCompetition' || key === 'voiceCompetition') {
    return isAr ? 'مطابقة' : 'matches';
  }
  return isAr ? 'دقيقة' : 'min';
}

function TaskCard({
  item,
  isAr,
  tasksActive,
  collecting,
  onCollect,
}: {
  item: HostTaskProgressView;
  isAr: boolean;
  tasksActive: boolean;
  collecting: boolean;
  onCollect: (key: HostTaskKey) => void;
}) {
  const title = isAr ? item.task.titleAr : item.task.titleEn;
  const desc = isAr ? item.task.descAr : item.task.descEn;
  const unit = progressUnit(item.key, isAr);
  const progressLabel = `${item.progress}/${item.target} ${unit}`;

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskIconWrap}>
          <TaskIcon keyName={item.task.iconKey} size={22} />
        </View>
        <View style={styles.taskTitles}>
          <Text weight="bold" style={styles.taskTitle}>{title}</Text>
          <Text style={styles.taskDesc}>{desc}</Text>
        </View>
        <View style={styles.rewardBadge}>
          <Image source={WALLET_ASSETS.coin} style={styles.coinIcon} contentFit="contain" />
          <Text weight="bold" style={styles.rewardText}>
            {item.task.rewardCoins.toLocaleString('en-US')}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${item.percent}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text weight="bold" style={styles.progressCounter}>{progressLabel}</Text>
        {item.coinsEarned > 0 && (
          <Text style={styles.earnedLabel}>
            {isAr ? 'محصّل' : 'Collected'}: {item.coinsEarned.toLocaleString('en-US')}
          </Text>
        )}
      </View>

      {tasksActive && item.canCollect ? (
        <Pressable
          onPress={() => onCollect(item.key)}
          disabled={collecting}
          style={[styles.collectBtn, collecting && styles.collectBtnDisabled]}
        >
          {collecting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text weight="bold" style={styles.collectBtnText}>
              {isAr
                ? `تحصيل ${item.collectableCoins.toLocaleString('en-US')} كوينز`
                : `Collect ${item.collectableCoins.toLocaleString('en-US')} coins`}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HostTasksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const { showAlert } = useAlert();
  const { hostTasks, loading: configLoading } = useConfig();
  const isAr = i18n.language === 'ar';

  const [progress, setProgress] = useState(() => readHostTasksProgress(null));
  const [userDoc, setUserDoc] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectingKey, setCollectingKey] = useState<HostTaskKey | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
      const data = snap.data() as Record<string, unknown> | undefined;
      setUserDoc(data ?? null);
      setProgress(readHostTasksProgress(data, hostTasks.resetHour ?? 0));
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, hostTasks.resetHour]);

  const taskList = useMemo(
    () => getHostTaskProgressList(hostTasks, progress),
    [hostTasks, progress],
  );

  const participant = agencyParticipantFromUserDoc(userDoc) ?? user;
  const canAccess = canEarnHostTasks(participant);
  const tasksActive = canAccess;

  const handleCollect = async (key: HostTaskKey) => {
    if (collectingKey) return;
    setCollectingKey(key);
    try {
      const { coins } = await collectHostTaskReward(key);
      showAlert({
        type: 'success',
        title: isAr ? 'تم التحصيل' : 'Collected',
        message: isAr
          ? `تمت إضافة ${coins.toLocaleString('en-US')} كوينز لحسابك`
          : `${coins.toLocaleString('en-US')} coins added to your account`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : isAr ? 'تعذّر التحصيل' : 'Collect failed';
      showAlert({ type: 'error', title: isAr ? 'خطأ' : 'Error', message: msg });
    } finally {
      setCollectingKey(null);
    }
  };

  if (loading && !userDoc) {
    return (
      <View style={[styles.fill, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={lu.colors.purple} />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.fill, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.deniedText}>
          {isAr
            ? 'هذه الصفحة للمضيفات الموثّقات فقط'
            : 'This page is for verified hostesses only'}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{isAr ? 'رجوع' : 'Back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#B00E0E', '#C40E1E', '#E11414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.header}>
          <View style={styles.headBtnPlaceholder} />
          <Text weight="bold" style={styles.headTitle}>
            {isAr ? hostTasks.titleAr : hostTasks.titleEn}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <BackChevron color="#fff" size={22} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {isAr ? hostTasks.subtitleAr : hostTasks.subtitleEn}
        </Text>
        <View style={styles.totalEarned}>
          <Image source={WALLET_ASSETS.coin} style={styles.totalCoin} contentFit="contain" />
          <Text weight="bold" style={styles.totalEarnedText}>
            {progress.coinsEarnedToday.toLocaleString('en-US')}
          </Text>
          <Text style={styles.totalEarnedLabel}>
            {isAr ? 'كوينز محصّلة اليوم' : 'coins collected today'}
          </Text>
        </View>
      </LinearGradient>

      {(loading || configLoading) ? (
        <View style={styles.centered}>
          <ActivityIndicator color={lu.colors.purple} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resetNote}>
            {isAr
              ? 'تُعاد المهام يومياً عند الساعة 12:00 ليلاً — اضغط «تحصيل» عند إكمال كل مهمة'
              : 'Tasks reset daily at midnight — tap Collect when each task is complete'}
          </Text>
          {!tasksActive ? (
            <Pressable
              onPress={() => router.push('/wallet/kyc' as any)}
              style={styles.verifyBanner}
            >
              <Text weight="bold" style={styles.verifyBannerTitle}>
                {isAr ? 'وثّقي حسابك لتفعيل المهام' : 'Verify your account to unlock tasks'}
              </Text>
              <Text style={styles.verifyBannerBody}>
                {isAr
                  ? 'بعد التحقق كـ فتاة موثّقة، يبدأ عداد المهام — الرسائل المدفوعة والمكالمات والمطابقات.'
                  : 'Once verified, task counters start — paid messages, calls, and matches count.'}
              </Text>
            </Pressable>
          ) : null}
          {taskList.map((item) => (
            <TaskCard
              key={item.key}
              item={item}
              isAr={isAr}
              tasksActive={tasksActive}
              collecting={collectingKey === item.key}
              onCollect={handleCollect}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FEF2F2' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headBtnPlaceholder: { width: 40 },
  headTitle: { color: '#fff', fontSize: 18 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  totalEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  totalCoin: { width: 24, height: 24 },
  totalEarnedText: { color: '#fff', fontSize: 22 },
  totalEarnedLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  list: { padding: 16, gap: 12 },
  resetNote: {
    fontSize: 12,
    color: '#7C7C85',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#B00E0E',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  taskIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitles: { flex: 1 },
  taskTitle: { fontSize: 15, color: '#3A0A0A' },
  taskDesc: { fontSize: 12, color: '#9A9AA5', marginTop: 2, lineHeight: 17 },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coinIcon: { width: 16, height: 16 },
  rewardText: { fontSize: 12, color: '#B8860B' },
  progressTrack: {
    height: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E11414',
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressCounter: { fontSize: 14, color: '#3A0A0A' },
  progressLabel: { fontSize: 12, color: '#6B7280' },
  earnedLabel: { fontSize: 12, color: '#2E9E5B', fontWeight: '600' },
  collectBtn: {
    marginTop: 12,
    backgroundColor: '#E11414',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  collectBtnDisabled: { opacity: 0.7 },
  collectBtnText: { color: '#fff', fontSize: 14 },
  deniedText: { fontSize: 15, color: '#6B7280', marginBottom: 16 },
  backBtn: {
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: { color: '#fff', fontWeight: '600' },
  verifyBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  verifyBannerTitle: { fontSize: 15, color: '#C2410C', marginBottom: 6 },
  verifyBannerBody: { fontSize: 13, color: '#9A3412', lineHeight: 20 },
});
