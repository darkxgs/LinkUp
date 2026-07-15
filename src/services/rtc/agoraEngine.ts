/**
 * طبقة محرك Agora — الملف الوحيد في التطبيق الذي يعرف react-native-agora
 *
 * قواعد صارمة:
 * - الموديول يُحمَّل ديناميكياً فقط (await import) — الـ APK المنشور عند
 *   المستخدمين لا يحتوي الموديول الأصلي، وأي استيراد ثابت يتسرب لباندل
 *   شاشة عادية يكسر إقلاع التطبيق (نفس نمط livekit-client في roomAudioSession).
 * - الهوية نصية حصرياً: الانضمام عبر joinChannelWithUserAccount بمعرّف
 *   Firebase، وكل حدث يخرج من هذه الطبقة مترجَماً إلى identity نصي —
 *   الشاشات لا ترى uid رقمياً أبداً (تطابق identity === uid).
 * - مبدأ الأجيال: joinGeneration متصاعد، وأي حدث/عملية بجيل قديم تُهمل
 *   (نفس روح connectGeneration في roomAudioSession).
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';

/** تأخير تحرير المحرك بعد دخول الخلفية — يتفادى إعادة الإنشاء عند تبديل سريع للتطبيقات */
const IDLE_AUDIO_RELEASE_DELAY_MS = 4000;

type AgoraModule = typeof import('react-native-agora');
type IRtcEngine = import('react-native-agora').IRtcEngine;
type IRtcEngineEventHandler = import('react-native-agora').IRtcEngineEventHandler;
type RtcConnection = import('react-native-agora').RtcConnection;

export type AgoraRole = 'broadcaster' | 'audience';
export type AgoraProxyMode = 'none' | 'udp' | 'tcp';

export interface AgoraSpeakerInfo {
  identity: string;
  /** مستوى الصوت مطبَّع 0..1 — عتبة التحدّث في العميل (0.045) تفترض هذا المدى */
  level: number;
}

/** ترجمة دلالية لحالة خلط الموسيقى (audio mixing) — الشاشات لا ترى enums أجورا */
export type AgoraMixingSemantic = 'playing' | 'paused' | 'stopped' | 'failed';

/** أحداث محايدة (لا تعرف Agora) — الشاشات/الجلسات تشترك بها لاحقاً */
export type AgoraRtcEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'reconnecting' }
  | { type: 'reconnected' }
  | { type: 'participantJoined'; identity: string }
  | { type: 'participantLeft'; identity: string }
  | { type: 'trackMuted'; identity: string; muted: boolean }
  | { type: 'speaking'; speakers: AgoraSpeakerInfo[] }
  | { type: 'tokenWillExpire' }
  | { type: 'tokenRequired' }
  | { type: 'proxyConnected'; proxyType: number }
  | { type: 'audioRouteChanged'; route: number }
  /** حالة فيديو الطرف البعيد (بدأ/أوقف كاميرته) — لمكالمات الفيديو 1:1 */
  | { type: 'remoteVideo'; identity: string; enabled: boolean }
  /** جودة شبكة المستخدم المحلي (tx/rx بمقياس QualityType) — لقرار خفض دقة الفيديو */
  | { type: 'networkQuality'; tx: number; rx: number }
  /**
   * حالة خلط الموسيقى على هذا الجهاز (onAudioMixingStateChanged) —
   * state/reason خامان من SDK + ترجمة دلالية وأعلام جاهزة:
   * allLoopsCompleted = انتهى المقطع طبيعياً (تشغيل التالي)،
   * canNotOpen = تعذّر فتح الملف (صيغة غير مدعومة/مسار خاطئ → تخطٍّ).
   */
  | {
      type: 'audioMixingStateChanged';
      state: number;
      reason: number;
      semantic: AgoraMixingSemantic;
      allLoopsCompleted: boolean;
      canNotOpen: boolean;
    };

export type AgoraEventListener = (event: AgoraRtcEvent) => void;

export interface AgoraJoinParams {
  appId: string;
  token: string;
  channel: string;
  /** معرّف Firebase النصي — يصبح userAccount في Agora */
  identity: string;
  role: AgoraRole;
  /** مهلة انتظار onJoinChannelSuccess — سلّم النقل يمرر مهلاً مختلفة لكل درجة */
  timeoutMs?: number;
}

/**
 * فاصل تقارير مستوى الصوت (مللي ثانية). كان 200 (5 مرات/ثانية) فيُطلق re-render
 * لكامل شاشة الغرفة عدة مرات بالثانية طول ما أحد يتكلّم → تسخين وبطء. 400ms
 * (2.5 مرة/ثانية) يخفض الحِمل للنصف مع إبقاء مؤشّر المتحدّث سلساً بما يكفي.
 */
