/**
 * جلسة مكالمة 1-to-1 — تبقى متصلة عند تصغير الشاشة
 *
 * الملف الآن موزّع مزوّدين (نفس نمط roomAudioSession):
 * - CallSessionManager: مدير LiveKit الأصلي — المسار الحي الافتراضي كما هو.
 * - agoraCallSession (rtc/agoraCallSession): المدير الموازي عبر Agora.
 * - CallSessionRouter (آخر الملف): يوجّه بينهما خلف علم rtcProvider السيرفري.
 *
 * (الغرف الصوتية many-to-many تبقى على roomAudioSession.ts منفصل.)
 */
import { Platform } from 'react-native';
import {
  getLiveKitToken,
  endCall as endCallFn,
  chargeCallMinute,
} from '@/services/firebase/rtc';
import { translateCallableError } from '@/services/firebase/authReady';
import { requestCallPermissions } from '@/services/permissions';
import { ensureLiveKitGlobals } from '@/services/livekitNative';
import {
  connectLiveKitWithRelayFallback,
  isTransientSignalError,
} from '@/services/livekitConnect';
import {
  applyBestAudioOutput,
  getCommunicationAudioConfig,
  startAudioRouteWatcher,
  stopAudioRouteWatcher,
} from '@/services/livekitAudioRouting';
import { auth } from '@/services/firebase';
import { resolveRtcProvider, type RtcProvider } from '@/services/rtc/rtcProvider';
import { agoraCallSession, type AgoraCallVideoRef } from '@/services/rtc/agoraCallSession';

export type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

type Listener = () => void;
type LkRoom = import('livekit-client').Room;
type VideoTrack = import('livekit-client').VideoTrack;
type RemoteParticipant = import('livekit-client').RemoteParticipant;

/**
 * حقلا الفيديو في الـsnapshot يقبلان مساري المزوّدين:
 * كائن VideoTrack من LiveKit أو مرجع AgoraCallVideoRef — الشاشات تفحصهما
 * بالصحة المنطقية وتمررهما لـ CallVideoView الذي يميّز بينهما بنفسه.
 */
export type CallVideoTrackLike = VideoTrack | AgoraCallVideoRef;

export interface CallSessionSnapshot {
  callState: CallState;
  isMuted: boolean;
  isRemoteMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  remoteJoined: boolean;
  localVideoTrack: CallVideoTrackLike | undefined;
  remoteVideoTrack: CallVideoTrackLike | undefined;
  /** حقلا Agora الصريحان — على مسار LiveKit: localVideoOn يعكس الكاميرا وremoteVideoUid يبقى null */
  localVideoOn: boolean;
  remoteVideoUid: number | null;
  error: string | null;
  channelName: string;
  isVideo: boolean;
  duration: number;
  /** المكالمة تحاول إعادة الاتصال بعد رعشة شبكة (SDK يعيد المحاولة تلقائياً) */
  isReconnecting: boolean;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEngineNotReadyError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return msg.includes('engine not connected') || msg.includes('not connected within timeout');
}

async function waitForRoomConnected(
  room: LkRoom,
  ConnectionState: typeof import('livekit-client').ConnectionState,
  RoomEvent: typeof import('livekit-client').RoomEvent,
  timeoutMs = 12_000,
): Promise<void> {
  if (room.state === ConnectionState.Connected) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      room.off(RoomEvent.Connected, onConnected);
      reject(new Error('LiveKit connection timeout'));
    }, timeoutMs);
    const onConnected = () => {
      clearTimeout(timeout);
      resolve();
    };
    room.once(RoomEvent.Connected, onConnected);
  });
}

