/**
 * تشغيل مؤثر صوتي محلي عبر expo-av — هدايا الروم، دخول SVIP، مؤثرات
 */
type AVModule = typeof import('expo-av');
type Sound = import('expo-av').Audio.Sound;

let avModule: AVModule | null = null;
let activeSound: Sound | null = null;
let activeGiftSoundUrl: string | null = null;
/** مفتاح مؤثر الأصول النشط — لإعادته للكاش عند المقاطعة بدل تسريبه */
let activeAssetKey: string | null = null;
let audioModeConfigured = false;

/**
 * طابور تسلسلي لكل عمليات expo-av: التحميل/التشغيل المتوازي كان يسبّب
 * تداخل الحالة (صوت يقاطع آخر فيتسرّب MediaPlayer) وخلط الأصوات على أندرويد.
 * ملاحظة: الدوال الداخلية فقط تدخل الطابور — لا تعشيش (deadlock).
 */
let sfxOpQueue: Promise<unknown> = Promise.resolve();
function enqueueSfxOp<T>(op: () => Promise<T>): Promise<T> {
  const run = sfxOpQueue.then(op, op);
  sfxOpQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * جيل الإيقاف: stopRoomSound يرفعه فوراً (قبل دخول الطابور) — أي تشغيل
 * أُدرج بالطابور قبل الرفع يُسقط نفسه عند وصول دوره. بدونه كانت التشغيلات
 * المتراكمة خلف عملية expo-av معلّقة تنفجر دفعة واحدة بعد مغادرة الروم.
 */
let sfxEpoch = 0;

/**
 * مهلة لاستدعاءات expo-av داخل الطابور — stopAsync/createAsync قد يعلّقان
 * أثناء استحواذ جلسة الصوت (Agora) على تركيز الصوت (أندرويد) فيتجمد الطابور كله.
 * عند تجاوز المهلة نرفض ونكمل؛ onLateResolve تنظّف الناتج المتأخر إن وصل.
 */
const SFX_OP_TIMEOUT_MS = 4000;
function withSfxTimeout<T>(p: Promise<T>, onLateResolve?: (v: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('sfx-op-timeout'));
    }, SFX_OP_TIMEOUT_MS);
    p.then(
      (v) => {
        if (settled) {
          onLateResolve?.(v);
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
/** تهيئة الصوت أثناء جلسة صوت الغرفة — MixWithOthers حتى تُسمع المؤثرات مع المايك */
let voiceSfxAudioConfigured = false;
/** true أثناء جلسة صوت الغرفة */
let roomVoiceSessionActive = false;

/** أصوات الهدايا المحمّلة مسبقاً — تُعاد للكاش بعد التشغيل لإعادة تشغيل فورية */
const preloadedSounds = new Map<string, Sound>();
/** مؤثرات الغرفة المحلية (require) */
const preloadedAssetSounds = new Map<string, Sound>();

/**
 * كتم المؤثرات المحلية (مؤثرات الغرفة + أصوات الهدايا) — يتبع كتم الروم الكلي.
 * كان كتم الروم يكتم أعضاء الغرفة والموسيقى فقط بينما المؤثرات تستمر بالصوت الكامل.
 */
let roomSfxMuted = false;

export function setRoomSfxMuted(muted: boolean): void {
  roomSfxMuted = muted;
  if (muted && activeSound && roomVoiceSessionActive) {
    // اكتم الصوت الجاري فوراً — لا ننتظر انتهاءه
    activeSound.setVolumeAsync(0).catch(() => {});
  }
}

export function isRoomSfxMuted(): boolean {
  return roomSfxMuted;
}

export function setRoomVoiceSessionActive(active: boolean): void {
  roomVoiceSessionActive = active;
  if (!active) {
    voiceSfxAudioConfigured = false;
    audioModeConfigured = false;
  }
}

export function isRoomVoiceSessionActive(): boolean {
  return roomVoiceSessionActive;
}

async function getAV(): Promise<AVModule> {
  if (!avModule) {
    avModule = await import('expo-av');
  }
  return avModule;
}

export async function configureSoundEffectsAudio(force = false): Promise<void> {
  const AV = await getAV();

  if (roomVoiceSessionActive) {
    // force: مكوّنات أخرى (فيديو الدخولية/مسجّل الصوت) قد تكون بدّلت وضع الصوت
    // بعد التهيئة — إعادة تأكيد وضع الخلط قبل بدء الموسيقى حتى لا يُقتل المايك
    if (voiceSfxAudioConfigured && !force) return;
    try {
      await AV.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // مع جلسة الغرفة: الصوت يستمر بالخلفية (UIBackgroundModes audio على iOS
        // وخدمة foreground على أندرويد) — false كانت توقف الموسيقى/تُسقط تركيز
        // الصوت عند إرسال التطبيق للخلفية أثناء البث
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: AV.InterruptionModeIOS.MixWithOthers,
        // لا نقاطع صوت الغرفة (Agora) عند تشغيل مؤثرات محلية.
        interruptionModeAndroid: AV.InterruptionModeAndroid.DuckOthers,
      });
      voiceSfxAudioConfigured = true;
    } catch {
      // ignore
    }
    return;
  }

  if (audioModeConfigured && !force) return;
  try {
    await AV.Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: AV.InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: AV.InterruptionModeAndroid.DuckOthers,
    });
    audioModeConfigured = true;
  } catch {
    // ignore
  }
}

