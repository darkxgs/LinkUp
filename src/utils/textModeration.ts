/**
 * فلتر الألفاظ المسيئة — رقابة برمجية على النصوص قبل الإرسال
 * (شات خاص، دردشة الغرف، المنشورات، التعليقات)
 *
 * - تطبيع عربي (إزالة التشكيل/التطويل، توحيد الألف/الياء/التاء المربوطة)
 *   وكشف تمويه تكرار الحروف («قحبةةةة»).
 * - مطابقة كلمات كاملة (tokens) للكلمات المفردة حتى لا تُحجب كلمات بريئة
 *   تحتوي المقطع («اكسسوار» لا تُحجب بسبب «كس»)، والعبارات المركّبة تُطابق كنص.
 * - قائمة إضافية اختيارية من لوحة التحكم: config/moderation.bannedWords
 *   تُحمَّل مرة واحدة وتُدمج مع القائمة الأساسية.
 */
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';

function normalizeText(input: string): string {
  return String(input)
    .toLowerCase()
    // تشكيل + تطويل
    .replace(/[ً-ْٰـ]/g, '')
    // توحيد الأحرف العربية المتشابهة
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // تكرار حرف ٣+ مرات → مرتين (تمويه «نييييك»)
    .replace(/(.)\1{2,}/g, '$1$1');
}

// كلمات مفردة — تُطابق ككلمة كاملة فقط
const BANNED_WORDS_RAW: string[] = [
  // عربي
  'قحبه', 'قحبة', 'قحاب', 'شرموطه', 'شرموطة', 'شرموط', 'شراميط',
  'عاهره', 'عاهرة', 'عاهرات', 'داعره', 'داعرة', 'ساقطه', 'ساقطة',
  'منيوك', 'منيوكه', 'منيوكة', 'منيك', 'نيك', 'انيك', 'نياكه', 'نياكة', 'نيكك', 'بنيك', 'تتناك', 'اتناك',
  'كس', 'كساس', 'كسك', 'كسها', 'كسمك', 'كسختك',
  'طيز', 'طيزك', 'طياز',
  'زب', 'زبي', 'زبك', 'زبر', 'ايري', 'عيري', 'ايرك',
  'خول', 'خوال', 'لوطي', 'لواط', 'مخنث', 'خنيث',
  'عرص', 'معرص', 'معرصين',
  'ممحون', 'ممحونه', 'ممحونة', 'محونه',
  'علق', 'شلكه', 'شلكة',
  // إنجليزي
  'fuck', 'fucker', 'fucking', 'fck', 'fuk',
  'shit', 'bullshit',
  'bitch', 'bitches',
  'whore', 'slut', 'hoe',
  'dick', 'cock', 'pussy', 'cunt',
  'asshole', 'bastard',
  'nigger', 'nigga',
  'motherfucker',
];

// عبارات مركّبة — تُطابق كنص داخل الرسالة
const BANNED_PHRASES_RAW: string[] = [
  'كس امك', 'كس اختك', 'كس اخته', 'كس امه',
  'ابن القحبه', 'ابن الشرموطه', 'ابن العاهره', 'ابن الكلب', 'بنت الكلب',
  'يلعن دينك', 'العن دينك', 'يلعن ابوك', 'يلعن امك',
  'انعل ابوك', 'انعل امك',
  'son of a bitch', 'fuck you', 'fuck off',
];

const BANNED_WORDS = new Set(BANNED_WORDS_RAW.map(normalizeText));
const BANNED_PHRASES = BANNED_PHRASES_RAW.map(normalizeText);

// قائمة إضافية من لوحة التحكم (config/moderation.bannedWords) — تحميل كسول مرة واحدة
let remoteWords = new Set<string>();
let remotePhrases: string[] = [];
let remoteLoadStarted = false;

function ensureRemoteList(): void {
  if (remoteLoadStarted) return;
  remoteLoadStarted = true;
  void getDoc(doc(firestore, 'config', 'moderation'))
    .then((snap) => {
      const raw = snap.data()?.bannedWords;
      if (!Array.isArray(raw)) return;
      const words = new Set<string>();
      const phrases: string[] = [];
      for (const item of raw) {
        const n = normalizeText(String(item ?? '')).trim();
        if (!n) continue;
        if (n.includes(' ')) phrases.push(n);
        else words.add(n);
      }
      remoteWords = words;
      remotePhrases = phrases;
    })
    .catch(() => {
      remoteLoadStarted = false; // إعادة المحاولة لاحقاً عند فشل الشبكة
    });
}

/** يعيد الكلمة/العبارة المسيئة الأولى إن وُجدت — وإلا null */
export function findProfanity(text: string): string | null {
  ensureRemoteList();
  const normalized = normalizeText(text);
  if (!normalized.trim()) return null;

  for (const phrase of BANNED_PHRASES) {
    if (normalized.includes(phrase)) return phrase;
  }
  for (const phrase of remotePhrases) {
    if (normalized.includes(phrase)) return phrase;
  }

  // مطابقة كلمات كاملة — تقسيم على أي شيء غير حرف عربي/لاتيني
  const tokens = normalized.split(/[^ء-يa-z]+/);
  for (const token of tokens) {
    if (!token) continue;
    if (BANNED_WORDS.has(token) || remoteWords.has(token)) return token;
  }
  return null;
}

export function containsProfanity(text: string): boolean {
  return findProfanity(text) != null;
}

export const PROFANITY_BLOCK_MESSAGE =
  'لا يمكن الإرسال — النص يحتوي ألفاظاً غير لائقة. رجاءً عدّل رسالتك 🙏';

/** يرمي خطأً برسالة عربية واضحة إذا احتوى النص ألفاظاً مسيئة */
export function assertCleanText(text: string): void {
  if (containsProfanity(text)) {
    throw new Error(PROFANITY_BLOCK_MESSAGE);
  }
}