const VOLUME_INDICATION_INTERVAL_MS = 400;
/** مهلة انتظار userAccount لمشارك جديد قبل الإعلان عنه بمعرّف رقمي احتياطي */
const PENDING_ANNOUNCE_TIMEOUT_MS = 700;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** قصّ مستوى صوت 0..100 (واجهات خلط الموسيقى/إشارة التسجيل) */
function clampVolume100(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * تطبيع مسار ملف الخلط — SDK أندرويد/iOS يقبل مساراً مطلقاً أو https/content،
 * أما لاحقة file:// (مسارات expo-file-system) فتُنزع مع فك ترميز النسبة المئوية.
 */
function normalizeMixingFilePath(p: string): string {
  if (!p.startsWith('file://')) return p;
  const raw = p.slice('file://'.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

class AgoraEngineManager {
  private module: AgoraModule | null = null;
  private engine: IRtcEngine | null = null;
  private handler: IRtcEngineEventHandler | null = null;
  private initializedAppId: string | null = null;

  /** جيل متصاعد — يُرفع عند كل join/leave؛ الأحداث القديمة تُهمل */
  private joinGeneration = 0;
  /** جيل الجلسة النشطة حالياً (المطابق لآخر join ناجح البدء) */
  private sessionGeneration = -1;
  private sessionActive = false;
  private currentChannel = '';
  /** مؤقّت تحرير المحرك عند الخمول في الخلفية — يُلغى عند العودة للمقدمة */
  private idleReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private localIdentity = '';
  private localUid = 0;

  /** خريطة uid الرقمي ↔ userAccount النصي — تُبنى من onUserInfoUpdated */
  private uidToAccount = new Map<number, string>();
  private accountToUid = new Map<string, number>();
  /** مشاركون انضموا قبل وصول userAccount — ننتظر قليلاً قبل الإعلان */
  private pendingAnnounce = new Map<number, ReturnType<typeof setTimeout>>();
  /**
   * مشاركون أُعلنوا بهوية رقمية احتياطية (انقضت مهلة انتظار حسابهم النصي) —
   * عند وصول الحساب لاحقاً نُصدر participantLeft(الرقمية) ثم
   * participantJoined(النصية) حتى لا تبقى مقاعد شبح في الشاشات.
   */
  private numericFallbackAnnounced = new Set<number>();

  private listeners = new Set<AgoraEventListener>();
  private joinWaiter: {
    gen: number;
    resolve: () => void;
    reject: (e: Error) => void;
  } | null = null;

  /**
   * حالة خلط الموسيقى + الكتم المطلوب — كتم الـDJ أثناء الخلط لا يجوز أن
   * يكتم المسار المنشور كله (muteLocalAudioStream يقتل الموسيقى مع المايك)،
   * فنكتم إشارة التسجيل (المايك) فقط ونبقي النشر حياً. عند توقف الخلط تعود
   * سياسة الكتم العادية (نشر + التقاط معاً).
   */
  private mixingActive = false;
  private desiredMicMuted = false;

  // ==================== الاشتراك بالأحداث ====================

  subscribe(listener: AgoraEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AgoraRtcEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch {
        // مستمع معطوب لا يوقف البقية
      }
    });
  }

  // ==================== التهيئة الكسولة ====================

  /**
   * إنشاء/تهيئة المحرك مرة واحدة — appId يصل من رد التوكن (لا hardcoded).
   * الاستيراد الديناميكي هنا حصرياً.
   */
  async ensureEngine(appId: string): Promise<IRtcEngine> {
    if (this.engine && this.initializedAppId) return this.engine;

    if (!this.module) {
      this.module = await import('react-native-agora');
    }
    const m = this.module;
    const engine = m.createAgoraRtcEngine();
    engine.initialize({
      appId,
      channelProfile: m.ChannelProfileType.ChannelProfileLiveBroadcasting,
    });

    // iOS: منع تعطيل جلسة الصوت عند الخروج — أصوات expo-av (مؤثرات الغرف)
    // كانت تتصارع مع فئة الجلسة؛ نقيّد تصرف SDK بجلسة الصوت قدر الإمكان
    if (Platform.OS === 'ios') {
      try {
        engine.setAudioSessionOperationRestriction(
          m.AudioSessionOperationRestriction
            .AudioSessionOperationRestrictionDeactivateSession,
        );
      } catch {
        // API غير متاح على هذه النسخة — نتجاهل
      }
    }

    this.handler = this.buildEventHandler(m);
    engine.registerEventHandler(this.handler);

    this.engine = engine;
    this.initializedAppId = appId;
    this.installIdleAudioRelease();
    return engine;
  }

  /**
   * يحرّر محرّك Agora عند دخول التطبيق للخلفية بينما لا يوجد اتصال بقناة.
   * كان المحرّك يبقى ماسكاً لجلسة صوت الهاتف طوال عمر التطبيق (release لم يُستدعَ
   * أبداً في الإنتاج) — فيمنع تطبيقات أخرى (واتساب) من الصوت ويستنزف البطارية
   * ويسخّن الجهاز كأن مكالمة قائمة. أثناء غرفة/مكالمة نشطة (currentChannel مضبوط
   * أو انضمام جارٍ) لا نحرّر — keep-alive يتكفّل بإبقاء الغرفة في الخلفية. يُعاد
   * إنشاء المحرّك تلقائياً عند أول انضمام لاحق.
   */
  private installIdleAudioRelease(): void {
    if (this.appStateSub) return;
    const onChange = (next: AppStateStatus): void => {
      const backgrounded =
        next === 'background' || (Platform.OS === 'ios' && next === 'inactive');
      if (backgrounded) {
        if (this.idleReleaseTimer) clearTimeout(this.idleReleaseTimer);
        this.idleReleaseTimer = setTimeout(() => {
          this.idleReleaseTimer = null;
          if (this.engine && !this.currentChannel && !this.joinWaiter) {
            this.release();
          }
        }, IDLE_AUDIO_RELEASE_DELAY_MS);
      } else if (next === 'active' && this.idleReleaseTimer) {
        clearTimeout(this.idleReleaseTimer);
        this.idleReleaseTimer = null;
      }
    };
    this.appStateSub = AppState.addEventListener('change', onChange);
  }

  /** هل الحدث يخص الجلسة الحالية؟ (فلترة الأجيال + القناة) */
  private isCurrent(connection?: RtcConnection): boolean {
    if (!this.sessionActive) return false;
    if (this.sessionGeneration !== this.joinGeneration) return false;
    if (
      connection?.channelId &&
      this.currentChannel &&
      connection.channelId !== this.currentChannel
    ) {
      return false;
    }
    return true;
  }

  // ==================== ترجمة الهوية ====================

  private rememberAccount(uid: number, account: string): void {
    if (!uid || !account) return;
    this.uidToAccount.set(uid, account);
    this.accountToUid.set(account, uid);
  }

  /** uid رقمي → userAccount نصي إن عُرف (خريطة ثم getUserInfoByUid كاحتياط) */
  private lookupAccount(uid: number): string | null {
    if (uid === 0 || (this.localUid !== 0 && uid === this.localUid)) {
      return this.localIdentity || null;
    }
    const known = this.uidToAccount.get(uid);
    if (known) return known;
    try {
      const info = this.engine?.getUserInfoByUid(uid);
      if (info?.userAccount) {
        this.rememberAccount(uid, info.userAccount);
        return info.userAccount;
      }
    } catch {
      // المعلومة لم تصل بعد — onUserInfoUpdated سيكملها
    }
    return null;
  }

  /** ترجمة إلزامية قبل الخروج من الطبقة — احتياط أخير: النص الرقمي */
  private translateUid(uid: number): string {
    return this.lookupAccount(uid) ?? String(uid);
  }

  private clearPendingAnnounce(uid?: number): void {
    if (uid !== undefined) {
      const t = this.pendingAnnounce.get(uid);
      if (t) clearTimeout(t);
      this.pendingAnnounce.delete(uid);
      return;
    }
    this.pendingAnnounce.forEach((t) => clearTimeout(t));
    this.pendingAnnounce.clear();
  }

  // ==================== موزّع أحداث Agora → أحداث محايدة ====================

  private buildEventHandler(m: AgoraModule): IRtcEngineEventHandler {
    return {
      onJoinChannelSuccess: (connection) => {
        if (!this.isCurrent(connection)) return;
        this.localUid = connection.localUid ?? 0;
        if (this.localUid && this.localIdentity) {
          this.rememberAccount(this.localUid, this.localIdentity);
        }
        // تقارير مستوى الصوت — إلزامية لمؤشر المتحدثين في الشاشات
        try {
          this.engine?.enableAudioVolumeIndication(
            VOLUME_INDICATION_INTERVAL_MS,
            3,
            true,
          );
        } catch {
          // ignore
        }
        const waiter = this.joinWaiter;
        if (waiter && waiter.gen === this.joinGeneration) {
          this.joinWaiter = null;
          waiter.resolve();
        }
        this.emit({ type: 'connected' });
      },

      onRejoinChannelSuccess: (connection) => {
        if (!this.isCurrent(connection)) return;
        this.emit({ type: 'reconnected' });
      },

      onConnectionStateChanged: (connection, state, _reason) => {
        if (!this.isCurrent(connection)) return;
        if (state === m.ConnectionStateType.ConnectionStateReconnecting) {
          this.emit({ type: 'reconnecting' });
        } else if (
          state === m.ConnectionStateType.ConnectionStateFailed ||
          state === m.ConnectionStateType.ConnectionStateDisconnected
        ) {
          this.emit({ type: 'disconnected' });
        }
      },

      onError: (err, msg) => {
        // أخطاء توكن قاتلة أثناء الانضمام — نرفض وعد join فوراً بدل انتظار المهلة
        const waiter = this.joinWaiter;
        if (!waiter || waiter.gen !== this.joinGeneration) return;
        if (
          err === m.ErrorCodeType.ErrInvalidToken ||
          err === m.ErrorCodeType.ErrTokenExpired ||
          err === m.ErrorCodeType.ErrJoinChannelRejected
        ) {
          this.joinWaiter = null;
          waiter.reject(new Error(`Agora join error ${err}: ${msg ?? ''}`));
        }
      },

      onUserInfoUpdated: (uid, info) => {
        if (!this.sessionActive) return;
        const account = info?.userAccount;
        if (!account) return;
        this.rememberAccount(uid, account);
        // مشارك أُجّل الإعلان عنه بانتظار حسابه النصي — أعلنه الآن
        if (this.pendingAnnounce.has(uid)) {
          this.clearPendingAnnounce(uid);
          this.emit({ type: 'participantJoined', identity: account });
          return;
        }
        // أُعلن سابقاً بهوية رقمية احتياطية — إعادة مصالحة: نُخرج الهوية
        // الرقمية ثم نُدخل النصية (وإلا ظهر مقعد شبح بهوية لا تطابق uid)
        if (this.numericFallbackAnnounced.has(uid)) {
          this.numericFallbackAnnounced.delete(uid);
          this.emit({ type: 'participantLeft', identity: String(uid) });
          this.emit({ type: 'participantJoined', identity: account });
        }
      },

      onUserJoined: (connection, remoteUid) => {
        if (!this.isCurrent(connection)) return;
        const account = this.lookupAccount(remoteUid);
        if (account) {
          this.emit({ type: 'participantJoined', identity: account });
          return;
        }
        // userAccount لم يصل بعد — ننتظر onUserInfoUpdated قليلاً ثم نعلن باحتياط رقمي
        const gen = this.joinGeneration;
        this.clearPendingAnnounce(remoteUid);
        this.pendingAnnounce.set(
          remoteUid,
          setTimeout(() => {
            this.pendingAnnounce.delete(remoteUid);
            if (gen !== this.joinGeneration || !this.sessionActive) return;
            const resolved = this.lookupAccount(remoteUid);
            // ما زال بلا حساب نصي — نعلمه للمصالحة عند وصوله (onUserInfoUpdated)
            if (!resolved) this.numericFallbackAnnounced.add(remoteUid);
            this.emit({
              type: 'participantJoined',
              identity: resolved ?? String(remoteUid),
            });
          }, PENDING_ANNOUNCE_TIMEOUT_MS),
        );
      },

      onUserOffline: (connection, remoteUid) => {
        if (!this.isCurrent(connection)) return;
        this.clearPendingAnnounce(remoteUid);
        // أُعلن رقمياً ولم يُصالَح — الخروج يكون بالهوية الرقمية نفسها المعلنة
        const wasNumericFallback = this.numericFallbackAnnounced.delete(remoteUid);
        this.emit({
          type: 'participantLeft',
          identity: wasNumericFallback
            ? String(remoteUid)
            : this.translateUid(remoteUid),
        });
      },

      onUserMuteAudio: (connection, remoteUid, muted) => {
        if (!this.isCurrent(connection)) return;
        this.emit({
          type: 'trackMuted',
          identity: this.translateUid(remoteUid),
          muted,
        });
      },

      onAudioVolumeIndication: (connection, speakers) => {
        if (!this.isCurrent(connection)) return;
        const mapped: AgoraSpeakerInfo[] = [];
        for (const s of speakers ?? []) {
          const uid = s.uid ?? 0;
          // إلزامي: تطبيع 0..255 → 0..1 (عتبة العميل 0.045 تفترض 0..1)
          const level = clamp01((s.volume ?? 0) / 255);
          mapped.push({ identity: this.translateUid(uid), level });
        }
        this.emit({ type: 'speaking', speakers: mapped });
      },

      onTokenPrivilegeWillExpire: (connection) => {
        if (!this.isCurrent(connection)) return;
        this.emit({ type: 'tokenWillExpire' });
      },

      onRequestToken: (connection) => {
        if (!this.isCurrent(connection)) return;
        this.emit({ type: 'tokenRequired' });
      },

      onRemoteVideoStateChanged: (connection, remoteUid, state) => {
        if (!this.isCurrent(connection)) return;
        // Frozen = تجمّد مؤقت لا إيقاف — لا حدث كي لا يختفي عرض الفيديو ويعود
        if (state === m.RemoteVideoState.RemoteVideoStateFrozen) return;
        const enabled =
          state === m.RemoteVideoState.RemoteVideoStateStarting ||
          state === m.RemoteVideoState.RemoteVideoStateDecoding;
        this.emit({
          type: 'remoteVideo',
          identity: this.translateUid(remoteUid),
          enabled,
        });
      },

      onNetworkQuality: (connection, remoteUid, txQuality, rxQuality) => {
        if (!this.isCurrent(connection)) return;
        // تقرير المستخدم المحلي فقط (uid=0) — يكفي لقرار خفض دقة التشفير
        if (remoteUid !== 0) return;
        this.emit({
          type: 'networkQuality',
          tx: txQuality as number,
          rx: rxQuality as number,
        });
      },

      onProxyConnected: (channel, _uid, proxyType) => {
        if (!this.sessionActive) return;
        if (this.currentChannel && channel && channel !== this.currentChannel) return;
        this.emit({ type: 'proxyConnected', proxyType: proxyType as number });
      },

      onAudioRoutingChanged: (routing) => {
        this.emit({ type: 'audioRouteChanged', route: routing });
      },

      onAudioMixingStateChanged: (state, reason) => {
        // خلط الموسيقى محلي على جهاز الـDJ — لا connection في الحدث؛
        // حارس الجلسة يكفي (لا خلط خارج جلسة حية)
        if (!this.sessionActive) return;
        const semantic: AgoraMixingSemantic =
          state === m.AudioMixingStateType.AudioMixingStatePlaying
            ? 'playing'
            : state === m.AudioMixingStateType.AudioMixingStatePaused
              ? 'paused'
              : state === m.AudioMixingStateType.AudioMixingStateFailed
                ? 'failed'
                : 'stopped';
        if (semantic === 'stopped' || semantic === 'failed') {
          // انتهى الخلط (طبيعياً/بالإيقاف/بفشل فتح) — تعود سياسة الكتم العادية
          this.mixingActive = false;
          this.applyMicState();
        }
        this.emit({
          type: 'audioMixingStateChanged',
          state: state as number,
          reason: reason as number,
          semantic,
          allLoopsCompleted:
            reason === m.AudioMixingReasonType.AudioMixingReasonAllLoopsCompleted,
          canNotOpen: reason === m.AudioMixingReasonType.AudioMixingReasonCanNotOpen,
        });
      },
    };
  }

  // ==================== خلط الموسيقى (جهاز الـDJ فقط) ====================

  /**
   * بدء خلط ملف موسيقي داخل فريمات المايك المنشورة — كل الغرفة تسمعه من
   * ستريم الـDJ متزامناً حكماً. يقبل مساراً محلياً (file:///…) أو https.
   * loopback:false = يُنشر للجميع؛ cycle:1 = مرة واحدة (الانتقال للتالية
   * يقوده حدث stopped/AllLoopsCompleted).
   */
  startAudioMixing(
    filePathOrHttpsUrl: string,
    opts?: { loopback?: boolean; cycle?: number; startPosMs?: number },
  ): boolean {
    if (!this.engine) return false;
    const path = normalizeMixingFilePath(filePathOrHttpsUrl);
    try {
      const code = this.engine.startAudioMixing(
        path,
        opts?.loopback ?? false,
        opts?.cycle ?? 1,
        Math.max(0, Math.round(opts?.startPosMs ?? 0)),
      );
      if (code !== 0) return false;
    } catch {
      return false;
    }
    this.mixingActive = true;
    this.applyMicState();
    return true;
  }

  /** إيقاف الخلط نهائياً — يعيد سياسة الكتم العادية فوراً */
  stopAudioMixing(): void {
    try {
      this.engine?.stopAudioMixing();
    } catch {
      // ignore
    }
    this.mixingActive = false;
    this.applyMicState();
  }

  /** إيقاف مؤقت — الخلط يبقى «نشطاً» (النشر حي، الكتم يبقى بإشارة التسجيل) */
  pauseAudioMixing(): void {
    try {
      this.engine?.pauseAudioMixing();
    } catch {
      // ignore
    }
  }

  resumeAudioMixing(): void {
    try {
      this.engine?.resumeAudioMixing();
    } catch {
      // ignore
    }
  }

  /** القفز لموضع في المقطع الحالي (مللي ثانية) */
  setAudioMixingPosition(ms: number): void {
    try {
      this.engine?.setAudioMixingPosition(Math.max(0, Math.round(ms)));
    } catch {
      // ignore
    }
  }

  /** موضع التشغيل الحالي بالمللي ثانية — سالب عند الفشل/لا خلط */
  getAudioMixingCurrentPosition(): number {
    try {
      return this.engine?.getAudioMixingCurrentPosition() ?? -1;
    } catch {
      return -1;
    }
  }

  /** مدة المقطع بالمللي ثانية — سالب عند الفشل/لا خلط */
  getAudioMixingDuration(): number {
    try {
      return this.engine?.getAudioMixingDuration() ?? -1;
    } catch {
      return -1;
    }
  }

  /**
   * ما يسمعه الآخرون من الموسيقى (0-100) — مستقل تماماً عن مايك الكلام
   * (إشارة التسجيل) وعن سماع الـDJ نفسه (playout).
   */
  adjustAudioMixingPublishVolume(volume: number): void {
    try {
      this.engine?.adjustAudioMixingPublishVolume(clampVolume100(volume));
    } catch {
      // ignore
    }
  }

  /** سماع الـDJ نفسه للموسيقى محلياً (0-100) — لا يؤثر على الجمهور */
  adjustAudioMixingPlayoutVolume(volume: number): void {
    try {
      this.engine?.adjustAudioMixingPlayoutVolume(clampVolume100(volume));
    } catch {
      // ignore
    }
  }

  /**
   * مستوى إشارة التسجيل (المايك) 0-100 — تصفيرها يكتم كلام الـDJ مع
   * استمرار الموسيقى المخلوطة. يُفضَّل setMicMuted (يدير الحالتين معاً).
   */
  adjustRecordingSignalVolume(volume: number): void {
    try {
      this.engine?.adjustRecordingSignalVolume(clampVolume100(volume));
    } catch {
      // ignore
    }
  }

  /**
   * مستوى سماع مستخدم بعيد بعينه محلياً (0-100) — خافض «صوت الـDJ» عند
   * المستمع: يخفض كلامه وموسيقاه معاً (ستريم واحد).
   */
  adjustUserPlaybackSignalVolume(numericUid: number, volume: number): void {
    if (!numericUid) return;
    try {
      this.engine?.adjustUserPlaybackSignalVolume(numericUid, clampVolume100(volume));
    } catch {
      // ignore
    }
  }

  // ==================== العمليات ====================

  /**
   * الانضمام للقناة بهوية نصية — يحلّ عند onJoinChannelSuccess أو يرفض
   * عند المهلة/خطأ توكن. سلّم النقل (agoraConnect) هو من يدير المحاولات.
   */
  async joinChannel(params: AgoraJoinParams): Promise<void> {
    const engine = await this.ensureEngine(params.appId);
    const m = this.module!;

    // جيل جديد — أي حدث/وعد من جلسة سابقة يُهمل
    const gen = ++this.joinGeneration;
    this.sessionGeneration = gen;
    this.sessionActive = true;
    this.currentChannel = params.channel;
    this.localIdentity = params.identity;
    this.localUid = 0;
    this.uidToAccount.clear();
    this.accountToUid.clear();
    this.clearPendingAnnounce();
    this.numericFallbackAnnounced.clear();

    // وعد join سابق ما زال معلقاً — تجاوزه جيل أحدث
    const stale = this.joinWaiter;
    if (stale) {
      this.joinWaiter = null;
      stale.reject(new Error('تجاوزه انضمام أحدث'));
    }

    const broadcaster = params.role === 'broadcaster';
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.joinWaiter?.gen === gen) {
          this.joinWaiter = null;
          reject(new Error('Agora join timeout'));
        }
      }, params.timeoutMs ?? 10_000);

      this.joinWaiter = {
        gen,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      };

      const code = engine.joinChannelWithUserAccount(
        params.token,
        params.channel,
        params.identity,
        {
          channelProfile: m.ChannelProfileType.ChannelProfileLiveBroadcasting,
          clientRoleType: broadcaster
            ? m.ClientRoleType.ClientRoleBroadcaster
            : m.ClientRoleType.ClientRoleAudience,
          publishMicrophoneTrack: broadcaster,
          autoSubscribeAudio: true,
        },
      );
      if (code !== 0) {
        clearTimeout(timer);
        this.joinWaiter = null;
        reject(new Error(`joinChannelWithUserAccount فشل (${code})`));
      }
    });
  }

  /** مغادرة القناة — ترفع الجيل فتُهمل كل أحداث الجلسة السابقة */
  async leaveChannel(): Promise<void> {
    this.joinGeneration++;
    const wasActive = this.sessionActive;
    this.sessionActive = false;
    // مغادرة القناة توقف الخلط في SDK — أعد علم الحالة حتى لا يعلق كتم المايك
    this.mixingActive = false;
    this.currentChannel = '';
    this.localUid = 0;
    this.clearPendingAnnounce();
    this.numericFallbackAnnounced.clear();
    this.uidToAccount.clear();
    this.accountToUid.clear();

    const waiter = this.joinWaiter;
    if (waiter) {
      this.joinWaiter = null;
      waiter.reject(new Error('غادر قبل اكتمال الانضمام'));
    }

    try {
      this.engine?.leaveChannel();
    } catch {
      // ignore
    }
    if (wasActive) this.emit({ type: 'disconnected' });
  }

  /**
   * تبديل الدور (متحدث/مستمع) على القناة الحالية.
   * v4: الانضمام كمستمع يمرر publishMicrophoneTrack:false، وترقية الدور
   * وحدها لا تنشر مساراً لم يُنشر أصلاً (muteLocalAudioStream/enableLocalAudio
   * لا تبدآن نشراً جديداً) — لذا نحدّث خيارات القناة صراحةً مع كل تبديل؛
   * والنزول لمستمع يوقف نشر المايك من المصدر أيضاً.
   */
  setRole(role: AgoraRole): void {
    const m = this.module;
    if (!this.engine || !m) return;
    const broadcaster = role === 'broadcaster';
    try {
      this.engine.setClientRole(
        broadcaster
          ? m.ClientRoleType.ClientRoleBroadcaster
          : m.ClientRoleType.ClientRoleAudience,
      );
    } catch {
      // ignore
    }
    try {
      this.engine.updateChannelMediaOptions({ publishMicrophoneTrack: broadcaster });
    } catch {
      // ignore
    }
  }

  /** تجديد التوكن دون قطع — يُستدعى من attachTokenRenewal */
  renewToken(token: string): void {
    try {
      this.engine?.renewToken(token);
    } catch {
      // ignore
    }
  }

  /**
   * كتم المايك المحلي — الاثنان معاً (النشر + الالتقاط):
   * بعض الأجهزة (Tecno) تتجاهل واحدة وتُبقي البث حياً (نفس درس LiveKit).
   * أثناء خلط الموسيقى: كتم إشارة التسجيل فقط (الموسيقى تستمر للجمهور).
   */
  setMicMuted(muted: boolean): void {
    this.desiredMicMuted = muted;
    this.applyMicState();
  }

  /** هل المايك مكتوم والموسيقى تُبث؟ — لمؤشر «مايكك مكتوم والموسيقى مستمرة» */
  isMicMutedWhileMixing(): boolean {
    return this.mixingActive && this.desiredMicMuted;
  }

  /** تطبيق حالة المايك الفعلية حسب حالة الخلط — آمن التكرار */
  private applyMicState(): void {
    if (!this.engine) return;
    const muted = this.desiredMicMuted;
    if (this.mixingActive) {
      // الموسيقى تُخلط داخل نفس المسار المنشور — النشر/الالتقاط يبقيان حيَّين
      // وكتم كلام الـDJ يتم بتصفير إشارة التسجيل (المايك) وحدها
      try {
        this.engine.adjustRecordingSignalVolume(muted ? 0 : 100);
      } catch {
        // ignore
      }
      try {
        this.engine.muteLocalAudioStream(false);
      } catch {
        // ignore
      }
      try {
        this.engine.enableLocalAudio(true);
      } catch {
        // ignore
      }
      return;
    }
    // لا خلط — سياسة الكتم القياسية، مع إعادة إشارة التسجيل لوضعها الطبيعي
    try {
      this.engine.adjustRecordingSignalVolume(100);
    } catch {
      // ignore
    }
    try {
      this.engine.muteLocalAudioStream(muted);
    } catch {
      // ignore
    }
    try {
      this.engine.enableLocalAudio(!muted);
    } catch {
      // ignore
    }
  }

  /** كتم سماع كل المسارات البعيدة (كتم صوت الغرفة للمستمع) */
  setAllRemoteMuted(muted: boolean): void {
    try {
      this.engine?.muteAllRemoteAudioStreams(muted);
    } catch {
      // ignore
    }
  }

  /** توجيه الصوت لمكبّر الجهاز (الغرف تفضّله دائماً) */
  setSpeakerphone(on: boolean): void {
    if (!this.engine) return;
    try {
      this.engine.setDefaultAudioRouteToSpeakerphone(on);
    } catch {
      // ignore
    }
    try {
      this.engine.setEnableSpeakerphone(on);
    } catch {
      // ignore
    }
  }

  /**
   * القناة المنضم إليها حالياً ('' إن لا اتصال) — مدير خلط الموسيقى يتحقق
   * منها قبل (إعادة) بدء الخلط: نفس المحرك تستعمله مكالمات 1:1
   * (agoraCallSession)، وأي خلط على قناة مكالمة يسرّب موسيقى الروم
   * داخل مايك المكالمة الخاصة.
   */
  getCurrentChannel(): string {
    return this.sessionActive ? this.currentChannel : '';
  }

  /**
   * uid الرقمي لهوية نصية — للعرض في RtcSurfaceView (canvas يقبل أرقاماً فقط).
   * المحلي دائماً 0 (اصطلاح Agora للعرض المحلي)، والبعيد من خريطة الحسابات؛
   * هوية احتياطية رقمية (انقضت مهلة انتظار حسابها النصي) هي الـuid نفسه نصاً.
   */
  numericUidFor(identity: string): number | null {
    if (!identity) return null;
    if (this.localIdentity && identity === this.localIdentity) return 0;
    const known = this.accountToUid.get(identity);
    if (known !== undefined) return known;
    if (/^\d+$/.test(identity)) return Number(identity);
    return null;
  }

  /**
   * تهيئة الفيديو لمكالمة 1:1 + الاشتراك بفيديو الطرف الآخر — عبر
   * updateChannelMediaOptions على القناة الحالية بلا أي إعادة انضمام.
   */
  enableVideoForCall(): void {
    if (!this.engine) return;
    try {
      this.engine.enableVideo();
    } catch {
      // ignore
    }
    try {
      this.engine.updateChannelMediaOptions({ autoSubscribeVideo: true });
    } catch {
      // ignore
    }
  }

  /**
   * نشر/إيقاف كاميرا المكالمة على القناة الحالية — بلا إعادة انضمام.
   * الثلاثية معاً (الالتقاط + كتم البث + خيار النشر) لنفس درس setMicMuted:
   * بعض الأجهزة تتجاهل أمراً واحداً وتُبقي البث حياً.
   */
  setCameraPublishing(on: boolean): void {
    if (!this.engine) return;
    try {
      this.engine.enableLocalVideo(on);
    } catch {
      // ignore
    }
    try {
      this.engine.muteLocalVideoStream(!on);
    } catch {
      // ignore
    }
    // بدون startPreview قد يبقى العرض المحلي أسود على بعض الأجهزة (نمط v4 القياسي)
    try {
      if (on) this.engine.startPreview();
      else this.engine.stopPreview();
    } catch {
      // ignore
    }
    try {
      this.engine.updateChannelMediaOptions({ publishCameraTrack: on });
    } catch {
      // ignore
    }
  }

  /** دقة تشفير الفيديو — bitrate 0 يترك للـSDK مطابقة معدل البت القياسي للدقة */
  setVideoEncoding(width: number, height: number): void {
    if (!this.engine) return;
    try {
      this.engine.setVideoEncoderConfiguration({
        dimensions: { width, height },
        frameRate: 15,
        bitrate: 0,
      });
    } catch {
      // ignore
    }
  }

  /** تبديل الكاميرا الأمامية/الخلفية أثناء مكالمة فيديو */
  switchCamera(): void {
    try {
      this.engine?.switchCamera();
    } catch {
      // ignore
    }
  }

  /**
   * بروفايل صوت المكالمات 1:1 — الافتراضي (معالجة صوت اتصالات كاملة AEC/ANS).
   * ضروري لأن المحرك مشترك: جلسة غرفة سابقة تترك بروفايل الموسيقى العالي
   * (نظير getCommunicationAudioConfig في مسار LiveKit).
   */
  setAudioProfileForCalls(): void {
    const m = this.module;
    if (!this.engine || !m) return;
    try {
      this.engine.setAudioProfile(
        m.AudioProfileType.AudioProfileDefault,
        m.AudioScenarioType.AudioScenarioDefault,
      );
    } catch {
      // ignore
    }
  }

  /** بروفايل صوت الغرف: جودة موسيقية عالية + سيناريو غرف دردشة (فتح/إغلاق مايك متكرر) */
  setAudioProfileForRooms(): void {
    const m = this.module;
    if (!this.engine || !m) return;
    try {
      this.engine.setAudioProfile(
        m.AudioProfileType.AudioProfileMusicHighQuality,
        m.AudioScenarioType.AudioScenarioChatroom,
      );
    } catch {
      // ignore
    }
  }

  /**
   * ضبط وضع Cloud Proxy — يجب أن يُستدعى قبل joinChannel دائماً.
   * agoraConnect (سلّم النقل) هو المستهلك الوحيد المقصود.
   */
  async setCloudProxy(appId: string, mode: AgoraProxyMode): Promise<void> {
    const engine = await this.ensureEngine(appId);
    const m = this.module!;
    const proxyType =
      mode === 'udp'
        ? m.CloudProxyType.UdpProxy
        : mode === 'tcp'
          ? m.CloudProxyType.TcpProxy
          : m.CloudProxyType.NoneProxy;
    try {
      engine.setCloudProxy(proxyType);
    } catch {
      // ignore — بعض النسخ ترفضها أثناء الاتصال؛ السلّم يستدعيها قبل الانضمام فقط
    }
  }

  /** تحرير المحرك نهائياً — لأدوات المختبر فقط في هذه المرحلة */
  release(): void {
    this.joinGeneration++;
    this.sessionActive = false;
    this.mixingActive = false;
    this.clearPendingAnnounce();
    this.numericFallbackAnnounced.clear();
    this.uidToAccount.clear();
    this.accountToUid.clear();
    const waiter = this.joinWaiter;
    if (waiter) {
      this.joinWaiter = null;
      waiter.reject(new Error('تم تحرير المحرك'));
    }
    if (this.engine) {
      try {
        if (this.handler) this.engine.unregisterEventHandler(this.handler);
      } catch {
        // ignore
      }
      try {
        this.engine.release();
      } catch {
        // ignore
      }
    }
    this.engine = null;
    this.handler = null;
    this.initializedAppId = null;
  }
}

/** المدير الوحيد — كل التطبيق يمر من هنا */
export const agoraEngine = new AgoraEngineManager();
export type { AgoraEngineManager };