/** تهيئة مسبقة عند دخول الروم — يحمّل expo-av فقط إن كانت جلسة الصوت نشطة */
export async function warmGiftSoundEngine(): Promise<void> {
  await getAV();
  if (!roomVoiceSessionActive) {
    await configureSoundEffectsAudio();
  }
}

/** تهيئة الصوت لتشغيل فيديو الدخولية (يُسمع حتى في وضع الصامت على iOS) */
export async function configureVideoPlaybackAudio(): Promise<void> {
  const AV = await getAV();

  // أثناء جلسة صوت الغرفة لا نطفئ التسجيل — allowsRecordingIOS: false يقلب
  // فئة AVAudioSession من PlayAndRecord فيُقتل مايك جلسة الصوت لمن هو على المقعد
  // (دخولية مستخدم تُطفئ مايك المتحدثين). نعيد تأكيد وضع الخلط بدلاً منه.
  if (roomVoiceSessionActive) {
    await configureSoundEffectsAudio(true);
    return;
  }

  try {
    await AV.Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    // وضع مختلف عن وضع المؤثرات — الاستدعاء القادم لوضع المؤثرات يعيد التهيئة
    audioModeConfigured = false;
  } catch {
    // ignore
  }
}

function rememberInPreloadCache(key: string, sound: Sound): void {
  const existing = preloadedSounds.get(key);
  if (existing && existing !== sound) {
    existing.unloadAsync().catch(() => {});
  }
  preloadedSounds.set(key, sound);
}

function attachFinishHandler(sound: Sound, key: string): void {
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      // أوقف ثم أعد الموضع — الاكتفاء بـsetPositionAsync(0) يُبقي shouldPlay=true
      // فيُعيد التشغيل بلا نهاية (didJustFinish يتكرر). نفس نمط VoiceMessagePlayer.
      sound.stopAsync().then(() => sound.setPositionAsync(0)).catch(() => {});
      if (activeSound === sound) {
        activeSound = null;
        activeGiftSoundUrl = null;
      }
      rememberInPreloadCache(key, sound);
    }
  });
}

async function pauseActiveGiftSound(): Promise<void> {
  if (!activeSound) return;
  const prevGiftKey = activeGiftSoundUrl;
  const prevAssetKey = activeAssetKey;
  const prevSound = activeSound;
  activeSound = null;
  activeGiftSoundUrl = null;
  activeAssetKey = null;
  try {
    await withSfxTimeout(prevSound.stopAsync());
    await withSfxTimeout(prevSound.setPositionAsync(0));
    if (prevGiftKey) {
      rememberInPreloadCache(prevGiftKey, prevSound);
    } else if (prevAssetKey) {
      // مقاطعة مؤثر أصول: أعده للكاش — كان يتسرّب MediaPlayer مع كل مقاطعة
      // حتى تتوقف الأصوات كلياً بعد فترة (التهنيج داخل الجلسة)
      const existing = preloadedAssetSounds.get(prevAssetKey);
      if (existing && existing !== prevSound) existing.unloadAsync().catch(() => {});
      prevSound.setOnPlaybackStatusUpdate(null);
      preloadedAssetSounds.set(prevAssetKey, prevSound);
    } else {
      prevSound.unloadAsync().catch(() => {});
    }
  } catch {
    if (!prevGiftKey) prevSound.unloadAsync().catch(() => {});
  }
}

async function cacheRemoteSound(url: string): Promise<void> {
  const key = url.trim();
  if (!key || preloadedSounds.has(key)) return;

  const AV = await getAV();
  await configureSoundEffectsAudio();

  // داخل الطابور: createAsync المتوازي يخلط المصادر على أندرويد
  try {
    const { sound } = await enqueueSfxOp(() =>
      withSfxTimeout(
        AV.Audio.Sound.createAsync(
          { uri: key },
          { shouldPlay: false, volume: 0.85, isLooping: false },
        ),
        (late) => late.sound.unloadAsync().catch(() => {}),
      ),
    );
    if (preloadedSounds.has(key)) {
      sound.unloadAsync().catch(() => {});
      return;
    }
    preloadedSounds.set(key, sound);
  } catch {
    // سيُحمَّل عند التشغيل
  }
}

