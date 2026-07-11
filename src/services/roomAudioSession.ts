/**
 * جلسة صوت LiveKit مشتركة — تبقى متصلة عند تصغير الروم (PiP)
 * LiveKit يُحمَّل ديناميكياً فقط عند الدخول لروم (لا عند إقلاع التطبيق)
 */
import { ref as rtdbRef, onValue, off, type DataSnapshot } from 'firebase/database';

import { getLiveKitToken } from '@/services/firebase/rtc';
import { requestCallPermissions } from '@/services/permissions';
import { ensureLiveKitGlobals } from '@/services/livekitNative';
import {
  applyBestAudioOutput,
  getCommunicationAudioConfig,
  startAudioRouteWatcher,
  stopAudioRouteWatcher,
} from '@/services/livekitAudioRouting';
import { stopRoomForegroundService } from '@/services/roomForegroundService';
import { connectLiveKitWithRelayFallback } from '@/services/livekitConnect';
import { setRoomVoiceSessionActive, configureSoundEffectsAudio } from '@/utils/playRoomSound';

export type RoomConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RoomParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
  audioLevel: number;
}

type Listener = () => void;
type LkRoom = import('livekit-client').Room;
type RemoteParticipant = import('livekit-client').RemoteParticipant;

export interface RoomAudioSnapshot {
  connectionState: RoomConnectionState;
  participants: RoomParticipant[];
  isMuted: boolean;
  error: string | null;
  room: LkRoom | null;
  roomName: string;
  canPublish: boolean;
}

/** يمنع التعليق على جهاز حقيقي: يحلّ بعد المهلة حتى لو لم يُنهِ LiveKit/الصوت الأصلي عمله */
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

/** room.connect() قد يُنهي قبل جاهزية محرك WebRTC على بعض أجهزة أندرويد */
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

/** آخر رفض لإذن الميكروفون — تهدئة تمنع إعادة الطلب في حلقة (وميض التنبيه) */
let micPermissionDeniedAt = 0;

const TOKEN_CACHE_TTL_MS = 4 * 60 * 1000;
const prefetchedTokens = new Map<
  string,
  { token: string; wsUrl: string; at: number }
>();

function tokenCacheKey(roomName: string, canPublish: boolean, peerUid?: string): string {
  return `${roomName}|${canPublish}|${peerUid ?? ''}`;
}

async function resolveLiveKitToken(
  roomName: string,
  canPublish: boolean,
  peerUid?: string,
): Promise<{ token: string; wsUrl: string }> {
  const key = tokenCacheKey(roomName, canPublish, peerUid);
  const cached = prefetchedTokens.get(key);
  if (cached && Date.now() - cached.at < TOKEN_CACHE_TTL_MS) {
    prefetchedTokens.delete(key);
    return { token: cached.token, wsUrl: cached.wsUrl };
  }
  return getLiveKitToken(roomName, canPublish, peerUid);
}

/** تحميل مسبق للوحدات والتوكن — يُستدعى عند فتح شاشة الروم */
export function prefetchRoomAudio(
  roomName: string,
  canPublish = false,
  peerUid?: string,
): void {
  void loadLiveKitModules();
  if (!roomName) return;
  const key = tokenCacheKey(roomName, canPublish, peerUid);
  void getLiveKitToken(roomName, canPublish, peerUid)
    .then(({ token, wsUrl }) => {
      prefetchedTokens.set(key, { token, wsUrl, at: Date.now() });
    })
    .catch(() => {});
}

async function loadLiveKitModules() {
  if (!lkModule) {
    lkModule = await import('livekit-client');
  }
  let nativeAudio: Awaited<ReturnType<typeof ensureLiveKitGlobals>> | null = null;
  try {
    nativeAudio = await ensureLiveKitGlobals();
  } catch (e) {
    console.warn('LiveKit native:', e);
  }
  return { lk: lkModule, nativeAudio };
}

/**
 * مقارنة لقطتي مشاركين: نتجاهل تذبذب audioLevel الدقيق ونكتفي بمستوى مكمَّم (0..4)
 * حتى لا نُعيد رسم شاشة الروم 8 مرّات/ثانية بلا داعٍ (سبب رئيسي لتقطّع الصوت والبطء).
 * يبقى مؤشر التحدّث (isSpeaking) والكتم (isMuted) فوريّاً، وحلقة الصوت تتحرّك بخطوات.
 */
