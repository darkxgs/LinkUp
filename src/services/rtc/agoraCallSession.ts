/**
 * جلسة مكالمة 1:1 (صوت/فيديو) عبر Agora — التنفيذ الموازي لمدير LiveKit
 * في callSession، بنفس الواجهة العامة حرفياً (subscribe/getSnapshot/connect/
 * leave/setMuted/toggleMute/toggleVideo/switchCamera/setSpeakerOn/
 * toggleSpeaker/isConnectedTo/forceError/setInsufficientBalanceHandler) —
 * التوجيه بين المديرين في callSession خلف علم سيرفري (rtcProvider).
 *
 * قرارات جوهرية (مع أسبابها):
 * - ملف تعريف القناة: المحرك المشترك مهيأ LiveBroadcasting عالمياً (الغرف
 *   تعتمده)، وطبقة المحرك لا تعرض setChannelProfile لكل جلسة — لذا ينضم
 *   الطرفان بدور broadcaster: مكافئ عملي لبروفايل Communication في مكالمة
 *   1:1 (نشر واستقبال منخفضا الكمون للطرفين) دون العبث بحالة محرك مشترك.
 * - نقطة الفوترة: أول participantJoined للطرف الآخر = مكافئ
 *   ParticipantConnected في LiveKit بالضبط → markAnswered + بدء الفوترة
 *   (الدقيقة 0 مقدماً ثم كل 60 ثانية مع تخطي إعادة الاتصال).
 * - الفيديو: تشغيل/إيقاف الكاميرا عبر updateChannelMediaOptions على القناة
 *   نفسها بلا إعادة انضمام. الترميز يبدأ 960×540@15 وينزل مرة واحدة إلى
 *   640×360 عند تدهور جودة الرفع (onNetworkQuality ≥ Bad) — نزول بلا صعود
 *   كي لا تتأرجح الجودة على الشبكات المتذبذبة.
 * - snapshot الفيديو: بدل كائنات VideoTrack نضع مرجعَي AgoraCallVideoRef
 *   في نفس الحقلين القديمين (localVideoTrack/remoteVideoTrack) — الشاشات
 *   تفحص الحقل بالصحة المنطقية وتمرره لـ CallVideoView كما هو، فتصمد بلا
 *   تعديل؛ وحقلا {localVideoOn, remoteVideoUid} الصريحان متاحان أيضاً.
 * - المحرك يتصل بقناة واحدة (بخلاف LiveKit الذي يتحمّل اتصالين): روم Agora
 *   مثبّت يُفصل قبل الانضمام لقناة المكالمة ويُعاد وصله بعد انتهائها.
 */
import {
  endCall as endCallFn,
  chargeCallMinute,
} from '@/services/firebase/rtc';
import { translateCallableError } from '@/services/firebase/authReady';
import { requestCallPermissions } from '@/services/permissions';
import { auth } from '@/services/firebase';

import { agoraEngine, type AgoraRtcEvent } from './agoraEngine';
import { joinWithTransportLadder } from './agoraConnect';
import { getAgoraTokenCached, attachTokenRenewal } from './agoraToken';
import type { CallState, CallSessionSnapshot } from '@/services/callSession';

type Listener = () => void;

/** مرجع عرض فيديو Agora — يسكن حقلي localVideoTrack/remoteVideoTrack في الـsnapshot */
export interface AgoraCallVideoRef {
  provider: 'agora';
  /** uid الرقمي للعرض في RtcSurfaceView (المحلي دائماً 0) */
  uid: number;
  local: boolean;
}

/** دقة الترميز الابتدائية ثم البديلة عند ضعف الشبكة */
const VIDEO_PRIMARY = { width: 960, height: 540 } as const;
const VIDEO_FALLBACK = { width: 640, height: 360 } as const;
/** عتبة تدهور الرفع بمقياس QualityType (4 = Bad فأسوأ) */
const NETWORK_QUALITY_BAD = 4;
// قيم أعلى من Down (7=Unsupported، 8=Detecting) ليست تدهوراً حقيقياً —
// تقارير الاستكشاف المبكرة كانت تفعّل النزول الدائم للدقة على شبكات سليمة
const NETWORK_QUALITY_DOWN = 6;
/**
 * حارس إعادة الخصم: إعادة تشغيل الفوترة داخل الدقيقة نفسها (مغادرة/عودة
 * الطرف الآخر أو مصالحة هوية رقمية) لا تخصم «الدقيقة 0» مرة ثانية.
 */
