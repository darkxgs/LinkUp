/** جلسة روم صوتية نشطة — يمنع إخراج المستخدم عند الخلفية أو إطفاء الشاشة */
export type RoomVoiceSessionSnapshot = {
  active: boolean;
  roomId: string | null;
  roomTitle: string;
  canSpeak: boolean;
};

let voiceSession: RoomVoiceSessionSnapshot = {
  active: false,
  roomId: null,
  roomTitle: '',
  canSpeak: false,
};

export function setRoomVoiceSession(patch: Partial<RoomVoiceSessionSnapshot> & { active: boolean }): void {
  voiceSession = { ...voiceSession, ...patch };
}

export function getRoomVoiceSession(): RoomVoiceSessionSnapshot {
  return voiceSession;
}

/** @deprecated استخدم setRoomVoiceSession */
export function setRoomVoiceSessionActive(active: boolean): void {
  voiceSession.active = active;
  if (!active) {
    voiceSession.roomId = null;
    voiceSession.canSpeak = false;
  }
}

export function isRoomVoiceSessionActive(): boolean {
  return voiceSession.active;
}
