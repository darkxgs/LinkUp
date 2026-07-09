/** يمنع RoomAppLifecycle من إخراج المستخدم من المقعد أثناء فتح منتقي الموسيقى/الفيديو */
let pickerDepth = 0;

export async function withRoomMediaPickerGuard<T>(fn: () => Promise<T>): Promise<T> {
  pickerDepth += 1;
  try {
    return await fn();
  } finally {
    pickerDepth = Math.max(0, pickerDepth - 1);
  }
}

export function isRoomMediaPickerGuardActive(): boolean {
  return pickerDepth > 0;
}