const RECHARGE_GUARD_MS = 55_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** رعشة شبكة لحظية أثناء جلب التوكن — تستحق إعادة محاولة واحدة */
function isTransientNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return (
    msg.includes('Network request failed') ||
    msg.includes('network error') ||
    msg.includes('timeout')
  );
}

class AgoraCallSessionManager {
  private channelName = '';
  private isVideo = false;
  private peerUid?: string;
  private billingSessionId?: string;
  private callSource: 'chat' | 'match' = 'chat';
  private callState: CallState = 'idle';
  private isMuted = false;
  private isRemoteMuted = false;
  private isVideoEnabled = false;
  /** مكالمة صوت: سماعة الأذن افتراضياً — فيديو: سبيكر (نفس المرجع) */
  private isSpeakerOn = false;
  private remoteJoined = false;
  private isReconnecting = false;
  /** هوية الطرف الآخر النصية كما أعلنها المحرك (مكالمة 1:1 = بعيد واحد) */
  private remoteIdentity: string | null = null;
  /** الطرف الآخر ينشر فيديو (من onRemoteVideoStateChanged) */
  private remoteVideoOn = false;
  /** كتم/فيديو وصلا قبل إعلان صاحبهما (مهلة إعلان المحرك) — يُطبَّقان عند انضمامه */
  private pendingRemoteMuted: boolean | null = null;
  private pendingRemoteVideo: boolean | null = null;
  /** مرجعا عرض الفيديو — ثابتان بين الإصدارات ما لم تتغير الحالة (لا يعاد
   *  إنشاؤهما مع نبضة المدة كل ثانية كي لا يُعاد ضبط RtcSurfaceView) */
  private localVideoRef: AgoraCallVideoRef | undefined;
  private remoteVideoRef: AgoraCallVideoRef | undefined;
  private error: string | null = null;
  private startTime = 0;
  private joined = false;
  private billingTimer: ReturnType<typeof setInterval> | null = null;
  private billingActive = false;
  /** آخر خصم دقيقة ناجح — يغذي حارس إعادة الخصم */
  private lastMinuteChargeAt = 0;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private duration = 0;
  private listeners = new Set<Listener>();
  private insufficientBalanceHandler: (() => void) | null = null;
  private snapshotCache: CallSessionSnapshot = this.buildSnapshot();
  private connectGeneration = 0;
  private connectPromise: Promise<void> | null = null;
  private micMutedPreference: boolean | null = null;
  private localIdentity = '';
  /** هل قامت جلسة فعلاً؟ يميّز disconnected حقيقي عن فشل درجات سلّم النقل */
  private sessionEstablished = false;
  /** إعادة انضمام بتوكن جديد جارية — تكتم حدث disconnected العابر */
  private rejoinInFlight = false;
  private engineUnsub: (() => void) | null = null;
  private renewalDetach: (() => void) | null = null;
  /** نزلنا للدقة البديلة (بلا صعود) — يُصفَّر مع كل مكالمة جديدة */
  private videoDowngraded = false;
  /** روم Agora فُصل لأجل المكالمة (قناة واحدة للمحرك) — يُعاد وصله بعدها */
  private suspendedRoom: { roomName: string; canPublish: boolean } | null = null;

  private isConnectStale(generation: number): boolean {
    return generation !== this.connectGeneration;
  }

  setInsufficientBalanceHandler(fn: (() => void) | null) {
    this.insufficientBalanceHandler = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): CallSessionSnapshot {
    return this.snapshotCache;
  }

  forceError(message: string) {
    this.connectGeneration += 1;
    this.joined = false;
    this.error = message;
    this.callState = 'error';
    this.emit();
  }

  private buildSnapshot(): CallSessionSnapshot {
    return {
      callState: this.callState,
      isMuted: this.isMuted,
      isRemoteMuted: this.isRemoteMuted,
      isVideoEnabled: this.isVideoEnabled,
      isSpeakerOn: this.isSpeakerOn,
      remoteJoined: this.remoteJoined,
      localVideoTrack: this.localVideoRef,
      remoteVideoTrack: this.remoteVideoRef,
      localVideoOn: this.isVideoEnabled,
      remoteVideoUid: this.remoteVideoRef?.uid ?? null,
      error: this.error,
      channelName: this.channelName,
      isVideo: this.isVideo,
      duration: this.duration,
      isReconnecting: this.isReconnecting,
    };
  }

