/**
 * مدير بث موسيقى الروم عبر خلط Agora — جهاز الـDJ حصرياً
 *
 * المعمارية: الموسيقى لم تعد تُشغَّل محلياً على كل جهاز (expo-av سابقاً) بل
 * تُخلط داخل فريمات مايك الـDJ المنشورة (startAudioMixing) فيسمعها كل من في
 * الغرفة من ستريم واحد متزامناً حكماً — المستمعون بلا أي كود تشغيل.
 *
 * عقدة RTDB rooms/{roomId}/music بقيت **لواجهة العرض فقط** (من يشغّل ماذا
 * وموضع التقدم عبر heartbeat كل 4 ثوانٍ) — لا يتغذّى منها أي مشغّل صوت.
 *
 * المدير يعيش على مستوى الخدمات (لا مع أي شاشة): يراقب عقدة الموسيقى بنفسه
 * ما دام الخلط حياً، فيستمر البث مع تصغير الروم («احتفظ») ويتوقف فور حذف
 * العقدة أياً كان مصدر الحذف، وينتقل للمقطع التالي عند انتهاء الحالي.
 */
import { agoraEngine, type AgoraRtcEvent } from '@/services/rtc/agoraEngine';
import {
  type RoomMusic,
  subscribeToRoomMusic,
  updateMusicPlayback,
  removeMusicFromRoom,
  calculateMusicTime,
  setMusicVolume,
} from './roomMusic';
import { advanceRoomMusicQueue } from './roomMusicQueue';
import { auth } from './firebase/index';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';

/** لقطة حالة الخلط — للـhooks (موضع/مدة/تشغيل على جهاز الـDJ) */
export interface RoomMusicMixSnapshot {
  /** خلط جارٍ على هذا الجهاز (أنا الـDJ) */
  active: boolean;
  roomId: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
}

/** إشعارات المدير للواجهة — المفاتيح تُترجم في الـhook (i18n) */
export type RoomMusicNotice =
  | 'unsupported-skipped'
  | 'playback-interrupted'
  | 'admin-stopped';

type Listener = () => void;
type NoticeListener = (notice: RoomMusicNotice) => void;

interface CurrentMix {
  roomId: string;
  url: string;
  addedAt: number;
  /** المصدر المحلول فعلياً (مسار جهاز أو https) — لإعادة البدء بعد rejoin */
  sourceUri: string;
  playing: boolean;
  positionMs: number;
  durationMs: number;
}

/** فاصل أدنى بين نداءي startAudioMixing — أقل من 500ms يرفضه SDK (702) */
const MIN_START_INTERVAL_MS = 600;
/** إيقاع تحديث الموضع محلياً (قراءة المحرك) */
const TICK_MS = 1000;
/** كل كم tick تُكتب نبضة المزامنة إلى RTDB (4 ثوانٍ) */
const HEARTBEAT_EVERY_TICKS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * حلّ مصدر الخلط: local://id → ملف الجهاز؛ https → النسخة المحلية إن وُجدت
 * (المحرك يقبل https مباشرة أيضاً)؛ null = الملف غير متاح على هذا الجهاز.
 */
async function resolveMixingSource(url: string): Promise<string | null> {
  try {
    const { isDeviceLocalMusicUrl, deviceMusicUrlToId, getDeviceMusicTrack } =
      await import('./roomMusicDeviceLibrary');
    if (isDeviceLocalMusicUrl(url)) {
      const trackId = deviceMusicUrlToId(url);
      const track = trackId ? await getDeviceMusicTrack(trackId) : null;
      if (track?.localUri) return track.localUri;
      // مقطع محلي لجهاز آخر (DJ سابق) — غير متاح هنا
      return track?.remoteUrl ?? null;
    }
    if (/^https?:\/\//.test(url)) {
      const { resolveLocalPlayableUri } = await import('./roomMusicLocal');
      return await resolveLocalPlayableUri(url);
    }
    return url || null;
  } catch {
    return url || null;
  }
}

