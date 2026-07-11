/**
 * فلتر المصطلحات المحظورة — منع الدعاية لتطبيقات منافسة داخل الرسائل
 * (دردشة الغرف، الشات الخاص، دردشة الوكالة، المنشورات والتعليقات، بثّ SVIP)
 *
 * مصادر القائمة — كلها تُدمج مع القائمة الافتراضية أدناه:
 *   1) config/settings → moderation.bannedTerms (مصفوفة نصوص) — تصل لحظياً
 *      عبر ConfigContext (subscribeToSettings) الذي يغذّي setRemoteBannedTerms()
 *      هنا، فيتحدّث الفلتر فور تعديل الأدمن دون إعادة تشغيل.
 *   2) config/moderation → bannedTerms — نفس مستند bannedWords الخاص بفلتر
 *      الألفاظ (utils/textModeration.ts)؛ تحميل كسول مرة واحدة (توافقاً).
 *   وبذلك يعمل الفلتر فوراً بالقائمة الافتراضية قبل أي ضبط من اللوحة.
 *
 * - تطبيع عربي/لاتيني (حروف صغيرة، إزالة التشكيل/التطويل، توحيد
 *   الألف/الياء/التاء المربوطة، طيّ تكرار الحروف ٣+ → ٢) — نفس منطق
 *   فلتر الألفاظ في utils/textModeration.ts.
 * - المصطلح المفرد يُطابق ككلمة كاملة (حتى لا تُحجب كلمات بريئة تحتويه)،
 *   والعبارة متعددة الكلمات تُطابق كنص داخل الرسالة بعد التطبيع.
 *
 * أمثلة اختبار يدوي:
 *   findBannedTerm('حمّلوا تطبيق بيجو لايف')            → 'بيجو لايف' (محظور — عبارة)
 *   findBannedTerm('تعالوا نلعب على YALLA LUDO')       → 'yalla ludo' (محظور — حالة الأحرف لا تهم)
 *   findBannedTerm('انا على ميكوووو')                   → 'ميكوو'  (محظور — طيّ تكرار الحروف)
 *   findBannedTerm('نزلوا Bigo وتعالوا')                → 'bigo'   (محظور — كلمة كاملة)
 *   findBannedTerm('تعالوا توب توب احسن')               → 'توب توب' (محظور — عبارة)
 *   findBannedTerm('البيجاما الجديدة حلوة')             → null     (بريء — «بيجو» ليست كلمة كاملة)
 *   findBannedTerm('يلا نلعب يا شباب')                  → null     (بريء — «يلا» العربية غير محظورة)
 *   findBannedTerm('مساء الخير للجميع')                 → null
 *
 * ملاحظة: هذا فلتر عميل فقط — المتابعة الدائمة تكون بـ trigger في
 * Cloud Functions يحذف الرسائل المطابقة من المصدر (متجاوزو النسخ المعدّلة).
 */
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase/index';

function normalizeText(input: string): string {
  return String(input)
    .toLowerCase()
    // تشكيل + تطويل
    .replace(/[ً-ْٰـ]/g, '')
    // محارف عرض خفية تُستخدم للتمويه (ZWSP/ZWNJ/ZWJ/LRM/RLM/WJ/BOM)
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    // توحيد الأحرف العربية المتشابهة
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // تكرار حرف ٣+ مرات → مرتين (تمويه «بيجوووو»)
    .replace(/(.)\1{2,}/g, '$1$1');
}

// القائمة الافتراضية — أسماء تطبيقات صوتية منافسة معروفة (عربي + لاتيني).
// اختيرت أسماء مميّزة قليلة الالتباس؛ الكلمات العربية الشائعة («يلا»، «سوا»،
// «حكيني»، «فلة») مستبعدة عمداً لتجنّب حجب كلام بريء — أضفها من اللوحة إن لزم.
const DEFAULT_BANNED_TERMS: string[] = [
  // كلمات مفردة
  'bigo', 'بيجو', 'بيغو',
  'yalla', 'yallaludo',
  'mico', 'ميكو',
  'yoyo', 'يويو',
  'yoho', 'يوهو',
  'chamet', 'شاميت',
  'azar', 'ازار',
  'litmatch',
  'soulchill', 'سولشيل',
  'partying', 'بارتينج', 'بارتينغ',
  'olaparty',
  'weparty',
  'falla',
  'hakini',
  'waka', 'واكا',
  'sango', 'سانجو',
  'lamour', 'لامور',
  'starmaker',
  'toptop',
  // عبارات مركّبة
  'yalla ludo', 'يلا لودو',
  'bigo live', 'بيجو لايف', 'بيغو لايف',
  'soul chill', 'سول شيل',
  'ola party', 'اولا بارتي',
  'we party', 'وي بارتي',
  'ستار ميكر',
  'lama chat', 'لاما شات',
  'ليت ماتش', 'لايت ماتش',
  'top top', 'توب توب',
];