  private emit() {
    this.snapshotCache = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  /** مزامنة مرجع الفيديو المحلي مع حالة الكاميرا — مرجع ثابت ما دامت شغالة */
  private syncLocalVideoRef(): void {
    if (this.isVideoEnabled) {
      if (!this.localVideoRef) {
        this.localVideoRef = { provider: 'agora', uid: 0, local: true };
      }
    } else {
      this.localVideoRef = undefined;
    }
  }

  /** مزامنة مرجع الفيديو البعيد — يتطلب طرفاً منضماً وفيديو منشوراً وuid معروفاً */
  private syncRemoteVideoRef(): void {
    if (this.remoteJoined && this.remoteVideoOn && this.remoteIdentity) {
      const uid = agoraEngine.numericUidFor(this.remoteIdentity);
      if (uid !== null && uid !== 0) {
        if (!this.remoteVideoRef || this.remoteVideoRef.uid !== uid) {
          this.remoteVideoRef = { provider: 'agora', uid, local: false };
        }
        return;
      }
    }
    this.remoteVideoRef = undefined;
  }

  private markAnswered() {
    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.startDurationTimer();
    }
  }

  private startDurationTimer() {
    if (this.durationTimer) return;
    this.durationTimer = setInterval(() => {
      if (this.startTime > 0) {
        this.duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.emit();
      }
    }, 1000);
  }

  private stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  private stopBilling() {
    this.billingActive = false;
    if (this.billingTimer) {
      clearInterval(this.billingTimer);
      this.billingTimer = null;
    }
  }

  /** منطق الفوترة منقول بأمانة من مرجع LiveKit + حارس إعادة الخصم */
  private startBillingIfNeeded() {
    if (!this.billingSessionId || !this.remoteJoined || this.billingActive) return;
    this.billingActive = true;

    const runCharge = async () => {
      // أثناء إعادة الاتصال الصوت منقطع — نتخطّى شحن هذه الدقيقة ونستأنف عند العودة
      if (this.isReconnecting) return;
      try {
        const res = await chargeCallMinute(this.billingSessionId!);
        this.lastMinuteChargeAt = Date.now();
        if (res.billed === false) {
          this.stopBilling();
          return;
        }
        if (!res.ok && (res.reason === 'insufficient' || res.reason === 'ended')) {
          this.stopBilling();
          if (res.reason === 'insufficient') {
            this.error = 'انتهى رصيدك — تم إنهاء المكالمة';
            this.emit();
            this.insufficientBalanceHandler?.();
            void this.leave();
          }
        }
      } catch {
        // retry next cycle
      }
    };

    // الدقيقة 0 مقدماً — إلا إذا أعيد تشغيل الفوترة داخل الدقيقة المخصومة
    // نفسها (السيرفر يخصم مع كل نداء بلا تدقيق زمني) فلا تُخصم مرتين
    if (
      this.lastMinuteChargeAt === 0 ||
      Date.now() - this.lastMinuteChargeAt >= RECHARGE_GUARD_MS
    ) {
      void runCharge();
    }
    this.billingTimer = setInterval(runCharge, 60000);
  }

  isConnectedTo(channelName: string): boolean {
    return (
      this.joined &&
      this.channelName === channelName &&
      this.callState === 'connected'
    );
  }

  // ==================== أحداث المحرك ====================

  private attachEngineEvents(gen: number): void {
    this.engineUnsub?.();
    this.engineUnsub = agoraEngine.subscribe((event) => {
      if (gen !== this.connectGeneration) return;
      this.handleEngineEvent(event);
    });
  }

  private detachEngine(): void {
    this.engineUnsub?.();
    this.engineUnsub = null;
    this.renewalDetach?.();
    this.renewalDetach = null;
  }