class RoomMusicPlaybackManager {
  private current: CurrentMix | null = null;
  /** جيل الخلط — يُرفع مع كل بدء/إيقاف؛ استمرارات async قديمة تُهمل */
  private mixGen = 0;
  private lastStartAt = 0;
  /** مفتاح بدء جارٍ (roomId|url|addedAt) — hook والمراقب قد يطلبان نفس المقطع معاً */
  private startingKey: string | null = null;

  private musicWatchStop: (() => void) | null = null;
  private watchedRoomId: string | null = null;
  /** آخر عقدة موسيقى وصلت لمراقب الـDJ — لإعادة المزامنة بعد العودة لقناة الروم */
  private lastWatchedMusic: RoomMusic | null = null;

  /** مراقبة المستمع لعقدة الموسيقى — لاستعادة صوت الـDJ عند نهاية جلسته */
  private listenerWatchStop: (() => void) | null = null;
  private listenerWatchRoomId: string | null = null;
  /** هوية الـDJ الذي يطبَّق عليه خافض المستمع حالياً */
  private listenerDjIdentity: string | null = null;

  private engineUnsub: (() => void) | null = null;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  /** صوت الجمهور (النشر) 0..1 — يُزامَن مع music.volume في RTDB */
  private publishVolume01 = 1;
  /** «سماعي أنا» (playout المحلي للـDJ) 0..1 — محلي فقط */
  private playoutVolume01 = 1;
  /** كتم صوت الروم على هذا الجهاز — يصفّر playout الـDJ دون مسّ النشر */
  private roomMuted = false;
  private volumeWriteTimer: ReturnType<typeof setTimeout> | null = null;

  /** خافض «صوت الـDJ» عند المستمع — identity → 0..1 (يُعاد تطبيقه عند عودته) */
  private listenerVolumes = new Map<string, number>();

  private listeners = new Set<Listener>();
  /** مستمعو الإشعارات — يُبلَّغ الأحدث تسجيلاً فقط (الـhook قد يكون مركّباً مرتين) */
  private noticeListeners: NoticeListener[] = [];

  private snapshotCache: RoomMusicMixSnapshot = {
    active: false,
    roomId: null,
    playing: false,
    positionSec: 0,
    durationSec: 0,
  };

  // ==================== الاشتراك ====================

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RoomMusicMixSnapshot {
    return this.snapshotCache;
  }

