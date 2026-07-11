/**
 * إيقاف فوري لموسيقى الروم — يُستدعى عند مغادرة الغرفة قبل إلغاء mount المكوّن
 */
type RoomSound = import('expo-av').Audio.Sound;

class RoomMusicPlaybackManager {
  private sound: RoomSound | null = null;
  /** كتم صوت الروم — يشمل الموسيقى المشتركة المشغَّلة محلياً */
  private muted = false;

  attach(sound: RoomSound): void {
    if (this.sound && this.sound !== sound) {
      void this.stopSound(this.sound);
    }
    this.sound = sound;
    // مقطع جديد يُحمَّل أثناء كتم الروم — يبدأ مكتوماً بدل مستوى كامل
    if (this.muted) {
      void sound.setIsMutedAsync(true).catch(() => {});
    }
  }

  /** كتم/فك كتم الموسيقى محلياً دون إيقاف التشغيل (كتم صوت الروم) */
  async setMutedAll(muted: boolean): Promise<void> {
    this.muted = muted;
    const active = this.sound;
    if (!active) return;
    try {
      await active.setIsMutedAsync(muted);
    } catch {
      // ignore
    }
  }

  getActiveSound(): RoomSound | null {
    return this.sound;
  }

  detach(sound: RoomSound | null | undefined): void {
    if (sound && this.sound === sound) {
      this.sound = null;
    }
  }

  async stopAll(): Promise<void> {
    const active = this.sound;
    this.sound = null;
    if (active) {
      await this.stopSound(active);
    }
  }

  private async stopSound(sound: RoomSound): Promise<void> {
    try {
      await sound.stopAsync();
    } catch {
      // ignore
    }
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }
}

export const roomMusicPlaybackManager = new RoomMusicPlaybackManager();

export function stopRoomMusicPlayback(): Promise<void> {
  return roomMusicPlaybackManager.stopAll();
}
