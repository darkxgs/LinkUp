/**
 * مهام المضيفة اليومية — تتبع التقدّم ومنح الكوينز تلقائياً
 * Firestore: config/hostTasks + users/{uid}.hostTasksProgress
 */
import {
  doc,
  onSnapshot,
  getDoc,
  runTransaction,
  collection,
  addDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './index';
import { buildBalanceIncrementPatch } from '@/utils/userBalance';

// ─── Config ─────────────────────────────────────────────────────

export type HostTaskKey =
  | 'messages'
  | 'voiceCalls'
  | 'videoCalls'
  | 'voiceCompetition'
  | 'videoCompetition'
  | 'dailyOnline';

export interface HostTaskItemConfig {
  enabled: boolean;
  order: number;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  target: number;
  rewardCoins: number;
  /** تتكرر عند كل وصول للهدف (مثل كل 1000 رسالة) */
  repeatable: boolean;
  iconKey: 'message' | 'voice' | 'video' | 'voice_pk' | 'video_pk' | 'online';
}

export interface HostTasksConfig {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  resetHour: number;
  tasks: Record<HostTaskKey, HostTaskItemConfig>;
}

export const DEFAULT_HOST_TASKS: HostTasksConfig = {
  enabled: true,
  titleAr: 'صفحة المهمات',
  titleEn: 'Host Tasks',
  subtitleAr: 'أكمل المهام اليومية ثم اضغط «تحصيل» لإضافة الكوينز لحسابك',
  subtitleEn: 'Complete daily tasks then tap Collect to credit coins to your account',
  resetHour: 0,
  tasks: {
    messages: {
      enabled: true,
      order: 1,
      titleAr: 'الرسائل الواردة',
      titleEn: 'Incoming Messages',
      descAr: 'كل 1,000 رسالة تصلك تحصل على 10,000 كوينز',
      descEn: 'Every 1,000 messages received earns 10,000 coins',
      target: 1000,
      rewardCoins: 10_000,
      repeatable: true,
      iconKey: 'message',
    },
    voiceCalls: {
      enabled: true,
      order: 2,
      titleAr: 'محادثة صوتية',
      titleEn: 'Voice Calls',
      descAr: '60 دقيقة صوت مع أشخاص مختلفين (60 ثانية = دقيقة)',
      descEn: '60 voice minutes with different people (60 sec = 1 min)',
      target: 60,
      rewardCoins: 50_000,
      repeatable: false,
      iconKey: 'voice',
    },
    videoCalls: {
      enabled: true,
      order: 3,
      titleAr: 'محادثة فيديو',
      titleEn: 'Video Calls',
      descAr: '60 دقيقة فيديو مع أشخاص مختلفين (60 ثانية = دقيقة)',
      descEn: '60 video minutes with different people (60 sec = 1 min)',
      target: 60,
      rewardCoins: 120_000,
      repeatable: false,
      iconKey: 'video',
    },
    voiceCompetition: {
      enabled: true,
      order: 4,
      titleAr: 'مطابقات صوت',
      titleEn: 'Voice Matches',
      descAr: 'كل 10 مطابقات صوت تحصل على مكافأة',
      descEn: 'Every 10 voice matches earns a reward',
      target: 10,
      rewardCoins: 15_000,
      repeatable: true,
      iconKey: 'voice_pk',
    },
    videoCompetition: {
      enabled: true,
      order: 5,
      titleAr: 'مطابقات فيديو',
      titleEn: 'Video Matches',
      descAr: 'كل 10 مطابقات فيديو تحصل على مكافأة',
      descEn: 'Every 10 video matches earns a reward',
      target: 10,
      rewardCoins: 25_000,
      repeatable: true,
      iconKey: 'video_pk',
    },
    dailyOnline: {
      enabled: true,
      order: 6,
      titleAr: 'التسجيل اليومي',
      titleEn: 'Daily Online',
      descAr: 'أكثر من 8 ساعات في التطبيق مع تفاعل',
      descEn: 'More than 8 hours online with interaction',
      target: 480,
      rewardCoins: 5_000,
      repeatable: false,
      iconKey: 'online',
    },
  },
};

// ─── Progress ───────────────────────────────────────────────────

export interface HostTasksDailyProgress {
  dateKey: string;
  messagesReceived: number;
  paidMessageMilestones: number;
  callSecondsByPartner: { voice: Record<string, number>; video: Record<string, number> };
  voiceCallRewardPaid: boolean;
  videoCallRewardPaid: boolean;
  voiceCompetitionSessions: number;
  paidVoiceCompMilestones: number;
  videoCompetitionSessions: number;
  paidVideoCompMilestones: number;
  onlineMinutes: number;
  hasInteraction: boolean;
  onlineRewardPaid: boolean;
  coinsEarnedToday: number;
}

export interface HostTaskProgressView {
  key: HostTaskKey;
  task: HostTaskItemConfig;
  progress: number;
  target: number;
  percent: number;
  done: boolean;
  coinsEarned: number;
  collectableCoins: number;
  canCollect: boolean;
}

const HOST_TASKS_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayDateKey(resetHour = 0): string {
  const shifted = new Date(Date.now() + HOST_TASKS_TZ_OFFSET_MS - resetHour * 3_600_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function readHostTasksProgress(
  data: Record<string, unknown> | null | undefined,
  resetHour = 0,
): HostTasksDailyProgress {
  const today = todayDateKey(resetHour);
  const raw = data?.hostTasksProgress as HostTasksDailyProgress | undefined;

  const base: HostTasksDailyProgress = {
    dateKey: today,
    messagesReceived: 0,
    paidMessageMilestones: 0,
    callSecondsByPartner: { voice: {}, video: {} },
    voiceCallRewardPaid: false,
    videoCallRewardPaid: false,
    voiceCompetitionSessions: 0,
    paidVoiceCompMilestones: 0,
    videoCompetitionSessions: 0,
    paidVideoCompMilestones: 0,
    onlineMinutes: 0,
    hasInteraction: false,
    onlineRewardPaid: false,
    coinsEarnedToday: 0,
  };

  if (!raw || raw.dateKey !== today) return base;

  return {
    ...base,
    messagesReceived: Number(raw.messagesReceived ?? 0),
    paidMessageMilestones: Number(raw.paidMessageMilestones ?? 0),
    callSecondsByPartner: {
      voice: { ...(raw.callSecondsByPartner?.voice ?? {}) },
      video: { ...(raw.callSecondsByPartner?.video ?? {}) },
    },
    voiceCallRewardPaid: !!raw.voiceCallRewardPaid,
    videoCallRewardPaid: !!raw.videoCallRewardPaid,
    voiceCompetitionSessions: Number(
      raw.voiceCompetitionSessions ?? raw.voiceCompetitionMinutes ?? 0,
    ),
    paidVoiceCompMilestones: Number(raw.paidVoiceCompMilestones ?? 0),
    videoCompetitionSessions: Number(raw.videoCompetitionSessions ?? 0),
    paidVideoCompMilestones: Number(raw.paidVideoCompMilestones ?? 0),
    onlineMinutes: Number(raw.onlineMinutes ?? 0),
    hasInteraction: !!raw.hasInteraction,
    onlineRewardPaid: !!raw.onlineRewardPaid,
    coinsEarnedToday: Number(raw.coinsEarnedToday ?? 0),
  };
}

function totalCallMinutes(secondsByPartner: Record<string, number>): number {
  return Object.values(secondsByPartner).reduce((sum, sec) => sum + Math.floor(Number(sec) / 60), 0);
}

export type AgencyParticipant = {
  agencyRole?: string | null;
  isAgent?: boolean;
  isFemaleHost?: boolean;
  isVerified?: boolean;
  verificationStatus?: string | null;
  agencyId?: string | null;
  gender?: string;
  profile?: { gender?: string };
};

const EMPTY_CALL_SECONDS = { voice: {} as Record<string, number>, video: {} as Record<string, number> };

/** موثّقة — isVerified أو verificationStatus approved */
export function isHostessVerified(
  data: AgencyParticipant | null | undefined,
): boolean {
  if (!data) return false;
  return data.isVerified === true || data.verificationStatus === 'approved';
}

/** أنثى موثّقة (ليست وكيلة) — مؤهّلة لمهام المضيفة بغض النظر عن الوكالة */
export function canEarnHostTasksParticipant(
  data: AgencyParticipant | null | undefined,
): boolean {
  if (!data || isAgencyAgent(data)) return false;
  return resolveParticipantGender(data) === 'female' && isHostessVerified(data);
}

export function resolveParticipantGender(
  data: AgencyParticipant | null | undefined,
): 'male' | 'female' | undefined {
  if (!data) return undefined;
  const g = data.profile?.gender ?? data.gender;
  return g === 'female' || g === 'male' ? g : undefined;
}

export function isAgencyAgent(data: AgencyParticipant | null | undefined): boolean {
  if (!data) return false;
  return (
    data.agencyRole === 'owner' ||
    data.agencyRole === 'agent' ||
    data.isAgent === true
  );
}

/** مضيفة أنثى ضمن وكالة (ليست وكيلة) — تشمل المضيفة الموثّقة */
export function isHostessUser(data: AgencyParticipant | null | undefined): boolean {
  if (!data || isAgencyAgent(data)) return false;

  if (data.isFemaleHost === true && (data.agencyRole === 'host' || !!data.agencyId)) {
    return true;
  }

  return resolveParticipantGender(data) === 'female' && !!data.agencyId;
}

/** تحويل مستند users من Firestore إلى AgencyParticipant */
export function agencyParticipantFromUserDoc(
  data: Record<string, unknown> | null | undefined,
): AgencyParticipant | undefined {
  if (!data) return undefined;
  const profile = data.profile as { gender?: string } | undefined;
  return {
    agencyRole: data.agencyRole as string | null | undefined,
    isAgent: data.isAgent === true,
    isFemaleHost: data.isFemaleHost === true,
    isVerified: data.isVerified === true,
    verificationStatus:
      typeof data.verificationStatus === 'string' ? data.verificationStatus : null,
    agencyId: data.agencyId != null ? String(data.agencyId) : null,
    gender: typeof data.gender === 'string' ? data.gender : profile?.gender,
    profile,
  };
}

/** شريك مكالمة/رسالة مدفوعة — ذكر عادي (ليس مضيفة ولا وكيل) */
export function shouldCountPartnerForHostTasks(
  partner: AgencyParticipant | null | undefined,
): boolean {
  if (!partner) return false;
  if (canEarnHostTasksParticipant(partner)) return false;
  if (isAgencyAgent(partner)) return false;
  return resolveParticipantGender(partner) === 'male';
}

/** رسالة واردة للمضيفة — تُحسب في مهام الرسائل فقط من غير المضيفات وغير الوكلاء */
export function shouldCountMessageForHostTasks(
  senderData: AgencyParticipant | null | undefined,
): boolean {
  if (!senderData) return false;
  if (canEarnHostTasksParticipant(senderData)) return false;
  if (isAgencyAgent(senderData)) return false;
  return true;
}

/** محادثة مع الوكيل — مجانية (لا خصم كوينز) */
export function isAgentChatParticipant(data: AgencyParticipant | null | undefined): boolean {
  return isAgencyAgent(data);
}

// ─── Config subscription ────────────────────────────────────────

export const subscribeToHostTasks = (cb: (config: HostTasksConfig) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'hostTasks');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<HostTasksConfig>;
        cb({
          ...DEFAULT_HOST_TASKS,
          ...data,
          tasks: { ...DEFAULT_HOST_TASKS.tasks, ...(data.tasks ?? {}) },
        });
      } else {
        cb(DEFAULT_HOST_TASKS);
      }
    },
    () => cb(DEFAULT_HOST_TASKS),
  );
};

