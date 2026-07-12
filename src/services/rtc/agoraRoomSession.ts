/**
 * جلسة صوت الغرف عبر Agora — التنفيذ الموازي لمدير LiveKit في roomAudioSession
 *
 * نفس الواجهة العامة حرفياً (subscribe/getSnapshot/connect/disconnect/
 * toggleMute/setMuted/requestToSpeak/isConnectedTo/setRemoteAudioMuted/
 * resyncRemoteAudio/suspendForCall/resumeAfterCall/isSeatAdminMuted) —
 * التوجيه بين المديرين في roomAudioSession خلف علم سيرفري (rtcProvider).
 *
 * فروقات جوهرية عن مرجع LiveKit (تبسيطات يوفرها المحرك):
 * - الجلوس/النزول عن المقعد = توكن جديد + renewToken + setRole — بلا
 *   disconnectFast/إعادة اتصال إطلاقاً.
 * - الكتم أمر محرك واحد (setMicMuted يغطي النشر والالتقاط معاً) + إعادة
 *   تطبيق الحالة عند reconnected — تسقط حيل verifyMicActuallyMuted
 *   وحارس TrackUnmuted وإعادة الـ600ms.
 * - كتم السماع أمر واحد (setAllRemoteMuted) — تسقط مؤقتات إعادة التطبيق
 *   120/450/1200/2500ms؛ ويبقى نقل كتم موسيقى expo-av والمؤثرات المحلية.
 * - السماعة عبر setSpeakerphone + حدث audioRouteChanged — يسقط poll الأجهزة.
 *
 * ملاحظة الأجيال: أحداث المحرك يحرسها joinGeneration داخل agoraEngine —
 * connectGeneration هنا يحرس استمرارات async على مستوى الجلسة فقط
 * (توكن متأخر/إعادة انضمام/مؤقتات) ولا يكرر دور المحرك.
 */
import { ref as rtdbRef, onValue, off, type DataSnapshot } from 'firebase/database';

import { requestCallPermissions } from '@/services/permissions';
import { stopRoomForegroundService } from '@/services/roomForegroundService';
import { agoraEngine, type AgoraRtcEvent, type AgoraSpeakerInfo } from './agoraEngine';
import { joinWithTransportLadder } from './agoraConnect';
import { getAgoraTokenCached, attachTokenRenewal } from './agoraToken';
import {
  setRoomVoiceSessionActive,
  configureSoundEffectsAudio,
  setRoomSfxMuted,
} from '@/utils/playRoomSound';
import type {
  RoomAudioSnapshot,
  RoomConnectionState,
  RoomParticipant,
} from '@/services/roomAudioSession';

type Listener = () => void;

/** عتبة اعتبار المشارك «يتحدث» — المستوى مطبَّع 0..1 من المحرك */
const SPEAKING_THRESHOLD = 0.045;
/** مسار الصوت «سماعة الأذن» في Agora — الغرف تعيد فرض مكبّر الصوت عندها */
const AUDIO_ROUTE_EARPIECE = 1;

/** آخر رفض لإذن الميكروفون — تهدئة تمنع إعادة الطلب في حلقة (وميض التنبيه) */
let micPermissionDeniedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * مقارنة لقطتي مشاركين — نفس تكميم المرجع (audioLevel بخطوات 0..4)
 * حتى لا نعيد رسم شاشة الروم مع كل تقرير مستوى صوت (كل 200ms).
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

