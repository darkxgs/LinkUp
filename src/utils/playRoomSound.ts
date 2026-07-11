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
/** تهيئة الصوت أثناء جلسة LiveKit — MixWithOthers حتى تُسمع المؤثرات مع المايك */
let voiceSfxAudioConfigured = false;
/** true أثناء جلسة LiveKit */
let roomVoiceSessionActive = false;

/** أصوات الهدايا المحمّلة مسبقاً — تُعاد للكاش بعد التشغيل لإعادة تشغيل فورية */
const preloadedSounds = new Map<string, Sound>();
/** مؤثرات الغرفة المحلية (require) */
const preloadedAssetSounds = new Map<string, Sound>();

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
        // لا نقاطع صوت الغرفة (LiveKit) عند تشغيل مؤثرات محلية.
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

/** تهيئة مسبقة عند دخول الروم — يحمّل expo-av فقط إن كان LiveKit نشطاً */
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
  // فئة AVAudioSession من PlayAndRecord فيُقتل مايك LiveKit لمن هو على المقعد
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
      sound.setPositionAsync(0).catch(() => {});
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
    await prevSound.stopAsync();
    await prevSound.setPositionAsync(0);
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
      AV.Audio.Sound.createAsync(
        { uri: key },
        { shouldPlay: false, volume: 0.85, isLooping: false },
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

  const AV = await getAV();
  await configureSoundEffectsAudio();
  return enqueueSfxOp(() => playGiftSoundInner(AV, key, volume));
}

async function playGiftSoundInner(AV: AVModule, key: string, volume: number): Promise<void> {
  if (activeGiftSoundUrl === key && activeSound) {
    try {
      await activeSound.setPositionAsync(0);
      await activeSound.setVolumeAsync(volume);
      await activeSound.playAsync();
      return;
    } catch {
      // fall through to full reload
    }
  }

  if (activeSound && activeGiftSoundUrl !== key) {
    await pauseActiveGiftSound();
  }

  const cached = preloadedSounds.get(key);
  if (cached) {
    preloadedSounds.delete(key);
    try {
      await cached.setPositionAsync(0);
      await cached.setVolumeAsync(volume);
      await cached.playAsync();
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

  const { sound } = await AV.Audio.Sound.createAsync(
    { uri: key },
    { shouldPlay: true, volume, isLooping: false },
  );
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
      AV.Audio.Sound.createAsync(
        source,
        { shouldPlay: false, volume: 0.9, isLooping: false },
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
  const AV = await getAV();
  await configureSoundEffectsAudio();
  return enqueueSfxOp(() => playRoomSoundSourceInner(AV, source, volume, cacheKey));
}

async function playRoomSoundSourceInner(
  AV: AVModule,
  source: number,
  volume: number,
  cacheKey?: string,
): Promise<void> {
  await pauseActiveGiftSound();

  const key = cacheKey?.trim();
  const cached = key ? preloadedAssetSounds.get(key) : undefined;
  if (cached && key) {
    preloadedAssetSounds.delete(key);
    try {
      await cached.setPositionAsync(0);
      await cached.setVolumeAsync(volume);
      await cached.playAsync();
      activeSound = cached;
      activeGiftSoundUrl = null;
      activeAssetKey = key;
      cached.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          cached.setPositionAsync(0).catch(() => {});
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

  const { sound } = await AV.Audio.Sound.createAsync(
    source,
    { shouldPlay: true, volume, isLooping: false },
  );
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
  // كل الإيقاف/التفريغ داخل عملية طابور واحدة — لا استدعاء لدوال عامة مطوّبة (deadlock)
  await enqueueSfxOp(async () => {
    await pauseActiveGiftSound();
    for (const [, sound] of preloadedSounds) {
      try {
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    }
    preloadedSounds.clear();
    for (const [, sound] of preloadedAssetSounds) {
      try {
        await sound.unloadAsync();
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