export const getHostTasksOnce = async (): Promise<HostTasksConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'hostTasks'));
    if (snap.exists()) {
      const data = snap.data() as Partial<HostTasksConfig>;
      return {
        ...DEFAULT_HOST_TASKS,
        ...data,
        tasks: { ...DEFAULT_HOST_TASKS.tasks, ...(data.tasks ?? {}) },
      };
    }
  } catch { /* fallback */ }
  return DEFAULT_HOST_TASKS;
};

// ─── Reward engine (manual collect) ─────────────────────────────

function getCollectableForTask(
  key: HostTaskKey,
  progress: HostTasksDailyProgress,
  config: HostTasksConfig,
): { count: number; coins: number } {
  const task = config.tasks[key];
  if (!task.enabled || task.target <= 0) return { count: 0, coins: 0 };

  const payRepeat = (current: number, paidMilestones: number) => {
    const earned = Math.floor(current / task.target);
    const owed = earned - paidMilestones;
    if (owed <= 0) return { count: 0, coins: 0 };
    return { count: owed, coins: owed * task.rewardCoins };
  };

  const payOnce = (current: number, alreadyPaid: boolean) => {
    if (alreadyPaid || current < task.target) return { count: 0, coins: 0 };
    return { count: 1, coins: task.rewardCoins };
  };

  switch (key) {
    case 'messages':
      return payRepeat(progress.messagesReceived, progress.paidMessageMilestones);
    case 'voiceCalls':
      return payOnce(
        totalCallMinutes(progress.callSecondsByPartner.voice),
        progress.voiceCallRewardPaid,
      );
    case 'videoCalls':
      return payOnce(
        totalCallMinutes(progress.callSecondsByPartner.video),
        progress.videoCallRewardPaid,
      );
    case 'voiceCompetition':
      return payRepeat(
        progress.voiceCompetitionSessions,
        progress.paidVoiceCompMilestones,
      );
    case 'videoCompetition':
      return payRepeat(
        progress.videoCompetitionSessions,
        progress.paidVideoCompMilestones,
      );
    case 'dailyOnline':
      if (!progress.hasInteraction) return { count: 0, coins: 0 };
      return payOnce(progress.onlineMinutes, progress.onlineRewardPaid);
    default:
      return { count: 0, coins: 0 };
  }
}

