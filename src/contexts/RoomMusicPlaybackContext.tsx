import { createContext, useContext } from 'react';
import type { useRoomMusicPlayback } from '@/hooks/useRoomMusicPlayback';

export type RoomMusicPlaybackApi = ReturnType<typeof useRoomMusicPlayback>;

const RoomMusicPlaybackContext = createContext<RoomMusicPlaybackApi | null>(null);

export const RoomMusicPlaybackProvider = RoomMusicPlaybackContext.Provider;

export function useRoomMusicPlaybackContext(): RoomMusicPlaybackApi | null {
  return useContext(RoomMusicPlaybackContext);
}