export async function clearPreloadedSound(url?: string): Promise<void> {
  if (url) {
    const key = url.trim();
    const cached = preloadedSounds.get(key);
    preloadedSounds.delete(key);
    if (cached) {
      try {
        await cached.unloadAsync();
      } catch {
        // ignore
      }
    }
    return;
  }
  for (const [, sound] of preloadedSounds) {
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }
  preloadedSounds.clear();
}

/** تحميل مسبق عند اختيار الهدية — بدون تشغيل */
export async function preloadGiftSound(url: string): Promise<void> {
  await cacheRemoteSound(url);
}

/** @deprecated */
export async function preloadRemoteSound(url: string): Promise<void> {
  await preloadGiftSound(url);
}

/**
 * تشغيل صوت الهدية — يستخدم الكاش المحمّل مسبقاً ولا يُقطع عند انتهاء الأنيميشن
 */
export async function playGiftSound(url: string, volume = 0.85): Promise<void> {
  const key = url.trim();
  if (!key) return;

  // التقاط الجيل قبل الدخول للطابور — لو استُدعي stopRoomSound قبل وصول
  // الدور (مغادرة الروم) تُسقط العملية نفسها بدل أن تنفجر الأصوات دفعة واحدة
  const epoch = sfxEpoch;
  const AV = await getAV();
  await configureSoundEffectsAudio();
  return enqueueSfxOp(() => playGiftSoundInner(AV, key, volume, epoch));
}

async function playGiftSoundInner(
  AV: AVModule,
  key: string,
  volume: number,
  epoch: number,
): Promise<void> {
  if (epoch !== sfxEpoch) return; // أوقفت الجلسة بعد الإدراج — لا تشغيل
  // كتم الروم يشمل أصوات الهدايا المحلية — داخل جلسة روم حية فقط، حتى لا
  // يكتم علم كتمٍ قديم أصوات هدايا الشات خارج الغرف
  if (roomSfxMuted && roomVoiceSessionActive) return;
  if (activeGiftSoundUrl === key && activeSound) {
    try {
      await withSfxTimeout(activeSound.setPositionAsync(0));
      await withSfxTimeout(activeSound.setVolumeAsync(volume));
      await withSfxTimeout(activeSound.playAsync());
      return;
    } catch {
      // fall through to full reload
    }
  }

  if (activeSound && activeGiftSoundUrl !== key) {
    await pauseActiveGiftSound();
  }

  if (epoch !== sfxEpoch) return;
  const cached = preloadedSounds.get(key);
  if (cached) {
    preloadedSounds.delete(key);
    try {
      await withSfxTimeout(cached.setPositionAsync(0));
      await withSfxTimeout(cached.setVolumeAsync(volume));
      await withSfxTimeout(cached.playAsync());
      activeSound = cached;
      activeGiftSoundUrl = key;
      attachFinishHandler(cached, key);
      return;
    } catch {
      try {
        await cached.unloadAsync();
      } catch {
        // ignore
      }
    }
  }

  if (epoch !== sfxEpoch) return;
  const { sound } = await withSfxTimeout(
    AV.Audio.Sound.createAsync(
      { uri: key },
      { shouldPlay: true, volume, isLooping: false },
    ),
    (late) => late.sound.unloadAsync().catch(() => {}),
  );
  if (epoch !== sfxEpoch) {
    // أُوقفت الجلسة أثناء الإنشاء — أوقف وفرّغ بدل تركه يعزف
    sound.unloadAsync().catch(() => {});
    return;
  }
  activeSound = sound;
  activeGiftSoundUrl = key;
  attachFinishHandler(sound, key);
}

/** تحميل مسبق لمؤثر صوتي محلي (assets) */
export async function preloadRoomSoundAsset(cacheKey: string, source: number): Promise<void> {
  if (!cacheKey || preloadedAssetSounds.has(cacheKey)) return;
  const AV = await getAV();
  await configureSoundEffectsAudio();
  try {
    // داخل الطابور: التحميل المتوازي كان قد يخلط المصادر على أندرويد
    // (تضغط «تصفيق» فيطلع مؤثر آخر)
    const { sound } = await enqueueSfxOp(() =>
      withSfxTimeout(
        AV.Audio.Sound.createAsync(
          source,
          { shouldPlay: false, volume: 0.9, isLooping: false },
        ),
        (late) => late.sound.unloadAsync().catch(() => {}),
      ),
    );
    if (preloadedAssetSounds.has(cacheKey)) {
      sound.unloadAsync().catch(() => {});
      return;
    }
    preloadedAssetSounds.set(cacheKey, sound);
  } catch {
    // يُحمَّل عند التشغيل
  }
}