function applyClaimForTask(
  progress: HostTasksDailyProgress,
  config: HostTasksConfig,
  taskKey: HostTaskKey,
): { progress: HostTasksDailyProgress; coins: number } {
  const collectable = getCollectableForTask(taskKey, progress, config);
  if (collectable.coins <= 0) {
    return { progress, coins: 0 };
  }

  const p = { ...progress };
  const task = config.tasks[taskKey];

  switch (taskKey) {
    case 'messages':
      p.paidMessageMilestones += collectable.count;
      break;
    case 'voiceCalls':
      p.voiceCallRewardPaid = true;
      break;
    case 'videoCalls':
      p.videoCallRewardPaid = true;
      break;
    case 'voiceCompetition':
      p.paidVoiceCompMilestones += collectable.count;
      break;
    case 'videoCompetition':
      p.paidVideoCompMilestones += collectable.count;
      break;
    case 'dailyOnline':
      p.onlineRewardPaid = true;
      break;
    default:
      break;
  }

  p.coinsEarnedToday += collectable.coins;
  void task;
  return { progress: p, coins: collectable.coins };
}

async function logHostTaskReward(
  uid: string,
  amount: number,
  taskKey: HostTaskKey,
  label: string,
): Promise<void> {
  try {
    await addDoc(collection(firestore, 'transactions'), {
      uid,
      type: 'host_task_reward',
      amount,
      currency: 'coins',
      taskKey,
      itemName: label,
      createdAt: Date.now(),
    });
  } catch { /* non-blocking */ }
}