  subscribeNotices(listener: NoticeListener): () => void {
    this.noticeListeners.push(listener);
    return () => {
      this.noticeListeners = this.noticeListeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const c = this.current;
    this.snapshotCache = {
      active: !!c,
      roomId: c?.roomId ?? null,
      playing: c?.playing ?? false,
      positionSec: (c?.positionMs ?? 0) / 1000,
      durationSec: (c?.durationMs ?? 0) / 1000,
    };
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {
        // مستمع معطوب لا يوقف البقية
      }
    });
  }

  private emitNotice(notice: RoomMusicNotice): void {
    const last = this.noticeListeners[this.noticeListeners.length - 1];
    try {
      last?.(notice);
    } catch {
      // ignore
    }
  }

  // ==================== أحداث المحرك ====================

  private ensureEngineSubscription(): void {
    if (this.engineUnsub) return;
    this.engineUnsub = agoraEngine.subscribe((e) => this.handleEngineEvent(e));
  }

  private handleEngineEvent(event: AgoraRtcEvent): void {
    switch (event.type) {
      case 'audioMixingStateChanged': {
        const c = this.current;
        if (!c) return;
        if (event.semantic === 'playing') {
          // بدأ العزف والمقصود «موقوف مؤقتاً» (بدء بمقطع متوقف — أمر الإيقاف
          // سبق جاهزية SDK) — أعد الإيقاف بدل قلب النية
          if (!c.playing) {
            agoraEngine.pauseAudioMixing();
            return;
          }
          const d = agoraEngine.getAudioMixingDuration();
          if (d > 0) c.durationMs = d;
          this.emit();
          return;
        }
        if (event.semantic === 'paused') {
          c.playing = false;
          this.emit();
          return;
        }
        if (event.semantic === 'failed') {
          // حارس الصيغ: canNotOpen (701) = تعذّر فتح الملف (opus/ogg أبرز
          // المرشحين) برسالة «صيغة غير مدعومة»؛ ما عداه (702 تكرار سريع/
          // 703 انقطاع تدفق https منتصف المقطع) انقطاعُ تشغيل لا عيبُ صيغة —
          // رسالته الصادقة مختلفة. الحالان يُتخطيان للمقطع التالي.
          const roomId = c.roomId;
          this.clearCurrent();
          this.emitNotice(
            event.canNotOpen ? 'unsupported-skipped' : 'playback-interrupted',
          );
          this.advanceAfterEnd(roomId);
          return;
        }
        // stopped: AllLoopsCompleted = نهاية طبيعية → التالية؛
        // StoppedByUser = نحن أوقفناه (تبديل/إيقاف) → لا شيء؛
        // غير ذلك = الخلط مات خارجياً (فقدان تركيز الصوت لفيديو هدية/مقاطعة
        // نظام) والنية «يعزف» — أعد البدء من آخر موضع وإلا بقيت الحبة «تعزف» صامتة
        if (event.semantic === 'stopped') {
          if (event.allLoopsCompleted) {
            const roomId = c.roomId;
            this.clearCurrent();
            this.advanceAfterEnd(roomId);
            return;
          }
          if (!event.stoppedByUser && this.isOnRoomChannel(c.roomId)) {
            void this.restartCurrentMix(c);
          }
          return;
        }
        return;
      }

      case 'connected': {
        // إعادة انضمام (تجديد توكن) تقتل الخلط داخل SDK — أعد بدءه من آخر
        // موضع، بشرط أن القناة المتصلة قناةُ الروم نفسها: قبول مكالمة 1:1
        // أثناء البث يُدخل المحرك المشترك قناةَ المكالمة (agoraCallSession)،
        // وإعادة البدء هناك كانت تخلط موسيقى الروم داخل مايك المكالمة الخاصة
        const c = this.current;
        if (c) {
          if (this.isOnRoomChannel(c.roomId)) void this.restartCurrentMix(c);
          return;
        }
        // لا خلط حياً لكن عقدة الـDJ ما زالت لي (بدء أُجهض أثناء مكالمة
        // عابرة) — العودة لقناة الروم تعيد المزامنة من آخر حالة معروفة
        const roomId = this.watchedRoomId;
        const music = this.lastWatchedMusic;
        if (roomId && music && this.isOnRoomChannel(roomId)) {
          this.syncDjBroadcast(roomId, music);
        }
        return;
      }

      case 'participantJoined': {
        // إعادة تطبيق خافض «صوت الـDJ» المحلي عند عودة/انضمام صاحبه
        const v = this.listenerVolumes.get(event.identity);
        if (v !== undefined) this.applyListenerVolume(event.identity, v);
        return;
      }

      default:
        return;
    }
  }

  // ==================== مراقبة عقدة الموسيقى (RTDB) ====================

  /**
   * تعيش المراقبة مع الخلط لا مع الشاشات: حذف العقدة (من أي طرف) يوقف
   * الخلط فوراً، وتبديل المقطع (advance) يعيد البدء — حتى والروم مصغّر.
   */
  private ensureMusicWatch(roomId: string): void {
    if (this.watchedRoomId === roomId) return;
    this.stopMusicWatch();
    this.watchedRoomId = roomId;
    this.musicWatchStop = subscribeToRoomMusic(roomId, (music) => {
      const myUid = auth.currentUser?.uid;
      if (!music || !myUid || music.addedBy !== myUid) {
        // أُزيلت العقدة أو صارت لغيري — أوقف خلطي وأبطل أي بدء جارٍ
        // (الطابور يبقى في RTDB). رفع mixGen واجب حتى وcurrent==null:
        // startTrack المعلّق (داخل resolveMixingSource/فاصل 600ms) كان
        // يكمل خلطاً شبحاً بلا عقدة، وadvanceAfterEnd في نهايته يُحيي
        // جلسةً أوقفها مشرف.
        this.lastWatchedMusic = null;
        if (this.isMixActiveFor(roomId)) this.stopLocalMix();
        if (!music) this.stopMusicWatch();
        return;
      }
      this.lastWatchedMusic = music;
      this.syncDjBroadcast(roomId, music);
    });
  }

  private stopMusicWatch(): void {
    this.musicWatchStop?.();
    this.musicWatchStop = null;
    this.watchedRoomId = null;
    this.lastWatchedMusic = null;
  }

  /** خلط حيّ أو بدء جارٍ لهذه الغرفة — الإيقافات القسرية تبطل الاثنين معاً */
  private isMixActiveFor(roomId: string): boolean {
    if (this.current?.roomId === roomId) return true;
    return this.startingKey?.startsWith(`${roomId}|`) === true;
  }

  /**
   * هل المحرك متصل الآن بقناة هذه الغرفة (room_{id})؟ — نفس المحرك
   * تستعمله مكالمات 1:1، والخلط على قناة مكالمة تسريبٌ لموسيقى الروم.
   */
  private isOnRoomChannel(roomId: string): boolean {
    return agoraEngine.getCurrentChannel() === `room_${roomId}`;
  }

  // ==================== بدء/مصالحة بث الـDJ ====================

  /**
   * نقطة الدخول الوحيدة لتشغيل الموسيقى — تُستدعى من hook الـDJ ومن مراقب
   * العقدة. idempotent: نفس المقطع (url+addedAt) → مصالحة حالة فقط.
   */
  syncDjBroadcast(roomId: string, music: RoomMusic): void {
    const myUid = auth.currentUser?.uid;
    if (!roomId || !music?.url || !myUid || music.addedBy !== myUid) return;
    this.ensureEngineSubscription();
    this.ensureMusicWatch(roomId);

    const key = `${roomId}|${music.url}|${music.addedAt}`;
    const c = this.current;
    const same =
      c && c.roomId === roomId && c.url === music.url && c.addedAt === music.addedAt;
    if (!same) {
      if (this.startingKey === key) return; // نفس البدء جارٍ من مصدر آخر
      void this.startTrack(roomId, music, key);
      return;
    }
    // مصالحة: كاتب هذه الحقول هو هذا الجهاز نفسه — التطبيق آمن التكرار
    if (music.isPlaying !== c.playing) {
      if (music.isPlaying) agoraEngine.resumeAudioMixing();
      else agoraEngine.pauseAudioMixing();
      c.playing = music.isPlaying;
      this.emit();
    }
    const vol = clamp01(music.volume ?? 0.4);
    if (vol !== this.publishVolume01) {
      this.publishVolume01 = vol;
      agoraEngine.adjustAudioMixingPublishVolume(vol * 100);
    }
  }

  private async startTrack(
    roomId: string,
    music: RoomMusic,
    key: string,
  ): Promise<void> {
    const gen = ++this.mixGen;
    this.startingKey = key;
    // موضع البدء من حالة RTDB (0 لمقطع جديد؛ استئناف لو عاد الـDJ لجلسة حيّة)
    const startPosMs = Math.max(0, Math.round(calculateMusicTime(music) * 1000));

    const sourceUri = await resolveMixingSource(music.url);
    if (gen !== this.mixGen) return;
    if (!sourceUri) {
      // ملف محلي غير موجود على هذا الجهاز — عامله كفشل فتح: إشعار + تخطٍّ
      this.startingKey = null;
      this.emitNotice('unsupported-skipped');
      this.advanceAfterEnd(roomId);
      return;
    }

    // فاصل أدنى بين بدأين — أقل من 500ms يرفضه المحرك (TooFrequentCall)
    const wait = this.lastStartAt + MIN_START_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
      if (gen !== this.mixGen) return;
    }

    // حارس القناة: لو دخل المحرك قناة مكالمة أثناء التحضير لا نبدأ الخلط
    // هناك (تسريب للمكالمة الخاصة) — العودة لقناة الروم تعيد المزامنة
    // من مراقب العقدة (حدث connected)
    if (!this.isOnRoomChannel(roomId)) {
      this.startingKey = null;
      return;
    }
    this.lastStartAt = Date.now();

    const ok = agoraEngine.startAudioMixing(sourceUri, {
      loopback: false,
      cycle: 1,
      startPosMs,
    });
    if (gen !== this.mixGen) {
      // بدء أحدث تجاوزنا — لا نمسّ مفتاحه، ونوقف ما بدأناه نحن إن بدأ
      if (ok) agoraEngine.stopAudioMixing();
      return;
    }
    this.startingKey = null;
    if (!ok) {
      this.emitNotice('unsupported-skipped');
      this.advanceAfterEnd(roomId);
      return;
    }

    this.current = {
      roomId,
      url: music.url,
      addedAt: music.addedAt,
      sourceUri,
      playing: music.isPlaying !== false,
      positionMs: startPosMs,
      durationMs: Math.max(0, Math.round((music.duration ?? 0) * 1000)),
    };
    this.publishVolume01 = clamp01(music.volume ?? 0.4);
    agoraEngine.adjustAudioMixingPublishVolume(this.publishVolume01 * 100);
    this.applyPlayoutVolume();
    if (music.isPlaying === false) agoraEngine.pauseAudioMixing();
    this.ensureTick();
    this.emit();
  }

  /** إعادة بدء الخلط بعد إعادة انضمام (leaveChannel يقتله داخل SDK) */
  private async restartCurrentMix(c: CurrentMix): Promise<void> {
    const gen = this.mixGen;
    const wait = this.lastStartAt + MIN_START_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    if (gen !== this.mixGen || this.current !== c) return;
    // القناة قد تكون تبدلت لمكالمة أثناء الانتظار — لا خلط خارج قناة الروم
    if (!this.isOnRoomChannel(c.roomId)) return;
    this.lastStartAt = Date.now();
    const ok = agoraEngine.startAudioMixing(c.sourceUri, {
      loopback: false,
      cycle: 1,
      startPosMs: c.positionMs,
    });
    if (!ok) return;
    agoraEngine.adjustAudioMixingPublishVolume(this.publishVolume01 * 100);
    this.applyPlayoutVolume();
    if (!c.playing) agoraEngine.pauseAudioMixing();
  }

  /** انتهى المقطع (طبيعياً أو بفشل) — التالية من الطابور أو مسح العقدة */
  private advanceAfterEnd(roomId: string): void {
    void import('@/utils/roomMediaPickerGuard').then(({ extendRoomMediaPickerGuard }) => {
      extendRoomMediaPickerGuard();
    }).catch(() => {});
    advanceRoomMusicQueue(roomId)
      .then((advanced) => {
        if (!advanced) return removeMusicFromRoom(roomId).catch(() => {});
        return undefined;
      })
      .catch(() => {
        void updateMusicPlayback(roomId, { isPlaying: false }).catch(() => {});
      });
  }

  // ==================== الموضع + نبضة المزامنة ====================

  private ensureTick(): void {
    if (this.tickTimer) return;
    this.tickCount = 0;
    this.tickTimer = setInterval(() => this.onTick(), TICK_MS);
  }

  private clearTick(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.tickCount = 0;
  }

  private onTick(): void {
    const c = this.current;
    if (!c) {
      this.clearTick();
      return;
    }
    if (c.playing) {
      const pos = agoraEngine.getAudioMixingCurrentPosition();
      if (pos >= 0) c.positionMs = pos;
      if (c.durationMs <= 0) {
        const d = agoraEngine.getAudioMixingDuration();
        if (d > 0) c.durationMs = d;
      }
      this.emit();
    }
    this.tickCount += 1;
    if (this.tickCount % HEARTBEAT_EVERY_TICKS !== 0) return;
    // نبضة RTDB كل 4 ثوانٍ — واجهة العرض عند الجميع (calculateMusicTime تنعّمها)
    void updateMusicPlayback(c.roomId, {
      currentTime: c.positionMs / 1000,
      isPlaying: c.playing,
      duration: c.durationMs > 0 ? c.durationMs / 1000 : undefined,
    }).catch(() => {});
  }

  // ==================== أوامر الـDJ ====================

  /** تشغيل/إيقاف مؤقت — يطبّق على المحرك فوراً ثم يوثّق في RTDB للعرض */
  async togglePlay(roomId: string): Promise<void> {
    const c = this.current;
    if (!c || c.roomId !== roomId) return;
    const next = !c.playing;
    if (next) agoraEngine.resumeAudioMixing();
    else agoraEngine.pauseAudioMixing();
    c.playing = next;
    this.emit();
    await updateMusicPlayback(roomId, {
      isPlaying: next,
      currentTime: c.positionMs / 1000,
    }).catch(() => {});
  }

  /** قفزة لموضع (ثوانٍ) — محرك فوراً + توثيق RTDB */
  async seekTo(roomId: string, seconds: number): Promise<void> {
    const c = this.current;
    if (!c || c.roomId !== roomId) return;
    const ms = Math.max(0, Math.round(seconds * 1000));
    agoraEngine.setAudioMixingPosition(ms);
    c.positionMs = ms;
    this.emit();
    await updateMusicPlayback(roomId, { currentTime: seconds }).catch(() => {});
  }

  /** «صوت الجمهور» (النشر) — محرك فوراً + كتابة RTDB بـdebounce 250ms */
  setPublishVolume(roomId: string, volume01: number): void {
    const v = clamp01(volume01);
    this.publishVolume01 = v;
    agoraEngine.adjustAudioMixingPublishVolume(v * 100);
    if (this.volumeWriteTimer) clearTimeout(this.volumeWriteTimer);
    this.volumeWriteTimer = setTimeout(() => {
      void setMusicVolume(roomId, v).catch(() => {});
    }, 250);
  }

  /** «سماعي أنا» (playout الـDJ) — محلي بحت، لا يمسّ ما يسمعه الجمهور */
  setPlayoutVolume(volume01: number): void {
    this.playoutVolume01 = clamp01(volume01);
    this.applyPlayoutVolume();
  }

  getPlayoutVolume(): number {
    return this.playoutVolume01;
  }

  private applyPlayoutVolume(): void {
    agoraEngine.adjustAudioMixingPlayoutVolume(
      this.roomMuted ? 0 : this.playoutVolume01 * 100,
    );
  }

  /**
   * كتم صوت الروم على هذا الجهاز (زر كتم السماع) — للمستمعين يغطيه
   * setAllRemoteMuted في جلسة الصوت؛ هنا نصفّر سماع الـDJ نفسه للموسيقى
   * (playout) مع استمرار النشر للجمهور كما هو.
   */
  setMutedAll(muted: boolean): void {
    this.roomMuted = muted;
    this.applyPlayoutVolume();
  }

  // ==================== خافض المستمع «صوت الـDJ» ====================

  /**
   * الخافض المحلي عند المستمع — يخفض كلام الـDJ وموسيقاه معاً (ستريم واحد).
   * يُحفظ ويُعاد تطبيقه إذا خرج الـDJ وعاد (uid رقمي جديد)، ويُستعاد كاملاً
   * (100) فور انتهاء جلسته (حذف عقدة music أو تغيّر الـDJ) — وإلا بقي كلامُ
   * الـDJ مكتوماً نهائياً بعد توقف الموسيقى (زر X للمستمع يصفّر الخافض).
   */
  setListenerDjVolume(roomId: string, djIdentity: string, volume01: number): void {
    if (!djIdentity) return;
    // تغيّر الـDJ من تحت الواجهة — استعد صوت السابق قبل تطبيق الجديد
    if (this.listenerDjIdentity && this.listenerDjIdentity !== djIdentity) {
      this.restoreListenerVolumes();
    }
    const v = clamp01(volume01);
    this.listenerDjIdentity = djIdentity;
    this.listenerVolumes.set(djIdentity, v);
    this.ensureEngineSubscription();
    this.applyListenerVolume(djIdentity, v);
    if (roomId) this.ensureListenerWatch(roomId);
  }

  /**
   * تعيش المراقبة مع الخافض لا مع الشاشات (الواجهة قد تكون مخفاة محلياً —
   * dismissLocally يفكّ تركيب الـhook): حذف العقدة أو تغيّر الـDJ يستعيد
   * صوته كاملاً ويصفّر القيمة المخزنة — الخافض خاص بالجلسة لا بالمستخدم،
   * فأي جلسة موسيقى لاحقة تبدأ مسموعة.
   */
  private ensureListenerWatch(roomId: string): void {
    if (this.listenerWatchRoomId === roomId) return;
    this.stopListenerWatch();
    this.listenerWatchRoomId = roomId;
    this.listenerWatchStop = subscribeToRoomMusic(roomId, (music) => {
      const dj = this.listenerDjIdentity;
      if (!dj) return;
      if (!music || music.addedBy !== dj) {
        this.restoreListenerVolumes();
        const ui = useRoomMusicUiStore.getState();
        ui.setLocalListenerVolume(1);
        // الإخفاء المحلي (زر X) خاص بالجلسة هو الآخر — بدون فكّه هنا كانت
        // أي جلسة لاحقة تبدأ بلا أي واجهة (البابل/الشيت مشروطان به) ولا
        // يملك المستمع أي مقبض لإظهارها سوى التصغير/التثبيت
        ui.resetDismiss();
        this.stopListenerWatch();
      }
    });
  }

  private stopListenerWatch(): void {
    this.listenerWatchStop?.();
    this.listenerWatchStop = null;
    this.listenerWatchRoomId = null;
  }

  /** استعادة صوت الـDJ (وأي خافضات سابقة) إلى 100 وإفراغها */
  private restoreListenerVolumes(): void {
    this.listenerVolumes.forEach((_v, identity) => {
      this.applyListenerVolume(identity, 1);
    });
    this.listenerVolumes.clear();
    this.listenerDjIdentity = null;
  }

  private applyListenerVolume(identity: string, volume01: number): void {
    const uid = agoraEngine.numericUidFor(identity);
    if (uid === null || uid === 0) return; // المحلي/غير معروف بعد — عند انضمامه
    agoraEngine.adjustUserPlaybackSignalVolume(uid, volume01 * 100);
  }

  // ==================== إيقافات قسرية ====================

  /** كتمني مشرف/وكيل (mutedBy غيري) — إيقاف البث ومسح العقدة + إشعار */
  handleAdminMuteStop(roomId: string): void {
    // يشمل البدء الجاري (current==null بعدُ) — انظر تعليق مراقب العقدة
    if (!this.isMixActiveFor(roomId)) return;
    this.stopLocalMix();
    this.emitNotice('admin-stopped');
    void removeMusicFromRoom(roomId).catch(() => {});
  }

  /** نزلتُ عن المقعد/أُنزلت — إيقاف فوري ومسح العقدة؛ الطابور يبقى في RTDB */
  handleOffSeatStop(roomId: string): void {
    if (!this.isMixActiveFor(roomId)) return;
    this.stopLocalMix();
    void removeMusicFromRoom(roomId).catch(() => {});
  }

  /** إيقاف الخلط المحلي فقط — لا يمسّ RTDB (مراقب العقدة/المستدعي يتولاها) */
  private stopLocalMix(): void {
    // رفع الجيل يبطل أيضاً بدءاً جارياً لم يعيّن current بعد — ومسح مفتاحه
    // آمن هنا: أي بدء أحدث يرفع الجيل ويعيّن مفتاحه بعد هذا السطر حكماً
    this.mixGen++;
    this.startingKey = null;
    agoraEngine.stopAudioMixing();
    this.clearTick();
    this.clearCurrent();
  }

  private clearCurrent(): void {
    this.current = null;
    this.clearTick();
    this.emit();
  }

  /** إيقاف كل شيء — مغادرة الروم/تنظيف (نظير stopAll في محرك expo-av السابق) */
  async stopAll(): Promise<void> {
    this.stopMusicWatch();
    this.stopListenerWatch();
    if (this.volumeWriteTimer) {
      clearTimeout(this.volumeWriteTimer);
      this.volumeWriteTimer = null;
    }
    // استعادة صوت الـDJ قبل المغادرة وتصفير القيمة المخزنة — كانت تبقى 0
    // عبر الغرف والجلسات فتبدأ أي موسيقى لاحقة صامتة دون علم المستخدم
    if (this.listenerVolumes.size) {
      this.restoreListenerVolumes();
      useRoomMusicUiStore.getState().setLocalListenerVolume(1);
    }
    if (this.current || this.startingKey) this.stopLocalMix();
  }
}

export const roomMusicPlaybackManager = new RoomMusicPlaybackManager();

/** إيقاف فوري لموسيقى الروم — يُستدعى عند مغادرة الغرفة قبل إلغاء mount المكوّن */
export function stopRoomMusicPlayback(): Promise<void> {
  return roomMusicPlaybackManager.stopAll();
}