// طيّ كل تكرار متجاور → حرف واحد («ميكوو» → «ميكو») — لمطابقة تمويه تكرار الحروف
function collapseRuns(s: string): string {
  return s.replace(/(.)\1+/g, '$1');
}

interface TermIndex {
  words: Set<string>;
  wordsCollapsed: Set<string>;
  phrases: string[];
  phrasesCollapsed: string[];
}

function emptyIndex(): TermIndex {
  return { words: new Set(), wordsCollapsed: new Set(), phrases: [], phrasesCollapsed: [] };
}

function splitTerms(raw: string[]): TermIndex {
  const idx = emptyIndex();
  for (const item of raw) {
    const n = normalizeText(String(item ?? '')).trim();
    if (!n) continue;
    if (n.includes(' ')) {
      idx.phrases.push(n);
      idx.phrasesCollapsed.push(collapseRuns(n));
    } else {
      idx.words.add(n);
      idx.wordsCollapsed.add(collapseRuns(n));
    }
  }
  return idx;
}

const DEFAULTS = splitTerms(DEFAULT_BANNED_TERMS);

// قائمة اللوحة عبر config/settings → moderation.bannedTerms — يغذّيها
// ConfigContext لحظياً (نمط setCachedGiftCommission) فتصلح للخدمات بلا hooks.
let remoteFromSettings: TermIndex = emptyIndex();

/** تُستدعى من ConfigContext عند كل تحديث لـ config/settings */
export function setRemoteBannedTerms(terms: string[] | null | undefined): void {
  remoteFromSettings = splitTerms(Array.isArray(terms) ? terms.map(String) : []);
}

// قائمة config/moderation.bannedTerms — تحميل كسول مرة واحدة (توافقاً مع
// bannedWords في نفس المستند)
let remoteDoc: TermIndex = emptyIndex();
let remoteLoadStarted = false;

function ensureRemoteTerms(): void {
  if (remoteLoadStarted) return;
  remoteLoadStarted = true;
  void getDoc(doc(firestore, 'config', 'moderation'))
    .then((snap) => {
      const raw = snap.data()?.bannedTerms;
      if (!Array.isArray(raw)) return;
      remoteDoc = splitTerms(raw);
    })
    .catch(() => {
      remoteLoadStarted = false; // إعادة المحاولة لاحقاً عند فشل الشبكة
    });
}

/** يعيد المصطلح المحظور الأول إن وُجد — وإلا null */
export function findBannedTerm(text: string): string | null {
  ensureRemoteTerms();
  const normalized = normalizeText(text);
  if (!normalized.trim()) return null;
  const collapsed = collapseRuns(normalized);
  const indexes: TermIndex[] = [DEFAULTS, remoteFromSettings, remoteDoc];

  for (const idx of indexes) {
    for (const phrase of idx.phrases) {
      if (normalized.includes(phrase)) return phrase;
    }
    for (const phrase of idx.phrasesCollapsed) {
      if (collapsed.includes(phrase)) return phrase;
    }
  }

  // مطابقة كلمات كاملة — تقسيم على أي شيء غير حرف عربي/لاتيني/رقم
  const tokens = normalized.split(/[^ء-يa-z0-9]+/);
  for (const token of tokens) {
    if (!token) continue;
    const tc = collapseRuns(token);
    for (const idx of indexes) {
      if (idx.words.has(token) || idx.wordsCollapsed.has(tc)) return token;
    }
  }
  return null;
}

export function containsBannedTerm(text: string): boolean {
  return findBannedTerm(text) != null;
}

export const BANNED_TERM_BLOCK_MESSAGE = 'هذه الرسالة تخالف إرشادات المجتمع';

/** يرمي خطأً برسالة عربية مهذّبة إذا احتوى النص مصطلحاً محظوراً */
export function assertNoBannedTerms(text: string): void {
  if (containsBannedTerm(text)) {
    throw new Error(BANNED_TERM_BLOCK_MESSAGE);
  }
}