async function mutateHostProgress(
  mutator: (p: HostTasksDailyProgress) => HostTasksDailyProgress,
): Promise<void> {
  const me = auth.currentUser;
  if (!me) return;

  const config = await getHostTasksOnce();
  if (!config.enabled) return;

  const userRef = doc(firestore, 'users', me.uid);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    if (!canEarnHostTasksParticipant(agencyParticipantFromUserDoc(data))) return;

    let progress = readHostTasksProgress(data, config.resetHour ?? 0);
    progress = mutator(progress);

    tx.update(userRef, {
      hostTasksProgress: progress,
      updatedAt: Date.now(),
    } as Record<string, unknown>);
  });
}

export async function collectHostTaskReward(
  taskKey: HostTaskKey,
): Promise<{ coins: number }> {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getHostTasksOnce();
  if (!config.enabled) throw new Error('المهام غير مفعّلة');

  const userRef = doc(firestore, 'users', me.uid);

  const coinsAdded = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');
    const data = snap.data() as Record<string, unknown>;
    if (!canEarnHostTasksParticipant(agencyParticipantFromUserDoc(data))) {
      throw new Error('يجب توثيق حسابك كمضيفة لتجميع المكافآت');
    }

    const progress = readHostTasksProgress(data, config.resetHour ?? 0);
    const { progress: claimed, coins } = applyClaimForTask(progress, config, taskKey);
    if (coins <= 0) throw new Error('لا توجد مكافأة جاهزة للتحصيل');

    const patch: Record<string, unknown> = {
      hostTasksProgress: claimed,
      updatedAt: Date.now(),
      ...buildBalanceIncrementPatch('coins', coins),
    };
    tx.update(userRef, patch as Record<string, unknown>);

    void logHostTaskReward(me.uid, coins, taskKey, config.tasks[taskKey].titleAr);
    return coins;
  });

  return { coins: coinsAdded };
}

// ─── Public trackers ────────────────────────────────────────────

/** يُستدعى من Cloud Function عند وصول رسالة مدفوعة للمضيفة */
export async function trackHostMessageReceived(
  hostUid: string,
  wasPaid = true,
): Promise<void> {
  if (!wasPaid) return;
  try {
    const fn = httpsCallable(functions, 'recordHostMessageReceived');
    await fn({ hostUid, wasPaid: true });
  } catch { /* non-blocking */ }
}

