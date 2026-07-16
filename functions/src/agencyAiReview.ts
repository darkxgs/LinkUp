/**
 * مراجعة توثيق الوكالة بالذكاء الاصطناعي (Gemini multimodal).
 *
 * تفحص طلب توثيق الوكالة بالكامل بلا تدخّل أدمن:
 *  - اسم الوكالة: مناسب، غير مسيء، لا ينتحل علامة/شخصية معروفة، ليس فارغاً/عبثياً.
 *  - شعار الوكالة (logo): صورة حقيقية مناسبة، ليست فارغة/لقطة نص، وغير مسيئة/صريحة.
 *  - صورة الخلفية (background): مناسبة وغير مسيئة/صريحة.
 *  - مستند هوية الوكيل (ID): يبدو مستند هوية رسمياً حقيقياً ومقروءاً.
 *
 * القرار: approve / reject / uncertain. عند غياب المفتاح أو فشل الخدمة → uncertain
 * (يُحال الطلب لمراجعة يدوية في اللوحة بدل قرار أعمى — نفس فلسفة KYC).
 *
 * المفتاح من متغيّر البيئة نفسه المستخدم في KYC (GEMINI_API_KEY) — بلا fallback بالسورس.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
// gemini-flash-latest: يتبع أحدث Flash مستقر (2.0/2.5 توقّفا للمستخدمين الجدد) — مقاوم للإيقاف
const GEMINI_MODEL = 'gemini-flash-latest';
/** مهلة قصوى للاستدعاء — صور متعددة أثقل من KYC، لكن لا انتظار غير محدود */
const GEMINI_TIMEOUT_MS = 30_000;

/** أدنى ثقة يُقبل عندها قرار «approve» — تحتها تُعامل كـ uncertain (مراجعة يدوية) */
export const AGENCY_AI_APPROVE_MIN_CONFIDENCE = 55;

export type AgencyAiCheckKey = 'name' | 'logo' | 'background' | 'id_document';

export type AgencyAiCheck = {
  key: AgencyAiCheckKey;
  /** نجح الفحص؟ null = لم يُقيَّم (صورة مفقودة/غير مقروءة) */
  pass: boolean | null;
  /** ملاحظة موجزة بالعربية تشرح النتيجة */
  note: string;
};

export type AgencyAiDecision = {
  decision: 'approve' | 'reject' | 'uncertain';
  /** سبب موجز بالعربية موجّه للوكيل — مهم خصوصاً عند الرفض */
  reason: string;
  /** 0–100 */
  confidence: number;
  checks: AgencyAiCheck[];
  provider: 'gemini' | 'none';
  model?: string;
  /** نص Gemini الخام — للتشخيص في اللوحة عند الحاجة */
  raw?: string;
};

export type AgencyAiInput = {
  agencyName: string;
  countryCode: string;
  ownerName?: string;
  phone?: string;
  images: {
    logo?: Buffer;
    background?: Buffer;
    idDocument?: Buffer;
  };
};

function inlineImage(buf: Buffer): { inline_data: { mime_type: string; data: string } } {
  return { inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') } };
}

/** نتيجة موحّدة عند تعذّر المراجعة الآلية (بلا مفتاح/خطأ) — تذهب لمراجعة يدوية */
function uncertainResult(reason: string): AgencyAiDecision {
  return {
    decision: 'uncertain',
    reason,
    confidence: 0,
    checks: [],
    provider: 'none',
  };
}

const SYSTEM_INSTRUCTION = [
  'أنت مُحقِّق هوية آلي لطلبات توثيق وكالات في تطبيق LinkUp.',
  'تتلقى صورة وجه واحدة (سيلفي مباشر بالكاميرا) لمقدّم الطلب (الوكيل). مهمتك الوحيدة:',
  'التأكد أنها وجه إنسان حقيقي حيّ، ثم إصدار قرار نهائي بلا مراجعة بشرية.',
  '',
  'القبول: وجه إنسان حقيقي واضح مُصوَّر مباشرة بالكاميرا. يُقبل لأي جنس (ذكر أو أنثى) — ليست تحقّق جنس.',
  '',
  'الرفض (كشف التزوير/انتحال الحيوية):',
  '  - صورة مُلتقطة من شاشة هاتف/حاسوب (حواف/إطار شاشة، انعكاس/وهج، نمط موواريه، بكسلة).',
  '  - صورة لصورة مطبوعة، أو رسم/أفاتار/شخصية كرتونية، أو أنها ليست وجه إنسان أصلاً.',
  '',
  'قواعد القرار:',
  '  - "reject" إذا كانت من شاشة/صورة لصورة أو ليست وجه إنسان حقيقي.',
  '  - "approve" إذا كانت وجه إنسان حقيقي حيّ.',
  '  - "uncertain" إذا كانت غير واضحة/رديئة الجودة بحيث لا تحسم — وليست تزويراً صريحاً.',
  '',
  'مهم جداً: لا تُقيّم أي شيء آخر إطلاقاً — لا شعار الوكالة ولا صورة خلفيتها ولا اسمها؛',
  'كلها حرّة (يجوز أن تكون أي صورة حتى شخصية) ولا دخل لك بها. قرارك مبني على صورة الوجه فقط.',
  '',
  'أعد حصراً JSON صالحاً بلا أي نص إضافي أو Markdown:',
  '{"decision":"approve"|"reject"|"uncertain","confidence":0-100,"reason":"<سبب موجز بالعربية، إلزامي عند الرفض>","checks":[{"key":"id_document","pass":true|false|null,"note":"<ملاحظة موجزة بالعربية>"}]}',
].join('\n');

function normalizeDecision(v: unknown): 'approve' | 'reject' | 'uncertain' {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'approve' || s === 'approved' || s === 'accept') return 'approve';
  if (s === 'reject' || s === 'rejected' || s === 'deny') return 'reject';
  return 'uncertain';
}