/** تحميل مسبق لكل مؤثرات الغرفة الجاهزة */
export async function warmRoomSoundEffectsCatalog(
  effects: ReadonlyArray<{ id: string; source: number }>,
): Promise<void> {
  await getAV();
  await configureSoundEffectsAudio();
  await Promise.all(effects.map((e) => preloadRoomSoundAsset(e.id, e.source)));
}

export async function playRoomSoundSource(
  source: number,
  volume = 0.9,
  cacheKey?: string,
): Promise<void> {
  const epoch = sfxEpoch;
  const AV = await getAV();
  await configureSoundEffectsAudio();
  return enqueueSfxOp(() => playRoomSoundSourceInner(AV, source, volume, epoch, cacheKey));
}

async function playRoomSoundSourceInner(
  AV: AVModule,
  source: number,
  volume: number,
  epoch: number,
  cacheKey?: string,
): Promise<void> {
  // مؤثرات الغرفة تعزف داخل جلسة صوت حية فقط — بعد المغادرة (تغيّر الجيل
  // أو انتهاء جلسة الصوت) تُسقط العملية نفسها بدل الانفجار المتأخر
  if (epoch !== sfxEpoch || !roomVoiceSessionActive) return;
  if (roomSfxMuted) return; // كتم الروم يشمل المؤثرات المحلية
  await pauseActiveGiftSound();
  if (epoch !== sfxEpoch) return;

  const key = cacheKey?.trim();
  const cached = key ? preloadedAssetSounds.get(key) : undefined;
  if (cached && key) {
    preloadedAssetSounds.delete(key);
    try {
      await withSfxTimeout(cached.setPositionAsync(0));
      await withSfxTimeout(cached.setVolumeAsync(volume));
      await withSfxTimeout(cached.playAsync());
      activeSound = cached;
      activeGiftSoundUrl = null;
      activeAssetKey = key;
      cached.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          // أوقف ثم صفّر الموضع — بدون stop يبقى shouldPlay=true فيُعاد
          // التشغيل بلا نهاية (وهذا سبب تكرار المؤثرات حتى مغادرة الروم)
          cached.stopAsync().then(() => cached.setPositionAsync(0)).catch(() => {});
          preloadedAssetSounds.set(key, cached);
          if (activeSound === cached) {
            activeSound = null;
            activeAssetKey = null;
          }
        }
      });
      return;
    } catch {
      try {
        await cached.unloadAsync();
      } catch {
        // ignore
      }
    }
  }

  if (epoch !== sfxEpoch) return;
  const { sound } = await withSfxTimeout(
    AV.Audio.Sound.createAsync(
      source,
      { shouldPlay: true, volume, isLooping: false },
    ),
    (late) => late.sound.unloadAsync().catch(() => {}),
  );
  if (epoch !== sfxEpoch) {
    sound.unloadAsync().catch(() => {});
    return;
  }
  activeSound = sound;
  activeGiftSoundUrl = null;
  activeAssetKey = key ?? null;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync().catch(() => {});
      if (activeSound === sound) {
        activeSound = null;
        activeAssetKey = null;
      }
      if (key) preloadRoomSoundAsset(key, source).catch(() => {});
    }
  });
}

/** إيقاف صوت الهدية فوراً (مغادرة الروم) */
export async function stopGiftSound(): Promise<void> {
  await enqueueSfxOp(() => pauseActiveGiftSound());
}

export async function stopRoomSound(): Promise<void> {
  // رفع الجيل فوراً وبشكل متزامن (قبل الطابور) — كل تشغيل أُدرج قبل هذه
  // اللحظة يُسقط نفسه عند وصول دوره بدل أن ينفجر دفعة واحدة بعد الخروج
  sfxEpoch++;
  // كل الإيقاف/التفريغ داخل عملية طابور واحدة — لا استدعاء لدوال عامة مطوّبة (deadlock)
  await enqueueSfxOp(async () => {
    await pauseActiveGiftSound();
    for (const [, sound] of preloadedSounds) {
      try {
        await withSfxTimeout(sound.unloadAsync());
      } catch {
        // ignore
      }
    }
    preloadedSounds.clear();
    for (const [, sound] of preloadedAssetSounds) {
      try {
        await withSfxTimeout(sound.unloadAsync());
      } catch {
        // ignore
      }
    }
    preloadedAssetSounds.clear();
  });
  audioModeConfigured = false;
  voiceSfxAudioConfigured = false;
}

export async function playRemoteSound(
  url: string,
  volume = 0.85,
  options?: { preloadOnly?: boolean },
): Promise<void> {
  const key = url.trim();
  if (!key) return;

  if (options?.preloadOnly) {
    await preloadGiftSound(key);
    return;
  }

  await playGiftSound(key, volume);
}