export async function trackHostCallEnded(
  partnerUid: string,
  callType: 'voice' | 'video',
  durationSeconds: number,
): Promise<void> {
  if (!partnerUid || durationSeconds < 1) return;
  await mutateHostProgress((p) => {
    const bucket = callType === 'voice' ? p.callSecondsByPartner.voice : p.callSecondsByPartner.video;
    bucket[partnerUid] = (bucket[partnerUid] ?? 0) + durationSeconds;
    return { ...p, hasInteraction: true };
  });
}

export async function trackHostVoiceCompetition(sessions = 1): Promise<void> {
  if (sessions < 1) return;
  await mutateHostProgress((p) => ({
    ...p,
    voiceCompetitionSessions: p.voiceCompetitionSessions + sessions,
    hasInteraction: true,
  }));
}

export async function trackHostVideoCompetition(sessions = 1): Promise<void> {
  if (sessions < 1) return;
  await mutateHostProgress((p) => ({
    ...p,
    videoCompetitionSessions: p.videoCompetitionSessions + sessions,
    hasInteraction: true,
  }));
}

export async function trackHostOnlineMinutes(minutes: number, withInteraction = false): Promise<void> {
  if (minutes < 1) return;
  await mutateHostProgress((p) => ({
    ...p,
    onlineMinutes: p.onlineMinutes + minutes,
    hasInteraction: p.hasInteraction || withInteraction,
  }));
}

export async function markHostInteraction(): Promise<void> {
  await mutateHostProgress((p) => ({ ...p, hasInteraction: true }));
}

// ─── UI helpers ─────────────────────────────────────────────────

export function getHostTaskProgressList(
  config: HostTasksConfig,
  progress: HostTasksDailyProgress,
): HostTaskProgressView[] {
  const voiceMins = totalCallMinutes(progress.callSecondsByPartner.voice);
  const videoMins = totalCallMinutes(progress.callSecondsByPartner.video);

  const entries: Array<{
    key: HostTaskKey;
    rawProgress: number;
    cycleProgress: number;
    coins: number;
  }> = [
    {
      key: 'messages',
      rawProgress: progress.messagesReceived,
      cycleProgress: progress.messagesReceived % config.tasks.messages.target,
      coins: progress.paidMessageMilestones * config.tasks.messages.rewardCoins,
    },
    {
      key: 'voiceCalls',
      rawProgress: voiceMins,
      cycleProgress: voiceMins,
      coins: progress.voiceCallRewardPaid ? config.tasks.voiceCalls.rewardCoins : 0,
    },
    {
      key: 'videoCalls',
      rawProgress: videoMins,
      cycleProgress: videoMins,
      coins: progress.videoCallRewardPaid ? config.tasks.videoCalls.rewardCoins : 0,
    },
    {
      key: 'voiceCompetition',
      rawProgress: progress.voiceCompetitionSessions,
      cycleProgress: progress.voiceCompetitionSessions % config.tasks.voiceCompetition.target,
      coins: progress.paidVoiceCompMilestones * config.tasks.voiceCompetition.rewardCoins,
    },
    {
      key: 'videoCompetition',
      rawProgress: progress.videoCompetitionSessions,
      cycleProgress: progress.videoCompetitionSessions % config.tasks.videoCompetition.target,
      coins: progress.paidVideoCompMilestones * config.tasks.videoCompetition.rewardCoins,
    },
    {
      key: 'dailyOnline',
      rawProgress: progress.onlineMinutes,
      cycleProgress: progress.onlineMinutes,
      coins: progress.onlineRewardPaid ? config.tasks.dailyOnline.rewardCoins : 0,
    },
  ];

  return entries
    .map(({ key, rawProgress, cycleProgress: cycleProg, coins }) => {
      const task = config.tasks[key];
      const target = task.target || 1;
      const cycleMod = rawProgress % target;
      const displayProgress =
        task.repeatable && key !== 'dailyOnline'
          ? cycleMod === 0 && rawProgress > 0
            ? target
            : cycleMod
          : Math.min(cycleProg, target);
      const done = task.repeatable
        ? displayProgress >= target
        : rawProgress >= target && (key === 'dailyOnline' ? progress.hasInteraction : true);
      const collectable = getCollectableForTask(key, progress, config);
      return {
        key,
        task,
        progress: displayProgress,
        target,
        percent: Math.min(100, Math.round((displayProgress / target) * 100)),
        done,
        coinsEarned: coins,
        collectableCoins: collectable.coins,
        canCollect: collectable.coins > 0,
      };
    })
    .filter((v) => v.task.enabled)
    .sort((a, b) => a.task.order - b.task.order);
}