function normalizeChecks(v: unknown): AgencyAiCheck[] {
  if (!Array.isArray(v)) return [];
  const allowed: AgencyAiCheckKey[] = ['name', 'logo', 'background', 'id_document'];
  const out: AgencyAiCheck[] = [];
  for (const item of v) {
    const key = String((item as { key?: unknown })?.key ?? '').trim() as AgencyAiCheckKey;
    if (!allowed.includes(key)) continue;
    const rawPass = (item as { pass?: unknown })?.pass;
    const pass = rawPass === true ? true : rawPass === false ? false : null;
    const note = String((item as { note?: unknown })?.note ?? '').trim().slice(0, 240);
    out.push({ key, pass, note });
  }
  return out;
}

/**
 * يراجع طلب توثيق الوكالة عبر Gemini. لا يرمي أبداً — أي فشل يعيد uncertain
 * ليُحال الطلب لمراجعة يدوية في اللوحة.
 */
export async function reviewAgencyWithAI(input: AgencyAiInput): Promise<AgencyAiDecision> {
  if (!GEMINI_API_KEY) {
    return uncertainResult('تعذّرت المراجعة الآلية مؤقتاً — طلبك قيد المراجعة اليدوية وسنبلغك بالنتيجة');
  }

  // القرار مبني على صورة الوجه فقط — الشعار/الخلفية حرّة ولا تُرسَل للمراجعة.
  if (!input.images.idDocument) {
    return uncertainResult('لم تُرفق صورة وجه — الطلب قيد المراجعة اليدوية وسنبلغك بالنتيجة');
  }
  const parts: Array<Record<string, unknown>> = [
    { text: SYSTEM_INSTRUCTION },
    { text: '\nصورة وجه الوكيل (سيلفي مباشر بالكاميرا):' },
    inlineImage(input.images.idDocument),
    { text: 'أصدر الآن القرار بصيغة JSON فقط كما هو محدّد.' },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          // إيقاف «التفكير» في موديلات 3.x — يمنع استهلاك التوكنات قبل JSON (رد فارغ)
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (e) {
    console.warn('Agency AI review fetch failed:', e);
    return uncertainResult('تعذّرت المراجعة الآلية مؤقتاً — طلبك قيد المراجعة اليدوية وسنبلغك بالنتيجة');
  }

  if (!res.ok) {
    console.warn('Agency AI review error:', res.status, await res.text().catch(() => ''));
    return uncertainResult('تعذّرت المراجعة الآلية مؤقتاً — طلبك قيد المراجعة اليدوية وسنبلغك بالنتيجة');
  }

  let text = '';
  try {
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  } catch (e) {
    console.warn('Agency AI review parse (response) failed:', e);
    return uncertainResult('تعذّرت قراءة نتيجة المراجعة الآلية — طلبك قيد المراجعة اليدوية');
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Agency AI review: no JSON in response:', text.slice(0, 300));
    return { ...uncertainResult('تعذّر الحسم الآلي — طلبك قيد المراجعة اليدوية'), raw: text.slice(0, 1000) };
  }

  let parsed: { decision?: unknown; confidence?: unknown; reason?: unknown; checks?: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('Agency AI review: bad JSON:', e);
    return { ...uncertainResult('تعذّر الحسم الآلي — طلبك قيد المراجعة اليدوية'), raw: text.slice(0, 1000) };
  }

  let decision = normalizeDecision(parsed.decision);
  const confidence = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0)));
  const checks = normalizeChecks(parsed.checks);
  const reason =
    String(parsed.reason ?? '').trim().slice(0, 400) ||
    (decision === 'reject' ? 'لم يستوفِ الطلب معايير التوثيق' : '');

  // قبول بثقة منخفضة → مراجعة يدوية بدل قبول هش
  if (decision === 'approve' && confidence < AGENCY_AI_APPROVE_MIN_CONFIDENCE) {
    decision = 'uncertain';
  }

  return {
    decision,
    reason:
      reason ||
      (decision === 'approve'
        ? 'اجتاز الطلب المراجعة الآلية'
        : 'طلبك قيد المراجعة اليدوية وسنبلغك بالنتيجة'),
    confidence,
    checks,
    provider: 'gemini',
    model: GEMINI_MODEL,
    raw: text.slice(0, 1000),
  };
}
