/** اسم قناة صوت تحدي 1v1 — معزولة عن غرف الروم العادية (الاسم تاريخي من عهد LiveKit) */
export function getChallengeLiveKitRoomName(challengeId: string): string {
  return `challenge_${challengeId}`;
}