  private handleEngineEvent(event: AgoraRtcEvent): void {
    switch (event.type) {
      case 'connected':
        // الانضمام الأولي يقوده وعد join — هنا ترقية حالة فقط إن لزم
        if (this.joined && this.callState === 'connecting') {
          this.callState = 'connected';
          this.emit();
        }
        break;

      case 'reconnecting':
        if (!this.sessionEstablished) break;
        // رعشة شبكة: SDK يعيد المحاولة تلقائياً — لا نُنهي المكالمة، فقط نُظهر الحالة
        this.isReconnecting = true;
        this.emit();
        break;

      case 'reconnected':
        if (!this.sessionEstablished) break;
        this.isReconnecting = false;
        // إعادة تطبيق حالة الوسائط بعد عودة الشبكة (نظير reapplyMediaStateAfterReconnect)
        agoraEngine.setMicMuted(this.isMuted);
        agoraEngine.setSpeakerphone(this.isSpeakerOn);
        if (this.isVideoEnabled) agoraEngine.setCameraPublishing(true);
        if (this.remoteJoined) this.startBillingIfNeeded();
        this.emit();
        break;

      case 'disconnected':
        // فشل درجة من سلّم النقل يمر من هنا أيضاً — نتجاهله ما لم تقم جلسة،
        // وكذلك القطع العابر أثناء إعادة الانضمام بتوكن جديد
        if (!this.sessionEstablished || this.rejoinInFlight) break;
        if (!this.joined && this.callState === 'connecting') break;
        // يصل هنا فقط بعد أن يستنفد SDK محاولات إعادة الاتصال (انقطاع نهائي)
        if (this.callState !== 'ended') this.callState = 'ended';
        this.isReconnecting = false;
        this.remoteJoined = false;
        this.remoteIdentity = null;
        this.remoteVideoOn = false;
        this.remoteVideoRef = undefined;
        // إيقاف مؤقّتي الفوترة والمدّة حتى لا تستمر الجلسة اليتيمة بالخصم
        this.stopBilling();
        this.stopDurationTimer();
        this.emit();
        break;

      case 'participantJoined': {
        if (!event.identity || event.identity === this.localIdentity) break;
        // مكالمة 1:1 — طرف بعيد واحد؛ هوية إضافية مع طرف قائم تُهمل
        if (this.remoteJoined && this.remoteIdentity && event.identity !== this.remoteIdentity) break;
        this.remoteIdentity = event.identity;
        this.remoteJoined = true;
        // كتم/فيديو وصلا قبل إعلان صاحبهما (مهلة المحرك) — يُطبَّقان الآن
        if (this.pendingRemoteMuted !== null) {
          this.isRemoteMuted = this.pendingRemoteMuted;
          this.pendingRemoteMuted = null;
        }
        if (this.pendingRemoteVideo !== null) {
          this.remoteVideoOn = this.pendingRemoteVideo;
          this.pendingRemoteVideo = null;
        }
        this.syncRemoteVideoRef();
        // نقطة الفوترة: أول انضمام للطرف الآخر = ParticipantConnected في LiveKit
        this.markAnswered();
        this.startBillingIfNeeded();
        this.emit();
        break;
      }

      case 'participantLeft':
        if (!this.remoteIdentity || event.identity !== this.remoteIdentity) break;
        this.remoteJoined = false;
        this.remoteIdentity = null;
        this.remoteVideoOn = false;
        this.remoteVideoRef = undefined;
        this.isRemoteMuted = false;
        // باغ الخصم اليتيم: الطرف الآخر غادر — إيقاف الفوترة فوراً حتى لا
        // يستمر خصم الدقائق والمتصل وحده في القناة (نفس إصلاح مسار LiveKit)
        this.stopBilling();
        this.emit();
        break;

      case 'trackMuted': {
        if (event.identity === this.localIdentity) break;
        if (!this.remoteJoined) {
          this.pendingRemoteMuted = event.muted;
          break;
        }
        if (this.remoteIdentity && event.identity !== this.remoteIdentity) break;
        if (this.isRemoteMuted === event.muted) break;
        this.isRemoteMuted = event.muted;
        this.emit();
        break;
      }

      case 'remoteVideo': {
        if (event.identity === this.localIdentity) break;
        if (!this.remoteJoined) {
          this.pendingRemoteVideo = event.enabled;
          break;
        }
        if (this.remoteIdentity && event.identity !== this.remoteIdentity) break;
        if (this.remoteVideoOn === event.enabled) break;
        this.remoteVideoOn = event.enabled;
        this.syncRemoteVideoRef();
        this.emit();
        break;
      }

      case 'networkQuality':
        // قرار الدقة: نزول لمرة واحدة إلى 640×360 عند تدهور الرفع — بلا
        // صعود مجدداً كي لا تتأرجح الجودة على الشبكات المتذبذبة
        if (
          !this.videoDowngraded &&
          this.isVideoEnabled &&
          event.tx >= NETWORK_QUALITY_BAD &&
          event.tx <= NETWORK_QUALITY_DOWN
        ) {
          this.videoDowngraded = true;
          agoraEngine.setVideoEncoding(VIDEO_FALLBACK.width, VIDEO_FALLBACK.height);
        }
        break;

      default:
        // tokenWillExpire/tokenRequired يعالجهما attachTokenRenewal
        break;
    }
  }