function participantsEqual(a: RoomParticipant[], b: RoomParticipant[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.identity !== y.identity ||
      x.isSpeaking !== y.isSpeaking ||
      x.isMuted !== y.isMuted ||
      Math.round(x.audioLevel * 4) !== Math.round(y.audioLevel * 4)
    ) {
      return false;
    }
  }
  return true;
}

/** إسكات كل مسارات الصوت البعيدة لغرفة معيّنة — يُستخدم أثناء/بعد القطع */
function silenceRoomRemoteAudio(room: LkRoom): void {
  try {
    room.remoteParticipants.forEach((p) => {
      p.getTrackPublications().forEach((pub) => {
        if (pub.track && pub.kind === 'audio') {
          try {
            (pub.track as { setVolume?: (v: number) => void }).setVolume?.(0);
          } catch {
            try {
              (pub.track as any).mediaStreamTrack.enabled = false;
            } catch { /* ignore */ }
          }
        }
      });
    });
  } catch {
    // ignore
  }
}

/**
 * إسكات مسار المايك المحلي قسرياً — يعمل حتى لو تجاهل الجهاز setMicrophoneEnabled
 * (بعض الأجهزة مثل Tecno تُظهر «مكتوم» بينما المسار يبث فعلاً).
 */
async function forceLocalMicMuted(room: LkRoom): Promise<void> {
  const lp = room.localParticipant as unknown as {
    getTrackPublications?: () => any[];
  } | null;
  if (!lp) return;
  const pubs: any[] = lp.getTrackPublications?.() ?? [];
  for (const pub of pubs) {
    if (pub?.kind !== 'audio') continue;
    try {
      await pub.mute?.();
    } catch { /* ignore */ }
    const track = pub?.track ?? pub?.audioTrack;
    try {
      await track?.mute?.();
    } catch { /* ignore */ }
    try {
      const mst = track?.mediaStreamTrack;
      if (mst) mst.enabled = false;
    } catch { /* ignore */ }
  }
}

/** إيقاف التقاط المايك المحلي نهائياً عند القطع — حتى لو علِق room.disconnect() */
function stopLocalMicForTeardown(room: LkRoom): void {
  try {
    const pubs: any[] =
      (room.localParticipant as any)?.getTrackPublications?.() ?? [];
    for (const pub of pubs) {
      if (pub?.kind !== 'audio') continue;
      const track = pub?.track ?? pub?.audioTrack;
      try {
        const mst = track?.mediaStreamTrack;
        if (mst) mst.enabled = false;
      } catch { /* ignore */ }
      try {
        track?.stop?.();
      } catch { /* ignore */ }
    }
  } catch {
    // ignore
  }
}

function mapParticipants(room: LkRoom): RoomParticipant[] {
  const result: RoomParticipant[] = [];
  const local = room.localParticipant;
  if (local) {
    result.push({
      identity: local.identity,
      name: local.name ?? 'أنا',
      isSpeaking: local.isSpeaking,
      isMuted: !local.isMicrophoneEnabled,
      isLocal: true,
      audioLevel: local.audioLevel ?? 0,
    });
  }
  room.remoteParticipants.forEach((p: RemoteParticipant) => {
    result.push({
      identity: p.identity,
      name: p.name ?? p.identity,
      isSpeaking: p.isSpeaking,
      isMuted: !p.isMicrophoneEnabled,
      isLocal: false,
      audioLevel: p.audioLevel ?? 0,
    });
  });
  return result;
}

