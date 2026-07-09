# 🚀 النشر والاختبار — المفاتيح جاهزة

المفاتيح **مدمجة بالفعل** في `functions/src/index.ts`:
- ✅ Agora App ID + Certificate (مشروع linkup)
- ✅ LiveKit API Key + Secret + WS URL

لا تحتاج إعداد `.env`. فقط انشر واختبر.

---

## الخطوة 1: نشر Cloud Functions + Firestore (قواعد + فهارس)

```bash
cd linkup-functions
npm --prefix functions install
firebase login

# يُنشئ فهارس المنشورات تلقائياً من firestore.indexes.json (لا حاجة للنقر يدوياً في Console)
npm run deploy
# أو: firebase deploy --only functions,firestore:rules,firestore:indexes
```

انتظر حتى ترى: `✔ Deploy complete!`

> **فهارس Firestore** تُنشأ عند الـ deploy لكن قد تحتاج **2–10 دقائق** حتى تصبح `Enabled`.
> التطبيق يستخدم استعلاماً احتياطياً أثناء البناء. تتبّع الحالة:
> [Firestore Indexes](https://console.firebase.google.com/project/linkup-dc45f/firestore/indexes)

ثم (اختياري) قواعد Realtime Database:
```bash
firebase deploy --only database
```

---

## الخطوة 2: بناء التطبيق (development build)

⚠️ **لا يعمل في Expo Go** — لازم development build.

```bash
cd sada-app
npm install

# Android
npx expo run:android

# iOS (يتطلب Mac)
npx expo run:ios

# بدون Mac → EAS Build سحابي
eas build --profile development --platform ios
```

أول بناء يأخذ 10-20 دقيقة (يجمّع الكود الأصلي لـ Agora و LiveKit).

---

## الخطوة 3: الاختبار ✅

### اختبار المكالمات (Agora)
1. ثبّت التطبيق على **جهازين** وسجّل دخول بحسابين مختلفين
2. جهاز 1: المطابقات → صوت → "بدء البحث"
3. جهاز 2: المطابقات → صوت → "بدء البحث"
4. **المتوقع**: يتطابقان خلال ثوانٍ، تفتح شاشة المكالمة، **تسمعان بعضكما**
5. جرّب الفيديو بنفس الطريقة → **ترَيان بعضكما**

### اختبار الغرف (LiveKit)
1. جهاز 1: أنشئ غرفة → اصعد مقعد المضيف
2. جهاز 2: ادخل نفس الغرفة → اصعد مقعداً
3. **المتوقع**: تسمعان بعضكما، **موجات الصوت تتحرك** عند الكلام، الكتم يعمل

### مراقبة السجلات
```bash
firebase functions:log
```
ابحث عن `generateAgoraToken` و `generateLiveKitToken` ناجحة (status 200).

---

## 🔧 إذا واجهت مشكلة

| المشكلة | السبب | الحل |
|---------|-------|------|
| `unauthenticated` | المستخدم غير مسجّل دخول | تأكد من تسجيل الدخول قبل المكالمة |
| لا صوت | أذونات المايك | اقبل إذن المايك عند الطلب |
| `functions/internal` | الدوال غير منشورة | أعد `firebase deploy --only functions` |
| الغرفة لا تتصل | WS URL خطأ | تحقق أنه `wss://linup-shk03qgl.livekit.cloud` |
| `registerGlobals` خطأ | Expo Go | استخدم development build |

---

## 🔐 تنبيه أمني مهم

المفاتيح التي شاركتها في المحادثة أصبحت **معروفة**. بعد التأكد أن كل شيء يعمل:

1. **LiveKit**: [cloud.livekit.io](https://cloud.livekit.io) → Settings → Keys → احذف المفتاح الحالي وأنشئ جديداً
2. **Agora**: Console → linkup → Security → أعد توليد Primary Certificate

ثم حدّث القيم في `functions/src/index.ts` وأعد النشر.

> المفاتيح آمنة داخل Cloud Functions (لا يصلها المستخدمون)، لكن بما أنها ظهرت في محادثة، الأفضل تجديدها.

---

## 📊 كيف يعمل كل شيء

```
التطبيق                 Cloud Functions              Agora / LiveKit
   │                          │                           │
   │── httpsCallable ────────►│                           │
   │   (generateAgoraToken)   │── يولّد توكن بالمفتاح ────►│
   │◄──── توكن (ساعة) ─────────│                           │
   │                          │                           │
   │──── ينضم بالتوكن ─────────────────────────────────────►│
   │◄════════ صوت/فيديو مباشر ══════════════════════════════►│
```
