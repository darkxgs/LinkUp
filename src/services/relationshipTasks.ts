/**
 * LinkUp — مهام الحميمية (Per-Relationship Tasks)
 *
 * كل علاقة لها مهامها الخاصة المشتقّة من حقول وثيقة Relationship الفعلية:
 *   - giftsExchanged       → مهمة الهدايا
 *   - messagesExchanged    → مهمة الرسائل
 *   - callMinutesUsedToday.voice → مهمة المكالمات الصوتية اليومية
 *   - callMinutesUsedToday.video → مهمة مكالمات الفيديو اليومية
 *
 * يعني: لا حاجة لحقول جديدة في Firestore. التقدّم يُحسب لحظياً.
 * المكافأة (XP) تُمنح تلقائياً عبر addRelationshipPoints عند كل نشاط
 *   (هذا منطق موجود مسبقاً في social.ts) — هاي الصفحة فقط تعرض.
 */

import type { Relationship } from '@/services/firebase/social';

export type TaskIconName =
  | 'mic'         // مايك (مكالمة صوتية)
  | 'message'     // محادثة
  | 'gift'        // هدية
  | 'phone'       // مكالمة صوتية
  | 'video'       // مكالمة فيديو
  | 'heart'       // قلب (نقاط حميمية)
  | 'trophy';     // مكافأة كبيرة

export interface RelationshipTask {
  id: string;
  title: string;
  /** كم مرة/كم وحدة لإنجاز المهمة */
  target: number;
  /** التقدّم الحالي */
  progress: number;
  /** كم XP بكل وحدة (يُعرض كـ +N ❤️) */
  xpPerUnit: number;
  /** هل مكتملة؟ */
  done: boolean;
  /** أيقونة (lucide) */
  icon: TaskIconName;
  /** هل يُعاد كل يوم؟ */
  daily?: boolean;
}

/**
 * يولّد قائمة مهام مخصّصة لعلاقة معيّنة بناءً على بيانات Firestore.
 * المهام نفسها لكل العلاقات (مهام النظام)، بس التقدّم خاص بكل علاقة.
 *
 * في المستقبل يمكن جعلها diff حسب نوع العلاقة (friend/partner/soulmate)
 * بإضافة شرط على rel.type.
 */
export function getTasksForRelationship(rel: Relationship): RelationshipTask[] {
  const voice = rel.callMinutesUsedToday?.voice ?? 0;
  const video = rel.callMinutesUsedToday?.video ?? 0;

  const tasks: RelationshipTask[] = [
    {
      id: 'gifts',
      title: 'أهدِ هدية لشريكك',
      target: 5,
      progress: Math.min(rel.giftsExchanged, 5),
      xpPerUnit: 4,
      done: rel.giftsExchanged >= 5,
      icon: 'gift',
    },
    {
      id: 'messages',
      title: 'أكمل المحادثة',
      target: 10,
      progress: Math.min(rel.messagesExchanged, 10),
      xpPerUnit: 5,
      done: rel.messagesExchanged >= 10,
      icon: 'message',
    },
    {
      id: 'voice-call',
      title: 'لكل دقيقة مكالمة صوتية',
      target: 10,
      progress: Math.min(voice, 10),
      xpPerUnit: 10,
      done: voice >= 10,
      icon: 'phone',
      daily: true,
    },
    {
      id: 'video-call',
      title: 'لكل دقيقة مكالمة فيديو',
      target: 5,
      progress: Math.min(video, 5),
      xpPerUnit: 15,
      done: video >= 5,
      icon: 'video',
      daily: true,
    },
    {
      id: 'mic-together',
      title: 'ابقَ على المايك معًا لمدة 60 ثانية',
      target: 2,
      progress: Math.min(Math.floor(voice / 1), 2), // كل دقيقة = جلسة مايك
      xpPerUnit: 10,
      done: voice >= 2,
      icon: 'mic',
      daily: true,
    },
  ];

  return tasks;
}

/** ملخّص عدّاد المهام المكتملة (للعرض في الشريط العلوي) */
export function getTasksSummary(rel: Relationship): { done: number; total: number } {
  const tasks = getTasksForRelationship(rel);
  return { done: tasks.filter((t) => t.done).length, total: tasks.length };
}
