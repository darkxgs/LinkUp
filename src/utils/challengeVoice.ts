/** اسم غرفة LiveKit لصوت تحدي 1v1 — معزولة عن غرف الروم العادية */
export function getChallengeLiveKitRoomName(challengeId: string): string {
  return `challenge_${challengeId}`;
}
