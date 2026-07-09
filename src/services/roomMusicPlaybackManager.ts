/**
 * إيقاف فوري لموسيقى الروم — يُستدعى عند مغادرة الغرفة قبل إلغاء mount المكوّن
 */
type RoomSound = import('expo-av').Audio.Sound;

class RoomMusicPlaybackManager {
  private sound: RoomSound | null = null;

  attach(sound: RoomSound): void {
    if (this.sound && this.sound !== sound) {
      void this.stopSound(this.sound);
    }
    this.sound = sound;
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