class AgoraRoomSessionManager {
  private roomName = '';
  private canPublish = false;
  private peerUid: string | undefined;
  /** معرّف Firebase النصي — يصل من رد التوكن (identity === uid) */
  private localIdentity = '';
  private localLevel = 0;
  private connectionState: RoomConnectionState = 'idle';
  private participants: RoomParticipant[] = [];
  /** المشاركون البعيدون (المتحدثون على القناة) بهويتهم النصية */
  private remotes = new Map<string, RoomParticipant>();
  /** كتمٌ وصل قبل إعلان صاحبه (مهلة إعلان المحرك) — يُطبَّق عند انضمامه */
  private pendingRemoteMuted = new Map<string, boolean>();
  private isMuted = true;
  private error: string | null = null;
  private listeners = new Set<Listener>();
  private connectPromise: Promise<void> | null = null;
  /** حالة الكتم المطلوبة قبل/أثناء الاتصال — تُزامَن مع مقعد Firebase */
  private micMutedPreference: boolean | null = null;
  /** كتم سماع صوت الغرفة (المستمع) — أمر محرك واحد بلا مؤقتات */
  private remoteAudioMuted = false;
  /** يحرس استمرارات async للجلسة (لا أحداث المحرك — تلك عند joinGeneration) */
  private connectGeneration = 0;
  /** هل قامت جلسة فعلاً؟ يميّز disconnected حقيقي عن فشل درجات السلّم */
  private sessionEstablished = false;
  /** إعادة انضمام بتوكن جديد جارية — تكتم حدث disconnected العابر */
  private rejoinInFlight = false;
  private engineUnsub: (() => void) | null = null;
  private renewalDetach: (() => void) | null = null;
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
      // لا كائن غرفة عند Agora — الشاشات لا تستعمله إلا كمرجع LiveKit اختياري
      room: null,
      roomName: this.roomName,
      canPublish: this.canPublish,
    };
  }

  private emit(): void {
    this.rebuildSnapshot();
    this.listeners.forEach((l) => l());
  }

  /** مرجع ثابت — مطلوب لـ useSyncExternalStore / subscribe */
  getSnapshot(): RoomAudioSnapshot {
    return this.snapshotCache;
  }

  isConnectedTo(roomName: string): boolean {
    return this.roomName === roomName && this.connectionState === 'connected';
  }

  // ==================== بناء قائمة المشاركين ====================

  private buildParticipants(): RoomParticipant[] {
    const list: RoomParticipant[] = [];
    if (this.localIdentity) {
      list.push({
        identity: this.localIdentity,
        name: 'أنا',
        isSpeaking: !this.isMuted && this.localLevel >= SPEAKING_THRESHOLD,
        isMuted: this.isMuted,
        isLocal: true,
        audioLevel: this.localLevel,
      });
    }
    this.remotes.forEach((p) => list.push(p));
    return list;
  }

  /** onlyIfChanged: لتقارير مستوى الصوت — لا إصدار إلا عند تغيّر فعلي */
  private refreshParticipants(onlyIfChanged = false): void {
    const next = this.buildParticipants();
    if (onlyIfChanged && participantsEqual(this.participants, next)) return;
    this.participants = next;
    this.emit();
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
        // الانضمام الأولي/إعادة الانضمام يقودهما وعد join — هنا تحديث فقط
        if (this.connectionState === 'connected') this.refreshParticipants();
        break;

      case 'reconnecting':
        if (this.connectionState === 'connected') {
          this.connectionState = 'connecting';
          this.emit();
        }
        break;

      case 'reconnected':
        // (الموضع 3 — نظير RoomEvent.Reconnected في المرجع)
        if (!this.sessionEstablished) break;
        this.connectionState = 'connected';
        setRoomVoiceSessionActive(true);
        void configureSoundEffectsAudio();
        // إعادة تطبيق حالة الكتم — تحل محل حارس TrackUnmuted في LiveKit
        agoraEngine.setMicMuted(this.canPublish ? this.isMuted : true);
        this.applyRemoteMuted();
        agoraEngine.setSpeakerphone(true);
        this.refreshParticipants();
        break;

      case 'disconnected':
        // فشل درجة من سلّم النقل يمر من هنا أيضاً — نتجاهله ما لم تقم جلسة،
        // وكذلك القطع العابر أثناء إعادة الانضمام بتوكن جديد
        if (!this.sessionEstablished || this.rejoinInFlight) break;
        if (this.connectionState !== 'connected' && this.connectionState !== 'connecting') break;
        this.connectionState = 'disconnected';
        // (الموضع 2 — نظير RoomEvent.Disconnected في المرجع)
        setRoomVoiceSessionActive(false);
        this.remotes.clear();
        this.pendingRemoteMuted.clear();
        this.participants = [];
        this.emit();
        break;

      case 'participantJoined': {
        if (!event.identity || event.identity === this.localIdentity) break;
        if (!this.remotes.has(event.identity)) {
          // حالة كتم وصلت أثناء مهلة إعلانه في المحرك — تُطبَّق بدل الضياع
          const initialMuted = this.pendingRemoteMuted.get(event.identity) ?? false;
          this.pendingRemoteMuted.delete(event.identity);
          this.remotes.set(event.identity, {
            identity: event.identity,
            name: event.identity,
            isSpeaking: false,
            isMuted: initialMuted,
            isLocal: false,
            audioLevel: 0,
          });
        }
        this.refreshParticipants();
        break;
      }

      case 'participantLeft':
        this.pendingRemoteMuted.delete(event.identity);
        if (this.remotes.delete(event.identity)) this.refreshParticipants();
        break;

      case 'trackMuted': {
        const p = this.remotes.get(event.identity);
        if (!p) {
          // لم يُعلن بعد (داخل مهلة الإعلان) — نحفظ حالته الابتدائية لانضمامه
          this.pendingRemoteMuted.set(event.identity, event.muted);
          break;
        }
        if (p.isMuted === event.muted) break;
        this.remotes.set(event.identity, {
          ...p,
          isMuted: event.muted,
          isSpeaking: event.muted ? false : p.isSpeaking,
          audioLevel: event.muted ? 0 : p.audioLevel,
        });
        this.refreshParticipants();
        break;
      }

      case 'speaking':
        this.applySpeakingReport(event.speakers);
        break;

      case 'audioRouteChanged':
        // الغرف تفضّل مكبّر الصوت دائماً — لو انقلب المسار لسماعة الأذن
        // نعيد فرضه (سماعات الرأس/البلوتوث أولويتها أعلى فلا تتأثر)
        if (event.route === AUDIO_ROUTE_EARPIECE) {
          agoraEngine.setSpeakerphone(true);
        }
        break;

      default:
        // tokenWillExpire/tokenRequired يعالجهما attachTokenRenewal
        break;
    }
  }

  /**
   * تقرير مستوى الصوت → تحديث المتحدثين — نظير مؤقّت المرجع.
   * Agora v4 يطلق كل ~200ms نداءين مستقلين: تقرير المحلي (uid=0 وحده)
   * وتقرير أعلى 3 متحدثين بعيدين — كل فئة تُحدَّث من تقريرها فقط، وإلا
   * صفّر كلُّ تقرير مستوياتِ الفئة الأخرى فرمش مؤشر التحدث (~10 إصدارات/ث).
   */
  private applySpeakingReport(speakers: AgoraSpeakerInfo[]): void {
    const levels = new Map<string, number>();
    for (const s of speakers) levels.set(s.identity, s.level);

    // المستوى المحلي يُحدَّث فقط إن ورد في هذا التقرير (لا يُصفَّر من تقرير البعيدين)
    if (this.localIdentity && levels.has(this.localIdentity)) {
      this.localLevel = levels.get(this.localIdentity) ?? 0;
    }

    // تقرير المحلي وحده (غير فارغ وكل هوياته محلية) لا يمسّ البعيدين؛
    // التقرير الفارغ تقريرُ بعيدين صامتون — يصفّرهم جميعاً كما يجب
    const localOnly =
      speakers.length > 0 &&
      speakers.every((s) => s.identity === this.localIdentity);
    if (!localOnly) {
      this.remotes.forEach((p, identity) => {
        const level = levels.get(identity) ?? 0;
        const speaking = !p.isMuted && level >= SPEAKING_THRESHOLD;
        if (p.audioLevel !== level || p.isSpeaking !== speaking) {
          this.remotes.set(identity, { ...p, audioLevel: level, isSpeaking: speaking });
        }
      });
    }
    this.refreshParticipants(true);
  }

  // ==================== كتم السماع ====================

  /** أمر محرك واحد — لا مؤقتات إعادة تطبيق (المحرك يطبّقها على المسارات اللاحقة) */
  private applyRemoteMuted(): void {
    agoraEngine.setAllRemoteMuted(this.remoteAudioMuted);
  }

  setRemoteAudioMuted(muted: boolean): void {
    this.remoteAudioMuted = muted;
    // كتم صوت الروم يشمل موسيقى الروم المشتركة — تُشغَّل محلياً عبر expo-av
    // لا عبر المحرك، فكانت تبقى مسموعة رغم كتم الروم (نفس نقل المرجع)
    void import('@/services/roomMusicPlaybackManager')
      .then((m) => m.roomMusicPlaybackManager.setMutedAll(muted))
      .catch(() => {});
    // ويشمل المؤثرات الصوتية وأصوات الهدايا المحلية (expo-av)
    setRoomSfxMuted(muted);
    this.applyRemoteMuted();
  }

  /** إعادة تطبيق مستوى السماع — بعد دخول عضو أو عودة الاتصال */
  resyncRemoteAudio(): void {
    this.applyRemoteMuted();
  }

  // ==================== حراسة كتم المقعد (منقولة حرفياً من المرجع) ====================

  /** هل كتمني مشرف/وكيل؟ (لا يمكن فك الكتم ذاتياً) */
  isSeatAdminMuted(): boolean {
    return this.seatAdminMuted;
  }

  /**
   * مراقبة مقعدي في RTDB وفرض علامة الكتم على المحرك فعلياً.
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

  // ==================== الاتصال ====================

  async connect(roomName: string, canPublish: boolean, peerUid?: string): Promise<void> {
    if (!roomName) return;

    // idempotent لنفس الغرفة ونفس الصلاحية (نمط المرجع)
    if (this.isConnectedTo(roomName) && this.canPublish === canPublish) {
      this.applyRemoteMuted();
      return;
    }

    if (this.connectPromise) {
      await this.connectPromise.catch(() => {});
      if (this.isConnectedTo(roomName) && this.canPublish === canPublish) {
        this.applyRemoteMuted();
        return;
      }
    }

    // نفس الغرفة وتغيّرت صلاحية النشر فقط — تبديل دور بلا إعادة اتصال
    // (التحسين الجوهري على LiveKit: لا disconnectFast + reconnect)
    this.connectPromise = this.isConnectedTo(roomName)
      ? this.switchRole(canPublish, peerUid)
      : this.connectInternal(roomName, canPublish, peerUid);
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  /**
   * الجلوس/النزول عن المقعد على القناة نفسها:
   * ترقية = توكن PUBLISHER جديد → renewToken → دور broadcaster؛
   * نزول = كتم ثم دور audience.
   */
  private async switchRole(canPublish: boolean, peerUid?: string): Promise<void> {
    const gen = this.connectGeneration;
    const roomName = this.roomName;
    try {
      if (canPublish) {
        if (Date.now() - micPermissionDeniedAt < 15_000) {
          this.error =
            'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
          this.emit();
          return;
        }
        const granted = await requestCallPermissions('audio');
        if (gen !== this.connectGeneration || this.roomName !== roomName) return;
        if (!granted) {
          micPermissionDeniedAt = Date.now();
          this.error =
            'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
          this.emit();
          return;
        }
        const fresh = await getAgoraTokenCached(roomName, true, peerUid ?? this.peerUid);
        if (gen !== this.connectGeneration || this.roomName !== roomName) return;
        agoraEngine.renewToken(fresh.token);
        agoraEngine.setRole('broadcaster');
        this.canPublish = true;
        // المايك يبدأ مفتوحاً عند الجلوس — مزامنة المقعد من RTDB تصححه إن كان مكتوماً
        const muted = this.micMutedPreference ?? false;
        this.micMutedPreference = null;
        agoraEngine.setMicMuted(muted);
        this.isMuted = muted;
      } else {
        agoraEngine.setMicMuted(true);
        agoraEngine.setRole('audience');
        this.canPublish = false;
        this.isMuted = true;
        this.localLevel = 0;
        this.micMutedPreference = null;
      }
      // إعادة ربط التجديد بصلاحية النشر الجديدة (توكن التجديد الصحيح)
      this.attachRenewal(gen);
      this.error = null;
      this.refreshParticipants();
    } catch (e) {
      if (gen !== this.connectGeneration) return;
      // فشلت الترقية (توكن) — نبقى مستمعين متصلين بدل إسقاط الجلسة
      this.error =
        e instanceof Error && e.message ? e.message : 'تعذّر فتح المايك — أعد المحاولة';
      this.emit();
    }
  }

  private async connectInternal(
    roomName: string,
    canPublish: boolean,
    peerUid?: string,
  ): Promise<void> {
    if (this.roomName || this.connectionState === 'connected') {
      await this.disconnectFast();
    }

    const gen = ++this.connectGeneration;

    try {
      this.connectionState = 'connecting';
      this.error = null;
      this.emit();

      // تهدئة طلب إذن الميكروفون — نفس حماية المرجع من وميض التنبيه
      if (canPublish && Date.now() - micPermissionDeniedAt < 15_000) {
        this.error =
          'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
        this.connectionState = 'error';
        this.emit();
        return;
      }

      const tokenPromise = getAgoraTokenCached(roomName, canPublish, peerUid);
      const micGranted = canPublish ? await requestCallPermissions('audio') : true;
      if (gen !== this.connectGeneration) return;
      if (canPublish && !micGranted) {
        micPermissionDeniedAt = Date.now();
        this.error =
          'يجب السماح بالميكروفون للتحدّث — فعِّله من إعدادات الجهاز ثم أعد المحاولة';
        this.connectionState = 'error';
        this.emit();
        return;
      }

      const tokenResult = await tokenPromise;
      if (gen !== this.connectGeneration) return;

      this.roomName = roomName;
      this.canPublish = canPublish;
      this.peerUid = peerUid;
      this.localIdentity = tokenResult.identity;
      this.remotes.clear();
      this.pendingRemoteMuted.clear();
      this.localLevel = 0;

      // الاشتراك بأحداث المحرك قبل الانضمام — لا يفوتنا مشارك انضم مبكراً
      this.attachEngineEvents(gen);

      // بروفايل صوت الغرف قبل الانضمام (جودة موسيقية + سيناريو غرف دردشة)
      await agoraEngine.ensureEngine(tokenResult.appId);
      agoraEngine.setAudioProfileForRooms();

      // سلّم النقل: مباشر → UDP proxy → TCP proxy (نظير relay fallback)
      await joinWithTransportLadder({
        appId: tokenResult.appId,
        token: tokenResult.token,
        channel: roomName,
        identity: tokenResult.identity,
        role: canPublish ? 'broadcaster' : 'audience',
      });
      if (gen !== this.connectGeneration) return;

      this.sessionEstablished = true;

      // تجديد التوكن تلقائياً + إعادة انضمام كاملة عند انتهائه الفعلي
      this.attachRenewal(gen);

      // الغرف تفضّل مكبّر الصوت دائماً (نظير applyBestAudioOutput/route watcher)
      agoraEngine.setSpeakerphone(true);

      // فرض كتم المقعد من RTDB على مستوى الجلسة — يعمل حتى مع تصغير الروم
      this.startSeatMuteWatch(roomName);

      // (الموضع 1 — نظير RoomEvent.Connected): علم الجلسة الصوتية قبل أي
      // موسيقى/مؤثرات، وإلا يقتل وضعُ الصوت الافتراضي مايكَ الـDJ
      this.connectionState = 'connected';
      setRoomVoiceSessionActive(true);
      void configureSoundEffectsAudio();
      this.applyRemoteMuted();

      if (canPublish) {
        // المايك يبدأ مفتوحاً افتراضياً عند الجلوس على المقعد —
        // مزامنة Firebase ستعدّل الحالة إذا كان المقعد مكتوماً
        const muted = this.micMutedPreference ?? false;
        this.isMuted = muted;
        this.micMutedPreference = null;
        agoraEngine.setMicMuted(muted);
      } else {
        this.isMuted = true;
        agoraEngine.setMicMuted(true);
      }

      this.refreshParticipants();
    } catch (e) {
      if (gen !== this.connectGeneration) return;
      // (الموضع 4 — نظير catch في connectInternal المرجعي)
      setRoomVoiceSessionActive(false);
      this.error =
        e instanceof Error && e.message ? e.message : 'فشل الاتصال بالغرفة';
      this.connectionState = 'error';
      this.emit();
    }
  }

  /** ربط تجديد التوكن — tokenRequired يعني إعادة انضمام كاملة بتوكن جديد */
  private attachRenewal(gen: number): void {
    this.renewalDetach?.();
    this.renewalDetach = attachTokenRenewal(agoraEngine, {
      roomName: this.roomName,
      canPublish: this.canPublish,
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
      const roomName = this.roomName;
      const canPublish = this.canPublish;
      if (!roomName) return;
      const fresh = await getAgoraTokenCached(roomName, canPublish, this.peerUid, {
        forceFresh: true,
      });
      if (gen !== this.connectGeneration || this.roomName !== roomName) return;
      this.connectionState = 'connecting';
      this.emit();
      await agoraEngine.leaveChannel().catch(() => {});
      if (gen !== this.connectGeneration) return;
      await joinWithTransportLadder({
        appId: fresh.appId,
        token: fresh.token,
        channel: roomName,
        identity: fresh.identity,
        role: canPublish ? 'broadcaster' : 'audience',
      });
      if (gen !== this.connectGeneration) return;
      agoraEngine.setSpeakerphone(true);
      this.connectionState = 'connected';
      setRoomVoiceSessionActive(true);
      void configureSoundEffectsAudio();
      this.applyRemoteMuted();
      agoraEngine.setMicMuted(canPublish ? this.isMuted : true);
      this.error = null;
      this.refreshParticipants();
    } catch {
      if (gen !== this.connectGeneration) return;
      setRoomVoiceSessionActive(false);
      this.error = 'انقطع الاتصال الصوتي — أعد الدخول للغرفة';
      this.connectionState = 'error';
      this.emit();
    } finally {
      this.rejoinInFlight = false;
    }
  }

  // ==================== القطع ====================

  /** قطع سريع — للتنقل بين الرومات (لا يطفئ علم الجلسة؛ الاتصال التالي يعيده) */
  async disconnectFast(): Promise<void> {
    this.stopSeatMuteWatch();
    this.detachEngine();
    // كتم فوري قبل المغادرة — لا تسريب مايك/صوت أثناء الانتقال
    // (لا نمسّ تفضيل remoteAudioMuted — يُعاد تطبيقه بعد الاتصال الجديد)
    agoraEngine.setMicMuted(true);
    agoraEngine.setAllRemoteMuted(true);
    await agoraEngine.leaveChannel().catch(() => {});
    this.sessionEstablished = false;
    this.roomName = '';
    this.canPublish = false;
    this.isMuted = true;
    this.localIdentity = '';
    this.localLevel = 0;
    this.remotes.clear();
    this.pendingRemoteMuted.clear();
  }

  async disconnect(): Promise<void> {
    const gen = this.connectGeneration;
    this.stopSeatMuteWatch();
    this.detachEngine();
    agoraEngine.setMicMuted(true);
    agoraEngine.setAllRemoteMuted(true);
    await agoraEngine.leaveChannel().catch(() => {});
    if (gen !== this.connectGeneration) return; // اتصال جديد سبقنا — لا نمسّ حالته
    this.sessionEstablished = false;
    this.roomName = '';
    this.canPublish = false;
    this.isMuted = true;
    this.micMutedPreference = null;
    this.localIdentity = '';
    this.localLevel = 0;
    this.remotes.clear();
    this.pendingRemoteMuted.clear();
    // (الموضع 5 — نظير نهاية disconnect المرجعي بعد إيقاف جلسة الصوت)
    setRoomVoiceSessionActive(false);
    this.connectionState = 'disconnected';
    this.participants = [];
    this.emit();
    void stopRoomForegroundService();
  }

  // ==================== الكتم ====================

  private async waitForConnected(timeoutMs: number): Promise<void> {
    if (this.connectionState === 'connected') return;
    if (this.connectPromise) {
      await Promise.race([this.connectPromise.catch(() => {}), sleep(timeoutMs)]);
    }
  }

  /** تطبيق حالة المايك فعلياً — بدون فحص الكتم الإداري (للمزامنة الداخلية من RTDB) */
  private async applyMicMuted(muted: boolean): Promise<void> {
    this.micMutedPreference = muted;
    await this.waitForConnected(6000);
    if (this.connectionState !== 'connected') {
      this.isMuted = muted;
      this.emit();
      return;
    }
    if (!this.canPublish) {
      this.isMuted = true;
      this.emit();
      return;
    }
    // أمر واحد يغطي النشر والالتقاط — آمن التكرار، ولا حاجة لتحقق لاحق:
    // إعادة التطبيق عند reconnected تغطي أجهزة تعيد تفعيل المسار
    agoraEngine.setMicMuted(muted);
    this.isMuted = muted;
    // إيقاف الالتقاط قد يوقف تقارير المستوى المحلي — تصفير صريح كي لا
    // يتجمد المؤشر على آخر قيمة (تقرير البعيدين لم يعد يصفّره بعد إصلاح الوميض)
    if (muted) this.localLevel = 0;
    this.refreshParticipants();
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
    await this.waitForConnected(6000);
    if (this.connectionState !== 'connected' || !this.canPublish) return;
    agoraEngine.setMicMuted(false);
    this.isMuted = false;
    this.refreshParticipants();
  }

  // ==== تعليق صوت الروم أثناء مكالمة 1:1 (نفس منطق المرجع) ====
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

/**
 * تحميل مسبق عند فتح شاشة الروم — يدفّئ التوكن (كاش 4 دقائق) ويهيّئ
 * المحرك الأصلي (appId من رد التوكن) فيقصر زمن أول اتصال.
 */
export function prefetchAgoraRoomAudio(
  roomName: string,
  canPublish = false,
  peerUid?: string,
): void {
  if (!roomName) return;
  void getAgoraTokenCached(roomName, canPublish, peerUid)
    .then((res) => agoraEngine.ensureEngine(res.appId))
    .then(() => {})
    .catch(() => {});
}

/** جلسة الغرف عبر Agora — التوجيه إليها في roomAudioSession حصرياً */
export const agoraRoomSession = new AgoraRoomSessionManager();
