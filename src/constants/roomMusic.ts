/**
 * إعدادات موسيقى الغرفة — عدّل الحدود من هذا الملف
 */

/** الحد الأقصى لحجم ملف الأغنية (ميجابايت) — يتّسع لملفات بطول ساعة بجودة عالية */
export const ROOM_MUSIC_MAX_FILE_MB = 120;

/** الحد الأقصى لحجم الملف بالبايت */
export const ROOM_MUSIC_MAX_FILE_BYTES = ROOM_MUSIC_MAX_FILE_MB * 1024 * 1024;

/** أقصى عدد مقاطع محفوظة في مكتبة الغرفة */
export const ROOM_MUSIC_MAX_LIBRARY_TRACKS = 100;

/** مجلد Firebase Storage: room_music/{roomId}/... */
export const ROOM_MUSIC_STORAGE_FOLDER = 'room_music';

export class RoomMusicFileTooLargeError extends Error {
  readonly maxMb: number;

  constructor() {
    super('ROOM_MUSIC_FILE_TOO_LARGE');
    this.name = 'RoomMusicFileTooLargeError';
    this.maxMb = ROOM_MUSIC_MAX_FILE_MB;
  }
}

export function assertRoomMusicFileSize(sizeBytes: number): void {
  if (sizeBytes > ROOM_MUSIC_MAX_FILE_BYTES) {
    throw new RoomMusicFileTooLargeError();
  }
}

export function formatRoomMusicMaxSizeLabel(): string {
  return `${ROOM_MUSIC_MAX_FILE_MB} MB`;
}