  // ==================== الكاميرا ====================

  /**
   * تشغيل الكاميرا بأمان — فشلها (إذن مرفوض/جهاز ضعيف) يجب ألا يُسقط
   * المكالمة: تستمر صوتاً فقط (نفس عقد enableCameraSafely المرجعي).
   */
  private async enableCameraSafely(): Promise<boolean> {
    try {
      const granted = await requestCallPermissions('both');
      if (!granted) return false;
      agoraEngine.enableVideoForCall();
      const dims = this.videoDowngraded ? VIDEO_FALLBACK : VIDEO_PRIMARY;
      agoraEngine.setVideoEncoding(dims.width, dims.height);
      agoraEngine.setCameraPublishing(true);
      return true;
    } catch (e) {
      console.warn('agoraCallSession camera enable failed — continuing audio-only:', e);
      return false;
    }
  }

  // ==================== الاتصال ====================

  async connect(opts: {
    channelName: string;
    isVideo: boolean;
    peerUid?: string;
    billingSessionId?: string;
    callSource?: 'chat' | 'match';
  }): Promise<void> {
    const { channelName, isVideo, peerUid, billingSessionId, callSource = 'chat' } = opts;
    if (!channelName) return;

    let generation = ++this.connectGeneration;

    if (this.isConnectedTo(channelName) && this.isVideo === isVideo) {
      this.peerUid = peerUid;
      this.billingSessionId = billingSessionId;
      this.callSource = callSource;
      if (this.remoteJoined) this.startBillingIfNeeded();
      return;
    }

    // ترقية صوت → فيديو على نفس القناة — بلا إعادة انضمام إطلاقاً
    // (updateChannelMediaOptions تكفي؛ نظير ترقية LiveKit دون قطع)
    if (this.joined && this.channelName === channelName && !this.isVideo && isVideo) {
      this.peerUid = peerUid;
      this.billingSessionId = billingSessionId;
      this.callSource = callSource;
      this.isVideo = true;
      this.isSpeakerOn = true;
      agoraEngine.setSpeakerphone(true);
      // فشل الكاميرا لا يقلب المكالمة لحالة خطأ — تستمر صوتاً فقط
      this.isVideoEnabled = await this.enableCameraSafely();
      this.syncLocalVideoRef();
      this.emit();
      return;
    }

    if (this.joined) {
      // أظهر «جارٍ الاتصال» فوراً قبل تفكيك الجلسة القديمة (نفس درس المرجع)
      this.callState = 'connecting';
      this.error = null;
      this.duration = 0;
      this.emit();
      await this.leave(false);
      // leave() يرفع الجيل ليُلغي أي connect قديم — أعد المطالبة بالجيل هنا
      if (this.connectGeneration !== generation + 1) return; // سبَقَنا connect/leave أحدث
      generation = ++this.connectGeneration;
    }

    this.channelName = channelName;
    this.isVideo = isVideo;
    this.peerUid = peerUid;
    this.billingSessionId = billingSessionId;
    this.callSource = callSource;
    this.isVideoEnabled = false; // تُفعَّل بعد نجاح الانضمام (فشلها لا يمنع الصوت)
    this.isSpeakerOn = isVideo;
    this.remoteJoined = false;
    this.remoteIdentity = null;
    this.remoteVideoOn = false;
    this.pendingRemoteMuted = null;
    this.pendingRemoteVideo = null;
    this.localVideoRef = undefined;
    this.remoteVideoRef = undefined;
    this.videoDowngraded = false;
    this.lastMinuteChargeAt = 0;

    const runConnect = async (): Promise<void> => {
      try {
        this.callState = 'connecting';
        this.error = null;
        this.duration = 0;
        this.emit();

        // تعليق صوت الروم المثبّت أثناء المكالمة — ومحرك Agora يتصل بقناة
        // واحدة فقط: روم Agora متصل يُفصل بالكامل ويُعاد وصله بعد المكالمة
        try {
          const { roomAudioSession } = await import('@/services/roomAudioSession');
          roomAudioSession.suspendForCall();
          const roomSnap = roomAudioSession.getSnapshot();
          if (
            roomSnap.roomName &&
            (roomSnap.connectionState === 'connected' ||
              roomSnap.connectionState === 'connecting')
          ) {
            this.suspendedRoom = {
              roomName: roomSnap.roomName,
              canPublish: roomSnap.canPublish,
            };
            await roomAudioSession.disconnect().catch(() => {});
          }
        } catch { /* ignore */ }

        if (this.isConnectStale(generation)) return;

        const permType = isVideo ? 'both' : 'audio';
        // «Network request failed» أثناء جلب التوكن = رعشة شبكة لحظية —
        // أعد المحاولة مرة بدل الفشل الفوري بخطأ على شاشة المتصل
        const fetchTokenWithRetry = async () => {
          try {
            return await getAgoraTokenCached(channelName, true, peerUid);
          } catch (tokenErr) {
            if (!isTransientNetworkError(tokenErr)) throw tokenErr;
            await sleep(1500);
            if (this.isConnectStale(generation)) throw tokenErr;
            return getAgoraTokenCached(channelName, true, peerUid, { forceFresh: true });
          }
        };
        const [tokenResult, granted] = await Promise.all([
          fetchTokenWithRetry(),
          requestCallPermissions(permType),
        ]);

        if (this.isConnectStale(generation)) return;

        if (!granted) {
          this.error = isVideo ? 'يجب السماح بالميكروفون والكاميرا' : 'يجب السماح بالميكروفون';
          this.callState = 'error';
          this.emit();
          return;
        }

        this.localIdentity = tokenResult.identity;

        // الاشتراك بأحداث المحرك قبل الانضمام — لا يفوتنا رد الطرف الآخر المبكر
        this.attachEngineEvents(generation);

        await agoraEngine.ensureEngine(tokenResult.appId);
        if (this.isConnectStale(generation)) return;
        // بروفايل صوت الاتصالات — يمسح بروفايل الموسيقى إن سبقت جلسة غرفة
        agoraEngine.setAudioProfileForCalls();

        // سلّم النقل: مباشر → UDP proxy → TCP proxy — المكالمات أول ضحايا
        // حجب الشبكات (نفس درس relay fallback في LiveKit).
        // الطرفان broadcaster: المكافئ العملي لـ Communication (انظر رأس الملف)
        await joinWithTransportLadder({
          appId: tokenResult.appId,
          token: tokenResult.token,
          channel: channelName,
          identity: tokenResult.identity,
          role: 'broadcaster',
        });
        if (this.isConnectStale(generation)) {
          await agoraEngine.leaveChannel().catch(() => {});
          return;
        }

        this.sessionEstablished = true;

        // تجديد التوكن تلقائياً + إعادة انضمام كاملة عند انتهائه الفعلي
        this.attachRenewal(generation);

        // مسار الصوت: سبيكر للفيديو وسماعة الأذن للصوت — سماعات الرأس
        // والبلوتوث أولويتها أعلى داخل SDK فلا تتأثر
        agoraEngine.setSpeakerphone(this.isSpeakerOn);

        const muted = this.micMutedPreference ?? false;
        this.isMuted = muted;
        this.micMutedPreference = null;
        agoraEngine.setMicMuted(muted);

        if (isVideo) {
          // فشل الكاميرا (إذن/جهاز) لا يُسقط المكالمة — تستمر صوتاً
          this.isVideoEnabled = await this.enableCameraSafely();
          this.syncLocalVideoRef();
        }

        if (this.isConnectStale(generation)) return;

        this.joined = true;
        this.callState = 'connected';
        this.emit();
      } catch (e: unknown) {
        if (this.isConnectStale(generation)) return;
        this.joined = false;
        this.error = e instanceof Error ? e.message : translateCallableError(e);
        this.callState = 'error';
        this.emit();
      }
    };

    this.connectPromise = runConnect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  /** ربط تجديد التوكن — tokenRequired يعني إعادة انضمام كاملة بتوكن جديد */
  private attachRenewal(gen: number): void {
    this.renewalDetach?.();
    this.renewalDetach = attachTokenRenewal(agoraEngine, {
      roomName: this.channelName,
      canPublish: true,
      peerUid: this.peerUid,
      onTokenRequired: () => {
        if (gen !== this.connectGeneration) return;
        void this.rejoinWithFreshToken(gen);
      },
    });
  }

  /** التوكن انتهى فعلاً — التجديد لا يكفي: مغادرة ثم انضمام كامل بتوكن جديد */
  private async rejoinWithFreshToken(gen: number): Promise<void> {
    if (this.rejoinInFlight) return;
    this.rejoinInFlight = true;
    try {
      const channel = this.channelName;
      if (!channel) return;
      const fresh = await getAgoraTokenCached(channel, true, this.peerUid, {
        forceFresh: true,
      });
      if (gen !== this.connectGeneration || this.channelName !== channel) return;
      this.isReconnecting = true;
      this.emit();
      await agoraEngine.leaveChannel().catch(() => {});
      if (gen !== this.connectGeneration) return;
      // إعادة الانضمام تعيد إعلان الطرف الآخر — نصفّر حضوره ليعيد
      // participantJoined بناءه (حارس إعادة الخصم يمنع خصم دقيقة مزدوجة)
      this.remoteJoined = false;
      this.remoteIdentity = null;
      this.remoteVideoOn = false;
      this.remoteVideoRef = undefined;
      this.stopBilling();
      await joinWithTransportLadder({
        appId: fresh.appId,
        token: fresh.token,
        channel,
        identity: fresh.identity,
        role: 'broadcaster',
      });
      if (gen !== this.connectGeneration) return;
      agoraEngine.setSpeakerphone(this.isSpeakerOn);
      agoraEngine.setMicMuted(this.isMuted);
      if (this.isVideoEnabled) {
        agoraEngine.enableVideoForCall();
        const dims = this.videoDowngraded ? VIDEO_FALLBACK : VIDEO_PRIMARY;
        agoraEngine.setVideoEncoding(dims.width, dims.height);
        agoraEngine.setCameraPublishing(true);
      }
      this.isReconnecting = false;
      this.callState = 'connected';
      this.error = null;
      this.emit();
    } catch {
      if (gen !== this.connectGeneration) return;
      this.isReconnecting = false;
      this.error = 'انقطع الاتصال — أعد المحاولة';
      this.callState = 'error';
      this.stopBilling();
      this.stopDurationTimer();
      this.emit();
    } finally {
      this.rejoinInFlight = false;
    }
  }

  // ==================== المغادرة ====================

  async leave(reportEnd = true): Promise<void> {
    this.connectGeneration += 1;
    this.joined = false;
    this.stopBilling();
    this.stopDurationTimer();
    this.detachEngine();

    // المحرك مشترك مع الغرف: لا نلمس القناة إلا إن كانت جلسةُ المكالمة هذه
    // من قامت بها — leave() عابر (تنظيف شاشة/جلسة لم تنضم) كان سيقطع قناة
    // روم Agora مثبّت يملكها غيرنا
    if (this.sessionEstablished) {
      // كتم وإيقاف الكاميرا قبل المغادرة — لا تسريب مايك/فيديو أثناء التفكيك
      agoraEngine.setMicMuted(true);
      if (this.isVideoEnabled) agoraEngine.setCameraPublishing(false);
      await agoraEngine.leaveChannel().catch(() => {});
    }
    this.sessionEstablished = false;

    const duration = this.startTime
      ? Math.floor((Date.now() - this.startTime) / 1000)
      : 0;
    const channel = this.channelName;
    const billingSessionId = this.billingSessionId;
    const peerUid = this.peerUid;
    const isVideo = this.isVideo;
    const callSource = this.callSource;
    const remoteJoined = this.remoteJoined;

    this.callState = 'ended';
    this.remoteJoined = false;
    this.remoteIdentity = null;
    this.remoteVideoOn = false;
    this.pendingRemoteMuted = null;
    this.pendingRemoteVideo = null;
    this.isRemoteMuted = false;
    this.isVideoEnabled = false;
    this.isReconnecting = false;
    this.localVideoRef = undefined;
    this.remoteVideoRef = undefined;
    this.startTime = 0;
    this.duration = 0;
    this.channelName = '';
    this.micMutedPreference = null;
    this.lastMinuteChargeAt = 0;
    this.emit();

    // استعادة صوت الروم المثبّت بعد انتهاء المكالمة — وإن كان روم Agora
    // قد فُصل لأجل قناة المكالمة يُعاد وصله أولاً
    try {
      const { roomAudioSession } = await import('@/services/roomAudioSession');
      const suspended = this.suspendedRoom;
      this.suspendedRoom = null;
      if (suspended) {
        void roomAudioSession
          .connect(suspended.roomName, suspended.canPublish)
          .catch(() => {});
      }
      roomAudioSession.resumeAfterCall();
    } catch { /* ignore */ }

    if (reportEnd && duration > 0 && channel) {
      try {
        await endCallFn(channel, duration, billingSessionId);
      } catch {
        // ignore
      }
      if (peerUid) {
        void import('@/services/firebase/hostTasks').then(async (m) => {
          const { getUser } = await import('@/services/firebase/users');
          const partner = await getUser(peerUid);
          const partnerParticipant = m.agencyParticipantFromUserDoc(
            partner as Record<string, unknown> | null,
          );
          if (!m.shouldCountPartnerForHostTasks(partnerParticipant)) return;

          if (callSource === 'match') {
            if (isVideo) await m.trackHostVideoCompetition(1);
            else await m.trackHostVoiceCompetition(1);
          } else if (billingSessionId) {
            await m.trackHostCallEnded(peerUid, isVideo ? 'video' : 'voice', duration);
          }
          await m.markHostInteraction();
        }).catch(() => {});
      }
    }

    if (
      reportEnd &&
      callSource === 'chat' &&
      billingSessionId &&
      peerUid &&
      channel &&
      auth.currentUser?.uid
    ) {
      const status = remoteJoined ? 'completed' : 'missed';
      void import('@/services/firebase/chatCallLogs').then((m) =>
        m.logChatCallMessage({
          callerUid: auth.currentUser!.uid,
          calleeUid: peerUid,
          channelName: channel,
          callType: isVideo ? 'video' : 'voice',
          status,
          durationSeconds: duration,
        }),
      ).catch(() => {});
    }
  }

  // ==================== الأزرار ====================

  async setMuted(muted: boolean): Promise<boolean> {
    this.micMutedPreference = muted;
    if (this.connectPromise) {
      await Promise.race([this.connectPromise.catch(() => {}), sleep(8000)]);
    }
    if (!this.joined) {
      this.isMuted = muted;
      this.emit();
      return true;
    }
    // أمر محرك واحد يغطي النشر والالتقاط معاً — آمن التكرار
    agoraEngine.setMicMuted(muted);
    this.isMuted = muted;
    this.micMutedPreference = null;
    this.emit();
    return true;
  }

  async toggleMute(): Promise<boolean> {
    return this.setMuted(!this.isMuted);
  }

  async toggleVideo(): Promise<void> {
    if (!this.joined) return;
    const next = !this.isVideoEnabled;
    if (next) {
      // تشغيل الكاميرا محمي — فشلها لا يرمي استثناءً غير معالج من زر الفيديو
      const ok = await this.enableCameraSafely();
      this.isVideoEnabled = ok;
      if (ok) this.isVideo = true;
    } else {
      agoraEngine.setCameraPublishing(false);
      this.isVideoEnabled = false;
      this.isVideo = false;
    }
    this.syncLocalVideoRef();
    this.emit();
  }

  async switchCamera(): Promise<void> {
    if (!this.joined || !this.isVideoEnabled) return;
    agoraEngine.switchCamera();
  }

  async setSpeakerOn(speakerOn: boolean): Promise<boolean> {
    agoraEngine.setSpeakerphone(speakerOn);
    this.isSpeakerOn = speakerOn;
    this.emit();
    return true;
  }

  async toggleSpeaker(): Promise<boolean> {
    return this.setSpeakerOn(!this.isSpeakerOn);
  }
}

/** جلسة مكالمات Agora — التوجيه إليها في callSession حصرياً */
export const agoraCallSession = new AgoraCallSessionManager();
export type { AgoraCallSessionManager };