class RoomAudioSessionManager {
  private room: LkRoom | null = null;
  private roomName = '';
  private canPublish = false;
  private connectionState: RoomConnectionState = 'idle';
  private participants: RoomParticipant[] = [];
  private isMuted = true;
  private error: string | null = null;
  private listeners = new Set<Listener>();
  private ConnectionState: typeof import('livekit-client').ConnectionState | null = null;
  private levelPollTimer: ReturnType<typeof setInterval> | null = null;
  private connectPromise: Promise<void> | null = null;
  /** حالة الكتم المطلوبة قبل/أثناء إعادة الاتصال — تُزامَن مع مقعد Firebase */
  private micMutedPreference: boolean | null = null;
  /** كتم سماع صوت الغرفة (المستمع) — يُطبَّق على كل المسارات البعيدة */
  private remoteAudioMuted = false;
  /** عدّاد لمنع disconnect القديم من إيقاف AudioSession لروم جديد */
  private connectGeneration = 0;
  private stopRouteWatcher: (() => void) | null = null;
  /** مراقب مقعدي في RTDB — يفرض الكتم الإداري حتى مع تصغير الروم (PiP) */
  private seatMuteWatchStop: (() => void) | null = null;
  /** كتمني مشرف/وكيل — يمنع فك الكتم الذاتي حتى يُفكّ من الإدارة */
  private seatAdminMuted = false;
  private snapshotCache: RoomAudioSnapshot = {
    connectionState: 'idle',
    participants: [],
    isMuted: true,
    error: null,
    room: null,
    roomName: '',
    canPublish: false,
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private rebuildSnapshot(): void {
    this.snapshotCache = {
      connectionState: this.connectionState,
      participants: this.participants,
      isMuted: this.isMuted,
      error: this.error,
      room: this.room,
      roomName: this.roomName,
      canPublish: this.canPublish,
    };
  }

  private emit() {
    this.rebuildSnapshot();
    this.listeners.forEach((l) => l());
  }

  /** مرجع ثابت — مطلوب لـ useSyncExternalStore / subscribe */
  getSnapshot(): RoomAudioSnapshot {
    return this.snapshotCache;
  }

  isConnectedTo(roomName: string): boolean {
    return (
      !!this.room &&
      !!this.ConnectionState &&
      this.roomName === roomName &&
      this.room.state === this.ConnectionState.Connected
    );
  }

  async connect(roomName: string, canPublish: boolean, peerUid?: string): Promise<void> {
    if (!roomName) return;

    if (this.isConnectedTo(roomName) && this.canPublish === canPublish) {
      this.applyRemoteAudioVolume();
      this.scheduleRemoteVolumeResync();
      return;
    }

    if (this.connectPromise) {
      await this.connectPromise.catch(() => {});
      if (this.isConnectedTo(roomName) && this.canPublish === canPublish) {
        this.applyRemoteAudioVolume();
        this.scheduleRemoteVolumeResync();
        return;
      }
    }

    this.connectPromise = this.connectInternal(roomName, canPublish, peerUid);
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async waitForConnectedRoom(timeoutMs = 6000): Promise<LkRoom | null> {
    if (
      this.room &&
      this.ConnectionState &&
      this.room.state === this.ConnectionState.Connected
    ) {
      return this.room;
    }
    if (this.connectPromise) {
      await Promise.race([this.connectPromise.catch(() => {}), sleep(timeoutMs)]);
    }
    if (
      this.room &&
      this.ConnectionState &&
      this.room.state === this.ConnectionState.Connected
    ) {
      return this.room;
    }
    const room = this.room;
    const lk = lkModule;
    if (!room || !lk || !this.ConnectionState) return null;
    if (room.state === this.ConnectionState.Connected) return room;
    try {
      await waitForRoomConnected(
        room,
        lk.ConnectionState,
        lk.RoomEvent,
        Math.min(timeoutMs, 5000),
      );
      return room;
    } catch {
      return null;
    }
  }

  /** قطع سريع بدون إيقاف AudioSession — للتنقل بين الرومات */
  private async disconnectFast(): Promise<void> {
    this.stopSeatMuteWatch();
    if (this.levelPollTimer) {
      clearInterval(this.levelPollTimer);
      this.levelPollTimer = null;
    }
    const room = this.room;
    if (room) {
      try {
        // لا نغيّر remoteAudioMuted — وإلا يبقى الصوت 0 بعد إعادة الاتصال (canPublish)
        this.silenceRemoteTracksForTeardown();
        await withTimeout(room.disconnect(), 1500);
      } catch {
        // ignore
      }
      this.room = null;
      // حتى لو تجاوز disconnect المهلة — الكائن القديم يُمات نهائياً بالخلفية
      this.abandonRoomInstance(room);
    }
    this.roomName = '';
    this.canPublish = false;
    this.isMuted = true;
  }

  /** كتم مؤقت أثناء قطع الاتصال — لا يمسّ تفضيل المستخدم */
  private silenceRemoteTracksForTeardown(): void {
    const room = this.room;
    if (!room) return;
    silenceRoomRemoteAudio(room);
  }

  /**
   * إماتة كائن غرفة قديم نهائياً — يُستدعى بعد كل قطع (حتى الناجح).
   * السبب: لو تجاوز room.disconnect() المهلة يبقى الاتصال حياً بمستمعيه؛
   * مسار صوت يُشترك متأخراً كان يستمر بالتشغيل بعد «الخروج» (تسريب الصوت)،
   * وأحداث الغرفة القديمة كانت تدوس حالة الجلسة الجديدة (تداخل وكالة أخرى).
   */
  private abandonRoomInstance(room: LkRoom): void {
    silenceRoomRemoteAudio(room);
    // قتل التقاط المايك المحلي فوراً — لو علِق disconnect يبقى البث حياً
    // وكان الآخرون يسمعون من «خرج» وهو خارج الروم (تسريب المايك)
    stopLocalMicForTeardown(room);
    try {
      (room as unknown as { removeAllListeners?: () => void }).removeAllListeners?.();
    } catch {
      // ignore
    }
    // محاولات قطع خلفية متكررة — الاتصال لا يبقى حياً بعد الخروج مطلقاً
    let attempts = 0;
    const retry = async (): Promise<void> => {
      attempts += 1;
      try {
        await room.disconnect();
      } catch {
        if (attempts < 3) {
          setTimeout(() => {
            silenceRoomRemoteAudio(room);
            stopLocalMicForTeardown(room);
            void retry();
          }, 2500);
        }
      }
    };
    void retry();
  }

  /** تطبيق مستوى صوت المسارات البعيدة حسب حالة كتم الغرفة */
  private applyRemoteAudioVolume(): void {
    const room = this.room;
    if (!room) return;
    const level = this.remoteAudioMuted ? 0 : 1.0;
    const enabled = !this.remoteAudioMuted;
    room.remoteParticipants.forEach((p) => {
      p.getTrackPublications().forEach((pub) => {
        if (pub.track && pub.kind === 'audio') {
          const track = pub.track as {
            setVolume?: (v: number) => void;
            mediaStreamTrack?: { enabled: boolean };
          };
          try {
            track.setVolume?.(level);
          } catch { /* ignore */ }
          try {
            if (track.mediaStreamTrack) track.mediaStreamTrack.enabled = enabled;
          } catch { /* ignore */ }
        }
      });
    });
  }

  /** مسارات تُشترك متأخراً بعد Connected — إعادة تطبيق بعد تأخير قصير */
  private scheduleRemoteVolumeResync(): void {
    const gen = this.connectGeneration;
    const resync = () => {
      if (gen !== this.connectGeneration) return;
      this.applyRemoteAudioVolume();
    };
    setTimeout(resync, 120);
    setTimeout(resync, 450);
    setTimeout(resync, 1200);
    setTimeout(resync, 2500);
  }

  /** هل كتمني مشرف/وكيل؟ (لا يمكن فك الكتم ذاتياً) */
  isSeatAdminMuted(): boolean {
    return this.seatAdminMuted;
  }

  /**
   * مراقبة مقعدي في RTDB وفرض علامة الكتم على LiveKit فعلياً.
   * يعيش مع جلسة الصوت نفسها (لا مع شاشة الروم) — فيعمل حتى أثناء
   * تصغير الروم أو عندما تكون الشاشة غير معروضة.
   */
  private startSeatMuteWatch(roomName: string): void {
    this.stopSeatMuteWatch();
    const match = /^room_(.+)$/.exec(roomName);
    if (!match) return; // مكالمات/تحديات — ليست غرف مقاعد
    let uid: string | undefined;
    let seatsRefHolder: ReturnType<typeof rtdbRef> | null = null;
    let handler: ((snap: DataSnapshot) => void) | null = null;
    void (async () => {
      try {
        const { realtimeDb, auth } = await import('@/services/firebase');
        uid = auth.currentUser?.uid;
        if (!uid || this.roomName !== roomName) return;
        const myUid = uid;
        seatsRefHolder = rtdbRef(realtimeDb, `rooms/${match[1]}/seats`);
        handler = (snap: DataSnapshot) => {
          if (this.roomName !== roomName) return;
          const seats = (snap.val() ?? {}) as Record<
            string,
            { uid?: string; isMuted?: boolean; mutedBy?: string }
          >;
          let mySeat: { isMuted?: boolean; mutedBy?: string } | null = null;
          for (const seat of Object.values(seats)) {
            if (seat?.uid === myUid) {
              mySeat = seat;
              break;
            }
          }
          if (!mySeat) {
            this.seatAdminMuted = false;
            return;
          }
          const muted = mySeat.isMuted === true;
          this.seatAdminMuted = muted && !!mySeat.mutedBy && mySeat.mutedBy !== myUid;
          if (this.canPublish && this.isMuted !== muted) {
            void this.applyMicMuted(muted).catch(() => {});
          }
        };
        onValue(seatsRefHolder, handler);
      } catch {
        // فشل تحميل فايربيس — نكتفي بمزامنة الشاشة
      }
    })();
    this.seatMuteWatchStop = () => {
      if (seatsRefHolder && handler) off(seatsRefHolder, 'value', handler);
      seatsRefHolder = null;
      handler = null;
    };
  }

  private stopSeatMuteWatch(): void {
    this.seatMuteWatchStop?.();
    this.seatMuteWatchStop = null;
    this.seatAdminMuted = false;
  }

  private async connectInternal(
    roomName: string,
    canPublish: boolean,
    peerUid?: string,
  ): Promise<void> {
    if (this.room) {
      await this.disconnectFast();
    }

    this.connectGeneration++;

    try {
      this.connectionState = 'connecting';
      this.error = null;
      this.emit();

      // تهدئة طلب إذن الميكروفون — الرفض كان يُعاد طلبه بحلقة إعادة الاتصال
      // فيرمش التنبيه بسرعة ولا يلحق المستخدم يضغط شيئاً
      if (canPublish && Date.now() - micPermissionDeniedAt < 15_000) {
        this.error = 'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
        this.connectionState = 'error';
        this.emit();
        return;
      }

      const tokenPromise = resolveLiveKitToken(roomName, canPublish, peerUid);
      const [{ lk, nativeAudio }, micGranted] = await Promise.all([
        loadLiveKitModules(),
        canPublish ? requestCallPermissions('audio') : Promise.resolve(true),
      ]);
      this.ConnectionState = lk.ConnectionState;
      const { Room, RoomEvent } = lk;
      const AudioSession = nativeAudio;
      if (!AudioSession) {
        throw new Error('LiveKit AudioSession unavailable');
      }

      if (canPublish && !micGranted) {
        micPermissionDeniedAt = Date.now();
        this.error = 'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
        this.connectionState = 'error';
        this.emit();
        return;
      }

      await AudioSession.configureAudio(getCommunicationAudioConfig('room', true));
      await AudioSession.startAudioSession();
      await applyBestAudioOutput(AudioSession, true);
      this.stopRouteWatcher?.();
      this.stopRouteWatcher = startAudioRouteWatcher({
        getPreferSpeaker: () => true,
        onApply: async (preferSpeaker) => {
          const session = await ensureLiveKitGlobals();
          await applyBestAudioOutput(session, preferSpeaker);
        },
      });
      // رفع مستوى الصوت الافتراضي للمسارات البعيدة إلى الحد الأقصى
      try {
        await (AudioSession as any).setDefaultRemoteAudioTrackVolume?.(1.0);
      } catch {
        // ignore — بعض الأجهزة لا تدعمها
      }

      const { token, wsUrl } = await tokenPromise;
      const room = new Room({
        // غرف صوتية — إيقاف adaptiveStream يمنع تقليص/إيقاف مسارات الصوت عند تغيّر الشبكة
        adaptiveStream: false,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        publishDefaults: {
          dtx: false,
          red: true,
          ...(lk.AudioPresets?.music
            ? { audioPreset: lk.AudioPresets.music }
            : lk.AudioPresets?.speech
              ? { audioPreset: lk.AudioPresets.speech }
              : {}),
        },
      });
      this.room = room;
      this.roomName = roomName;
      this.canPublish = canPublish;
      // فرض كتم المقعد من RTDB على مستوى الجلسة — يعمل حتى مع تصغير الروم
      this.startSeatMuteWatch(roomName);

      // refresh عام (أحداث الاتصال) — يُصدر دائماً
      // حارس العزل: أحداث غرفة قديمة (اتصال لم يُقطع بعد) لا تلمس حالة الجلسة الحالية
      const refresh = () => {
        if (this.room !== room) return;
        this.participants = mapParticipants(room);
        this.emit();
      };
      // refresh خاص بمؤقّت مستوى الصوت — لا يُصدر إلا عند تغيّر فعلي
      // (يمنع إعادة رسم شاشة الروم 8 مرّات/ثانية دون داعٍ)
      const refreshLevels = () => {
        if (this.room !== room) return;
        const next = mapParticipants(room);
        if (participantsEqual(this.participants, next)) return;
        this.participants = next;
        this.emit();
      };

      room
        .on(RoomEvent.Connected, () => {
          if (this.room !== room) return;
          this.connectionState = 'connected';
          setRoomVoiceSessionActive(true);
          void configureSoundEffectsAudio();
          this.applyRemoteAudioVolume();
          this.scheduleRemoteVolumeResync();
          refresh();
          if (this.levelPollTimer) clearInterval(this.levelPollTimer);
          this.levelPollTimer = setInterval(refreshLevels, 150);
        })
        .on(RoomEvent.Disconnected, () => {
          if (this.room !== room) return;
          if (this.levelPollTimer) {
            clearInterval(this.levelPollTimer);
            this.levelPollTimer = null;
          }
          this.connectionState = 'disconnected';
          setRoomVoiceSessionActive(false);
          this.participants = [];
          this.emit();
        })
        .on(RoomEvent.ParticipantConnected, () => {
          this.applyRemoteAudioVolume();
          this.scheduleRemoteVolumeResync();
          refresh();
        })
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, (pub: any, participant: any) => {
          // حارس الكتم: لو انفتح مسار مايكنا (إعادة نشر تلقائية بعد انقطاع)
          // بينما حالتنا «مكتوم» — نعيد تعطيله فوراً حتى لا يُسمَع المكتوم
          if (
            this.room === room &&
            this.isMuted &&
            participant?.isLocal === true &&
            pub?.kind === 'audio'
          ) {
            void enableMicrophoneWithRetry(room, false, 2).catch(() => {});
          }
          this.applyRemoteAudioVolume();
          this.scheduleRemoteVolumeResync();
          refresh();
        })
        .on(RoomEvent.LocalTrackPublished, refresh)
        // مسار صوت يُشترك بعد كتم صوت الروم كان يبدأ بمستوى كامل — يُعاد ضبطه فوراً
        .on(RoomEvent.TrackSubscribed, (_track: any, pub: any) => {
          if (this.room !== room) return;
          if (pub?.kind === 'audio') {
            this.applyRemoteAudioVolume();
            this.scheduleRemoteVolumeResync();
          }
          refresh();
        })
        .on(RoomEvent.Reconnecting, () => {
          if (this.room !== room) return;
          this.connectionState = 'connecting';
          this.emit();
        })
        .on(RoomEvent.Reconnected, () => {
          if (this.room !== room) return;
          this.connectionState = 'connected';
          setRoomVoiceSessionActive(true);
          void configureSoundEffectsAudio();
          if (this.canPublish) {
            const muted = this.isMuted;
            void enableMicrophoneWithRetry(room, !muted, 3).catch(() => {});
          }
          this.applyRemoteAudioVolume();
          this.scheduleRemoteVolumeResync();
          refresh();
        })
        .on(RoomEvent.TrackSubscribed, (_track, pub) => {
          if (this.room !== room) {
            // غرفة مهجورة — أسكت أي مسار وصل متأخراً فوراً (لا تسريب صوت)
            if (pub.kind === 'audio' && pub.track) {
              try {
                (pub.track as { setVolume?: (v: number) => void }).setVolume?.(0);
              } catch { /* ignore */ }
            }
            return;
          }
          if (pub.kind === 'audio') {
            this.applyRemoteAudioVolume();
            this.scheduleRemoteVolumeResync();
          }
          refresh();
        });

      // #17: اتصال مع بديل ترحيل TURN/TLS:443 تلقائي لشبكات تحجب UDP
      await connectLiveKitWithRelayFallback(room, wsUrl, token, (r) =>
        waitForRoomConnected(r, lk.ConnectionState, RoomEvent),
      );

      this.applyRemoteAudioVolume();

      if (canPublish) {
        // المايك يبدأ مفتوح بشكل افتراضي عند الجلوس على المقعد
        // Firebase sync سيُعدّل الحالة إذا كان المقعد مكتوماً
        const muted = this.micMutedPreference ?? false;
        this.isMuted = muted;
        await enableMicrophoneWithRetry(room, !muted);
        this.micMutedPreference = null;

        // على بعض أجهزة أندرويد، WebRTC لا يبث الصوت فوراً بعد أول enable
        // إعادة التفعيل بعد تأخير قصير تضمن بث الصوت فعلياً
        if (!muted) {
          const gen = this.connectGeneration;
          setTimeout(() => {
            if (this.connectGeneration !== gen || !this.room || this.isMuted) return;
            enableMicrophoneWithRetry(this.room, true, 2).catch(() => {});
          }, 600);
        }
      } else {
        await enableMicrophoneWithRetry(room, false);
        this.isMuted = true;
      }

      this.applyRemoteAudioVolume();
      this.scheduleRemoteVolumeResync();
      refresh();
    } catch (e: any) {
      setRoomVoiceSessionActive(false);
      this.error = isEngineNotReadyError(e)
        ? 'تعذّر تشغيل الميكروفون — تحقق من الشبكة ثم أعد المحاولة'
        : (e.message ?? 'فشل الاتصال بالغرفة');
      this.connectionState = 'error';
      this.emit();
    }
  }

  async disconnect(): Promise<void> {
    const gen = this.connectGeneration;
    this.stopSeatMuteWatch();
    if (this.levelPollTimer) {
      clearInterval(this.levelPollTimer);
      this.levelPollTimer = null;
    }
    const room = this.room;
    if (room) {
      try {
        this.silenceRemoteTracksForTeardown();
        if (room.localParticipant) {
          await withTimeout(
            enableMicrophoneWithRetry(room, false, 2).catch(() => {}),
            1500,
          );
        }
        await withTimeout(room.disconnect(), 2000);
      } catch {
        // ignore
      }
      if (this.room === room) this.room = null;
      // ضمان الموت الكامل حتى مع تجاوز المهلة — يمنع استمرار سماع الغرفة بعد الخروج
      this.abandonRoomInstance(room);
    }
    if (gen !== this.connectGeneration) return;
    this.roomName = '';
    this.canPublish = false;
    this.isMuted = true;
    this.micMutedPreference = null;

    if (gen !== this.connectGeneration) return;
    this.stopRouteWatcher?.();
    this.stopRouteWatcher = null;
    stopAudioRouteWatcher();
    try {
      const AudioSession = await ensureLiveKitGlobals();
      await withTimeout(AudioSession.stopAudioSession(), 2000);
    } catch {
      // ignore
    }
    setRoomVoiceSessionActive(false);

    if (gen !== this.connectGeneration) return;
    this.connectionState = 'disconnected';
    this.participants = [];
    this.emit();
    void stopRoomForegroundService();
  }

  /** تطبيق حالة المايك فعلياً — بدون فحص الكتم الإداري (للمزامنة الداخلية من RTDB) */
  private async applyMicMuted(muted: boolean): Promise<void> {
    this.micMutedPreference = muted;
    const room = await this.waitForConnectedRoom(6000);
    if (!room || !this.ConnectionState) {
      this.isMuted = muted;
      this.emit();
      return;
    }
    if (!this.canPublish) {
      this.isMuted = true;
      this.emit();
      return;
    }
    // بلا اختصار على الحالة المحلية — كانت العلامة تُضبط تفاؤلياً عند تعثّر
    // الشبكة دون تعطيل مسار الصوت فعلياً، فتتخطى المحاولاتُ اللاحقة التنفيذ
    // ويبقى الصوت مبثوثاً رغم أن الواجهة تقول «مكتوم» (سماع المكتومين).
    // استدعاء LiveKit آمن التكرار (idempotent) فلا كلفة لإعادة التطبيق.
    await enableMicrophoneWithRetry(room, !muted);
    this.isMuted = muted;
    if (muted) {
      // تحقّق فعلي بعد الكتم — بعض الأجهزة (Tecno وأمثالها) تُبقي المسار يبث
      // رغم نجاح setMicrophoneEnabled(false) ظاهرياً؛ نفرض كتم المسار نفسه
      await this.verifyMicActuallyMuted(room);
    }
    this.participants = mapParticipants(room);
    this.emit();
  }

  /** يتأكد أن المايك معطَّل فعلاً بعد الكتم — وإلا يفرض كتم/تعطيل المسار مباشرة */
  private async verifyMicActuallyMuted(room: LkRoom): Promise<void> {
    const enforce = async () => {
      try {
        if (room.localParticipant?.isMicrophoneEnabled) {
          await enableMicrophoneWithRetry(room, false, 2).catch(() => {});
        }
        await forceLocalMicMuted(room);
      } catch {
        // ignore
      }
    };
    await withTimeout(enforce(), 2000);
    // فحص متأخر — WebRTC على بعض الأجهزة يعيد تفعيل المسار بعد لحظات
    const gen = this.connectGeneration;
    setTimeout(() => {
      if (gen !== this.connectGeneration || this.room !== room || !this.isMuted) return;
      void enforce();
    }, 800);
  }

  async setMuted(muted: boolean): Promise<void> {
    // مكتوم إدارياً — لا يفتح المايك إلا بفكّ الكتم من المشرف/الوكيل
    if (!muted && this.seatAdminMuted) return;
    await this.applyMicMuted(muted);
  }

  async toggleMute(): Promise<void> {
    if (!this.canPublish) return;
    await this.setMuted(!this.isMuted);
  }

  async requestToSpeak(): Promise<void> {
    if (!this.canPublish) return;
    if (this.seatAdminMuted) return;
    const granted = await requestCallPermissions('audio');
    if (!granted) return;
    const room = await this.waitForConnectedRoom(6000);
    if (!room || !this.ConnectionState) return;
    try {
      await enableMicrophoneWithRetry(room, true);
      this.isMuted = false;
      this.participants = mapParticipants(room);
      this.emit();
    } catch {
      // صامت — لا alert عند انتظار الاتصال
    }
  }

  setRemoteAudioMuted(muted: boolean): void {
    this.remoteAudioMuted = muted;
    // كتم صوت الروم يشمل موسيقى الروم المشتركة — تُشغَّل محلياً عبر expo-av
    // لا عبر LiveKit، فكانت تبقى مسموعة رغم كتم الروم
    void import('@/services/roomMusicPlaybackManager')
      .then((m) => m.roomMusicPlaybackManager.setMutedAll(muted))
      .catch(() => {});
    this.applyRemoteAudioVolume();
    this.scheduleRemoteVolumeResync();
  }

  /** إعادة تطبيق مستوى السماع — بعد دخول عضو أو عودة الاتصال */
  resyncRemoteAudio(): void {
    this.applyRemoteAudioVolume();
    this.scheduleRemoteVolumeResync();
  }

  // ==== تعليق صوت الروم أثناء مكالمة 1:1 ====
  // كان صوت الروم المثبّت يختلط بالمكالمة (تسمع الغرفة وأنت تتكلم مع الطرف الآخر)
  private callSuspendState: { remoteMuted: boolean; micMuted: boolean } | null = null;

  suspendForCall(): void {
    if (this.callSuspendState) return;
    this.callSuspendState = {
      remoteMuted: this.remoteAudioMuted,
      micMuted: this.isMuted,
    };
    this.setRemoteAudioMuted(true);
    if (this.canPublish && !this.isMuted) {
      void this.applyMicMuted(true).catch(() => {});
    }
  }

  resumeAfterCall(): void {
    const prev = this.callSuspendState;
    if (!prev) return;
    this.callSuspendState = null;
    this.setRemoteAudioMuted(prev.remoteMuted);
    if (this.canPublish && !prev.micMuted && !this.seatAdminMuted) {
      void this.applyMicMuted(false).catch(() => {});
    }
  }
}

export const roomAudioSession = new RoomAudioSessionManager();