async function enableMicrophoneWithRetry(
  room: LkRoom,
  enabled: boolean,
  attempts = 3,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < attempts && isEngineNotReadyError(e)) {
        await sleep(400 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

let lkModule: typeof import('livekit-client') | null = null;

async function loadLiveKitModules() {
  if (!lkModule) {
    lkModule = await import('livekit-client');
  }
  const nativeAudio = await ensureLiveKitGlobals();
  return { lk: lkModule, nativeAudio };
}

function pickRemoteParticipant(room: LkRoom): RemoteParticipant | undefined {
  const remotes = [...room.remoteParticipants.values()];
  return remotes[0];
}

function extractVideoTrack(pub: any): VideoTrack | undefined {
  if (!pub) return undefined;
  return pub.videoTrack ?? pub.track ?? undefined;
}

function readVideoTracks(
  room: LkRoom,
  lk: typeof import('livekit-client'),
): {
  localVideoTrack: VideoTrack | undefined;
  remoteVideoTrack: VideoTrack | undefined;
  remoteJoined: boolean;
  isRemoteMuted: boolean;
} {
  const { Track } = lk;
  const localPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const localVideoTrack = extractVideoTrack(localPub);

  const remote = pickRemoteParticipant(room);
  const remoteJoined = !!remote;
  const isRemoteMuted = remote ? !remote.isMicrophoneEnabled : false;
  const remotePub = remote?.getTrackPublication(Track.Source.Camera);
  const remoteVideoTrack = extractVideoTrack(remotePub);

  return { localVideoTrack, remoteVideoTrack, remoteJoined, isRemoteMuted };
}

class CallSessionManager {
  private room: LkRoom | null = null;
  private channelName = '';
  private isVideo = false;
  private peerUid?: string;
  private billingSessionId?: string;
  private callSource: 'chat' | 'match' = 'chat';
  private callState: CallState = 'idle';
  private isMuted = false;
  private isRemoteMuted = false;
  private isVideoEnabled = false;
  /** مكالمة صوت: سماعة الأذن افتراضياً — فيديو: سبيكر */
  private isSpeakerOn = false;
  private remoteJoined = false;
  private isReconnecting = false;
  private localVideoTrack: VideoTrack | undefined;
  private remoteVideoTrack: VideoTrack | undefined;
  private error: string | null = null;
  private startTime = 0;
  private joined = false;
  private billingTimer: ReturnType<typeof setInterval> | null = null;
  private billingActive = false;
  /** آخر خصم دقيقة ناجح — يغذي حارس إعادة الخصم عند إعادة تشغيل الفوترة */
  private lastMinuteChargeAt = 0;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private duration = 0;
  private listeners = new Set<Listener>();
  private insufficientBalanceHandler: (() => void) | null = null;
  private snapshotCache: CallSessionSnapshot = this.buildSnapshot();
  private connectGeneration = 0;
  private connectPromise: Promise<void> | null = null;
  private micMutedPreference: boolean | null = null;
  private stopRouteWatcher: (() => void) | null = null;
  private lk: typeof import('livekit-client') | null = null;
  private cameraFacing: 'user' | 'environment' = 'user';

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
      localVideoTrack: this.localVideoTrack,
      remoteVideoTrack: this.remoteVideoTrack,
      localVideoOn: this.isVideoEnabled,
      remoteVideoUid: null,
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

  private refreshFromRoom() {
    const room = this.room;
    if (!room || !this.lk) return;
    const tracks = readVideoTracks(room, this.lk);
    this.localVideoTrack = tracks.localVideoTrack;
    this.remoteVideoTrack = tracks.remoteVideoTrack;
    this.remoteJoined = tracks.remoteJoined;
    this.isRemoteMuted = tracks.isRemoteMuted;
    this.isMuted = !room.localParticipant.isMicrophoneEnabled;
  }

  private async reapplyMediaStateAfterReconnect(): Promise<void> {
    const room = this.room;
    if (!room) return;
    try {
      await enableMicrophoneWithRetry(room, !this.isMuted);
    } catch (e) {
      console.warn('callSession reconnect mic:', e);
    }
    try {
      const AudioSession = await ensureLiveKitGlobals();
      // إعادة الاتصال ليست نية مستخدم — لا فرض للسبيكر فوق سماعة موصولة
      await applyBestAudioOutput(AudioSession, this.isSpeakerOn, false);
    } catch (e) {
      console.warn('callSession reconnect speaker:', e);
    }
    this.refreshFromRoom();
  }

  /**
   * تشغيل الكاميرا بأمان — فشل الكاميرا (أجهزة ضعيفة/كاميرا محجوزة) يجب ألا
   * يُسقط المكالمة أو التطبيق. محاولة أولى 540p ثم محاولة أخيرة 360p،
   * وعند الفشل تستمر المكالمة صوتاً فقط.
   */
  private async enableCameraSafely(room: LkRoom): Promise<boolean> {
    const lk = this.lk;
    try {
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: this.cameraFacing,
        ...(lk?.VideoPresets?.h540 ? { resolution: lk.VideoPresets.h540.resolution } : {}),
      });
      return true;
    } catch (e) {
      console.warn('callSession camera 540p failed — retrying lower resolution:', e);
    }
    try {
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: this.cameraFacing,
        ...(lk?.VideoPresets?.h360 ? { resolution: lk.VideoPresets.h360.resolution } : {}),
      });
      return true;
    } catch (e) {
      console.warn('callSession camera enable failed — continuing audio-only:', e);
      return false;
    }
  }

  private async waitForConnectedRoom(timeoutMs = 8000): Promise<LkRoom | null> {
    if (this.room && this.lk && this.room.state === this.lk.ConnectionState.Connected) {
      return this.room;
    }
    if (this.connectPromise) {
      await Promise.race([this.connectPromise.catch(() => {}), sleep(timeoutMs)]);
    }
    const room = this.room;
    const lk = this.lk;
    if (!room || !lk) return null;
    if (room.state === lk.ConnectionState.Connected) return room;
    try {
      await waitForRoomConnected(room, lk.ConnectionState, lk.RoomEvent, timeoutMs);
      return room;
    } catch {
      return null;
    }
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
    // نفسها (مغادرة/عودة الطرف الآخر بعد إصلاح الخصم اليتيم — السيرفر يخصم
    // مع كل نداء بلا تدقيق زمني) فلا تُخصم الدقيقة مرتين
    if (this.lastMinuteChargeAt === 0 || Date.now() - this.lastMinuteChargeAt >= 55_000) {
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

    // ترقية صوت → فيديو على نفس القناة دون قطع LiveKit (كان يُعيد الاتصال ويُفقد الفيديو)
    if (
      this.joined &&
      this.room &&
      this.channelName === channelName &&
      !this.isVideo &&
      isVideo
    ) {
      this.peerUid = peerUid;
      this.billingSessionId = billingSessionId;
      this.callSource = callSource;
      this.isVideo = true;
      try {
        const { nativeAudio: AudioSession } = await loadLiveKitModules();
        this.isSpeakerOn = true;
        await AudioSession.configureAudio(getCommunicationAudioConfig('video', true));
        await applyBestAudioOutput(AudioSession, true);
        // فشل الكاميرا لا يقلب المكالمة لحالة خطأ — تستمر صوتاً فقط
        this.isVideoEnabled = await this.enableCameraSafely(this.room);
        if (this.room) {
          await enableMicrophoneWithRetry(this.room, !this.isMuted);
        }
        this.refreshFromRoom();
        this.emit();
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : translateCallableError(e);
        this.callState = 'error';
        this.emit();
      }
      return;
    }

    if (this.joined) {
      // أظهر «جارٍ الاتصال» فوراً قبل تفكيك الجلسة القديمة — leave() تستغرق ثوانيَ
      // (disconnect + إيقاف جلسة الصوت) وكانت تعرض «انتهت المكالمة» طوالها على
      // شاشة الرد على المكالمة الجديدة.
      this.callState = 'connecting';
      this.error = null;
      this.duration = 0;
      this.emit();
      await this.leave(false);
      // leave() يرفع جيل الاتصال ليُلغي أي connect قديم — أعد المطالبة بالجيل هنا
      // وإلا اعتُبر هذا الاتصال نفسه لاغياً وظهرت «انتهت المكالمة» فور الرد على
      // مكالمة جديدة بينما جلسة سابقة ما زالت منضمّة (بلا أي صوت إطلاقاً).
      if (this.connectGeneration !== generation + 1) return; // سبَقَنا connect/leave أحدث
      generation = ++this.connectGeneration;
    }

    this.channelName = channelName;
    this.isVideo = isVideo;
    this.peerUid = peerUid;
    this.billingSessionId = billingSessionId;
    this.callSource = callSource;
    this.isVideoEnabled = isVideo;
    this.isSpeakerOn = isVideo;
    this.remoteJoined = false;
    this.localVideoTrack = undefined;
    this.remoteVideoTrack = undefined;
    this.cameraFacing = 'user';
    this.lastMinuteChargeAt = 0;

    const runConnect = async (): Promise<void> => {
    try {
      this.callState = 'connecting';
      this.error = null;
      this.duration = 0;
      this.emit();

      // تعليق صوت الروم المثبّت أثناء المكالمة — كان يختلط صوت الغرفة بالمكالمة
      try {
        const { roomAudioSession } = await import('@/services/roomAudioSession');
        roomAudioSession.suspendForCall();
      } catch { /* ignore */ }

      const permType = isVideo ? 'both' : 'audio';
      // «Network request failed» أثناء جلب التوكن = رعشة شبكة لحظية —
      // أعد المحاولة مرة بدل الفشل الفوري بخطأ على شاشة المتصل
      const fetchTokenWithRetry = async () => {
        try {
          return await getLiveKitToken(channelName, true, peerUid);
        } catch (tokenErr) {
          if (!isTransientSignalError(tokenErr)) throw tokenErr;
          await sleep(1500);
          if (this.isConnectStale(generation)) throw tokenErr;
          return getLiveKitToken(channelName, true, peerUid);
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

      const { lk, nativeAudio: AudioSession } = await loadLiveKitModules();
      this.lk = lk;
      if (this.isConnectStale(generation)) return;

      const { Room, RoomEvent, ConnectionState, Track } = lk;

      const audioMode = isVideo ? 'video' : 'voice';
      await AudioSession.configureAudio(
        getCommunicationAudioConfig(audioMode, this.isSpeakerOn),
      );
      await AudioSession.startAudioSession();
      // بدون فرض السبيكر عند البدء: مع سماعة/إيربودز يذهب الصوت لها تلقائياً،
      // وبدونها defaultOutput في الإعداد يوجّه للسبيكر. الفرض فقط بزر السبيكر.
      await applyBestAudioOutput(AudioSession, this.isSpeakerOn, false);
      this.stopRouteWatcher?.();
      this.stopRouteWatcher = startAudioRouteWatcher({
        getPreferSpeaker: () => this.isSpeakerOn,
        // توصيل/فصل سماعة أثناء المكالمة يجب ألا يعيد فرض السبيكر فوقها
        getForceSpeaker: () => false,
        onApply: async (preferSpeaker, forceSpeaker) => {
          const session = await ensureLiveKitGlobals();
          await applyBestAudioOutput(session, preferSpeaker, forceSpeaker);
        },
      });
      try {
        await (AudioSession as any).setDefaultRemoteAudioTrackVolume?.(1.0);
      } catch {
        // ignore
      }

      const { token, wsUrl } = tokenResult;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // فيديو 540p بدل الافتراضي 720p — التقاط/ترميز 720p يعلّق الأجهزة الضعيفة
        // حتى خروج التطبيق. 540p كافية لمكالمة 1-to-1 وأخف بكثير على المعالج.
        ...(lk.VideoPresets?.h540
          ? {
              videoCaptureDefaults: {
                facingMode: this.cameraFacing,
                resolution: lk.VideoPresets.h540.resolution,
              },
            }
          : {}),
        publishDefaults: {
          dtx: false,
          red: true,
          ...(lk.AudioPresets?.speech ? { audioPreset: lk.AudioPresets.speech } : {}),
          ...(lk.VideoPresets?.h540 ? { videoEncoding: lk.VideoPresets.h540.encoding } : {}),
          ...(lk.VideoPresets?.h180 ? { videoSimulcastLayers: [lk.VideoPresets.h180] } : {}),
        },
      });
      this.room = room;

      const refresh = () => {
        this.refreshFromRoom();
        this.emit();
      };

      const onRemotePresent = () => {
        if (this.room !== room) return;
        this.refreshFromRoom();
        if (this.remoteJoined) {
          this.markAnswered();
          this.startBillingIfNeeded();
        }
        this.emit();
      };

      room
        .on(RoomEvent.Connected, () => {
          if (this.room !== room) return;
          this.callState = 'connected';
          refresh();
        })
        .on(RoomEvent.Reconnecting, () => {
          if (this.room !== room) return;
          // رعشة شبكة: SDK يعيد المحاولة تلقائياً — لا نُنهي المكالمة، فقط نُظهر الحالة
          this.isReconnecting = true;
          this.emit();
        })
        .on(RoomEvent.Reconnected, () => {
          if (this.room !== room) return;
          this.isReconnecting = false;
          void this.reapplyMediaStateAfterReconnect().then(() => {
            if (this.remoteJoined) this.startBillingIfNeeded();
            this.emit();
          });
        })
        .on(RoomEvent.Disconnected, () => {
          // غرفة قديمة بعد إعادة إنشاء الجلسة — لا تُنهِ المكالمة الجديدة
          if (this.room !== room) return;
          // قطع مقصود بين محاولات direct→relay أثناء التأسيس — ليس نهاية مكالمة:
          // كان يقلب الحالة إلى «انتهت المكالمة» لحظياً رغم أن المحاولة التالية تنجح
          if (!this.joined && this.callState === 'connecting') return;
          // يصل هنا فقط بعد أن يستنفد SDK محاولات إعادة الاتصال (انقطاع نهائي)
          if (this.callState !== 'ended') {
            this.callState = 'ended';
          }
          this.isReconnecting = false;
          this.remoteJoined = false;
          this.localVideoTrack = undefined;
          this.remoteVideoTrack = undefined;
          // إيقاف مؤقّت الفوترة والمدّة حتى لا تستمر الجلسة اليتيمة بالشحن بعد الانتهاء
          this.stopBilling();
          this.stopDurationTimer();
          this.emit();
        })
        .on(RoomEvent.ParticipantConnected, onRemotePresent)
        .on(RoomEvent.ParticipantDisconnected, () => {
          if (this.room !== room) return;
          this.remoteJoined = false;
          this.remoteVideoTrack = undefined;
          this.isRemoteMuted = false;
          // باغ الخصم اليتيم: مغادرة الطرف الآخر كانت تُبقي مؤقّت الفوترة
          // حياً فيستمر خصم الدقائق والمتصل وحده في القناة — إيقاف فوري
          // (عودته تعيد التشغيل عبر onRemotePresent، وحارس إعادة الخصم
          // يمنع خصم الدقيقة نفسها مرتين)
          this.stopBilling();
          this.emit();
        })
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.LocalTrackPublished, (pub: any) => {
          if (pub?.source === Track.Source.Camera || pub?.kind === 'video') {
            this.isVideoEnabled = true;
          }
          refresh();
        })
        .on(RoomEvent.TrackSubscribed, (track, pub) => {
          if (pub.kind === 'audio') {
            try {
              (track as { setVolume?: (v: number) => void }).setVolume?.(1.0);
            } catch {
              // ignore
            }
          }
          refresh();
        })
        .on(RoomEvent.TrackUnpublished, refresh);

      // #17: اتصال مع بديل ترحيل TURN/TLS:443 تلقائي — شبكات جوال تحجب UDP
      try {
        await connectLiveKitWithRelayFallback(room, wsUrl, token, (r) =>
          waitForRoomConnected(r, ConnectionState, RoomEvent),
        );
      } catch (connErr) {
        if (this.isConnectStale(generation)) return;
        // فشل قناة الإشارة (انقطاع لحظي/توكن منتهٍ) قابل للإنقاذ — توكن جديد
        // وإعادة اتصال مرة واحدة بدل إنهاء المكالمة فوراً بـ«انتهت المكالمة»
        if (!isTransientSignalError(connErr)) throw connErr;
        try {
          await withTimeout(room.disconnect(), 3000);
        } catch {
          // ignore
        }
        await sleep(1500);
        if (this.isConnectStale(generation)) return;
        const freshToken = await getLiveKitToken(channelName, true, peerUid);
        if (this.isConnectStale(generation)) return;
        await connectLiveKitWithRelayFallback(
          room,
          freshToken.wsUrl || wsUrl,
          freshToken.token,
          (r) => waitForRoomConnected(r, ConnectionState, RoomEvent),
        );
      }
      if (this.isConnectStale(generation)) {
        await withTimeout(room.disconnect(), 3000);
        return;
      }

      const muted = this.micMutedPreference ?? false;
      this.isMuted = muted;
      await enableMicrophoneWithRetry(room, !muted);
      this.micMutedPreference = null;

      if (!muted && Platform.OS === 'android') {
        const gen = this.connectGeneration;
        setTimeout(() => {
          if (this.connectGeneration !== gen || !this.room || this.isMuted) return;
          enableMicrophoneWithRetry(this.room, true, 2).catch(() => {});
        }, 600);
      }

      if (isVideo) {
        // فشل الكاميرا (جهاز ضعيف/كاميرا محجوزة) لا يُسقط المكالمة — تستمر صوتاً
        this.isVideoEnabled = await this.enableCameraSafely(room);
        this.refreshFromRoom();
        this.emit();
        setTimeout(() => {
          this.refreshFromRoom();
          this.emit();
        }, 300);
        setTimeout(() => {
          this.refreshFromRoom();
          this.emit();
        }, 800);
      } else {
        this.isVideoEnabled = false;
      }

      if (room.state === ConnectionState.Connected) {
        this.callState = 'connected';
      }

      this.joined = true;
      refresh();
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

  async leave(reportEnd = true): Promise<void> {
    this.connectGeneration += 1;
    this.joined = false;
    this.stopBilling();
    this.stopDurationTimer();

    const room = this.room;
    if (room) {
      try {
        await withTimeout(room.disconnect(), 3000);
      } catch {
        // ignore
      }
      this.room = null;
    }

    try {
      const AudioSession = await ensureLiveKitGlobals();
      await withTimeout(AudioSession.stopAudioSession(), 2000);
    } catch {
      // ignore
    }
    this.stopRouteWatcher?.();
    this.stopRouteWatcher = null;
    stopAudioRouteWatcher();

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
    this.localVideoTrack = undefined;
    this.remoteVideoTrack = undefined;
    this.startTime = 0;
    this.duration = 0;
    this.channelName = '';
    this.micMutedPreference = null;
    this.lastMinuteChargeAt = 0;
    this.emit();

    // استعادة صوت الروم المثبّت بعد انتهاء المكالمة
    try {
      const { roomAudioSession } = await import('@/services/roomAudioSession');
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

  async setMuted(muted: boolean): Promise<boolean> {
    this.micMutedPreference = muted;
    const room = await this.waitForConnectedRoom();
    if (!room) {
      this.isMuted = muted;
      this.emit();
      return true;
    }
    if (this.isMuted === muted && room.localParticipant.isMicrophoneEnabled === !muted) {
      return true;
    }
    try {
      await enableMicrophoneWithRetry(room, !muted);
      this.isMuted = muted;
      this.micMutedPreference = null;
      this.refreshFromRoom();
      this.emit();
      return true;
    } catch (e) {
      console.warn('callSession setMuted:', e);
      return false;
    }
  }

  async toggleMute(): Promise<boolean> {
    return this.setMuted(!this.isMuted);
  }

  async toggleVideo(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const next = !this.isVideoEnabled;
    if (next) {
      // تشغيل الكاميرا محمي — فشلها لا يرمي استثناءً غير معالج من زر الفيديو
      const ok = await this.enableCameraSafely(room);
      this.isVideoEnabled = ok;
      if (ok) this.isVideo = true;
    } else {
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch (e) {
        console.warn('callSession toggleVideo off:', e);
      }
      this.isVideoEnabled = false;
      this.isVideo = false;
    }
    this.refreshFromRoom();
    this.emit();
  }

  async switchCamera(): Promise<void> {
    const room = this.room;
    if (!room || !this.isVideoEnabled) return;
    this.cameraFacing = this.cameraFacing === 'user' ? 'environment' : 'user';
    try {
      await room.localParticipant.setCameraEnabled(true, { facingMode: this.cameraFacing });
      this.refreshFromRoom();
      this.emit();
    } catch {
      // ignore
    }
  }

  async setSpeakerOn(speakerOn: boolean): Promise<boolean> {
    try {
      const AudioSession = await ensureLiveKitGlobals();
      // أعد ضبط الجلسة حسب التفضيل الجديد (iOS: defaultOutput سبيكر/سماعة أذن)
      // ثم طبّق: الفرض فقط عند تشغيل السبيكر صراحةً — هذه نية مستخدم واضحة.
      const mode = this.isVideo ? 'video' : 'voice';
      try {
        await AudioSession.configureAudio(getCommunicationAudioConfig(mode, speakerOn));
      } catch {
        // بعض المنصات لا تسمح بإعادة الضبط أثناء الجلسة — نكتفي بالتوجيه
      }
      await applyBestAudioOutput(AudioSession, speakerOn, speakerOn);
      this.isSpeakerOn = speakerOn;
      this.emit();
      return true;
    } catch (e) {
      console.warn('callSession setSpeakerOn:', e);
      return false;
    }
  }

  async toggleSpeaker(): Promise<boolean> {
    return this.setSpeakerOn(!this.isSpeakerOn);
  }
}

/** مدير LiveKit الأصلي — يبقى المسار الحي الافتراضي كما هو */
const livekitCallSession = new CallSessionManager();

type CallManager = CallSessionManager | typeof agoraCallSession;

/**
 * موزّع المزوّد (LiveKit/Agora) — نفس نمط RoomAudioSessionRouter.
 *
 * القاعدة: activeProvider يتحدد عند أول connect لمكالمة (بدءاً أو رداً —
 * كلاهما يمر من connect) عبر resolveRtcProvider ويثبت طوال جلسة التطبيق،
 * فلا يتقاذف المكالمةَ مديران مختلفان في المنتصف. وجلسة واحدة نشطة فقط:
 * لو طُلب connect والمدير الآخر ما يزال منضماً (بقايا حالة) يُفصل أولاً.
 *
 * useCall وشاشات المكالمة والفقاعة العائمة لا تتغير: نفس الأسماء العامة
 * ونفس شكل CallSessionSnapshot.
 */
class CallSessionRouter {
  /** المزوّد المثبّت — null قبل أول connect (يوجَّه لـ LiveKit مؤقتاً) */
  private activeProvider: RtcProvider | null = null;
  private listeners = new Set<Listener>();
  /** حسم جارٍ — يمنع سباق تثبيتين متوازيين */
  private pinPromise: Promise<RtcProvider> | null = null;

  constructor() {
    // إعادة بثّ إشعارات المدير النشط فقط — المشتركون لا يعرفون المزوّد،
    // واشتراكهم يبقى صالحاً حتى لو تبدّل المدير بين جلستين
    livekitCallSession.subscribe(() => {
      if (this.current() === livekitCallSession) this.notify();
    });
    agoraCallSession.subscribe(() => {
      if (this.current() === agoraCallSession) this.notify();
    });
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private current(): CallManager {
    return this.activeProvider === 'agora' ? agoraCallSession : livekitCallSession;
  }

  private other(): CallManager {
    return this.activeProvider === 'agora' ? livekitCallSession : agoraCallSession;
  }

  /**
   * حسم المزوّد وتثبيته — مرة واحدة؛ أي فشل = LiveKit (الافتراضي الآمن).
   * التثبيت يبقى طوال جلسة التطبيق عمداً (نفس مسوّغات موزّع الغرف):
   * تصحيح العلم من السيرفر يسري من الإقلاع التالي.
   */
  private async pinProvider(): Promise<RtcProvider> {
    if (this.activeProvider) return this.activeProvider;
    if (this.pinPromise) return this.pinPromise;
    this.pinPromise = (async () => {
      let provider: RtcProvider = 'livekit';
      try {
        provider = await resolveRtcProvider(auth.currentUser?.uid);
      } catch {
        provider = 'livekit';
      }
      if (!this.activeProvider) this.activeProvider = provider;
      return this.activeProvider;
    })();
    try {
      return await this.pinPromise;
    } finally {
      this.pinPromise = null;
    }
  }

  setInsufficientBalanceHandler(fn: (() => void) | null): void {
    // يصل من useCall قبل تثبيت المزوّد — يُطبَّق على الاثنين
    // (واحد فقط نشط فلا ازدواج تنفيذ)
    livekitCallSession.setInsufficientBalanceHandler(fn);
    agoraCallSession.setInsufficientBalanceHandler(fn);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): CallSessionSnapshot {
    return this.current().getSnapshot();
  }

  forceError(message: string): void {
    this.current().forceError(message);
  }

  isConnectedTo(channelName: string): boolean {
    return this.current().isConnectedTo(channelName);
  }

  async connect(opts: {
    channelName: string;
    isVideo: boolean;
    peerUid?: string;
    billingSessionId?: string;
    callSource?: 'chat' | 'match';
  }): Promise<void> {
    await this.pinProvider();
    // جلسة واحدة نشطة فقط — المدير الآخر يُفصل قبل أي اتصال جديد
    const other = this.other();
    const otherState = other.getSnapshot().callState;
    if (otherState === 'connected' || otherState === 'connecting') {
      await other.leave(false).catch(() => {});
    }
    return this.current().connect(opts);
  }

  async leave(reportEnd = true): Promise<void> {
    // سباق نافذة التثبيت: لو قرار المزوّد قيد الحسم (connect جارٍ على شبكة
    // بطيئة)، انتظره كي يصل الإنهاء للمدير الذي سيملك الجلسة فعلاً —
    // التوجيه الفوري كان يذهب لمدير LiveKit الخامل ويترك جلسة Agora تكتمل
    if (!this.activeProvider && this.pinPromise) {
      await this.pinPromise.catch(() => {});
    }
    return this.current().leave(reportEnd);
  }

  setMuted(muted: boolean): Promise<boolean> {
    return this.current().setMuted(muted);
  }

  toggleMute(): Promise<boolean> {
    return this.current().toggleMute();
  }

  toggleVideo(): Promise<void> {
    return this.current().toggleVideo();
  }

  switchCamera(): Promise<void> {
    return this.current().switchCamera();
  }

  setSpeakerOn(speakerOn: boolean): Promise<boolean> {
    return this.current().setSpeakerOn(speakerOn);
  }

  toggleSpeaker(): Promise<boolean> {
    return this.current().toggleSpeaker();
  }
}

export const callSession = new CallSessionRouter();
