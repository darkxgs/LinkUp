# LinkUp — Backend | الخلفية

Cloud Functions + قواعد Firebase + الألعاب المستضافة (Firebase Hosting).

## المحتوى
- `functions/` — Cloud Functions (قفل ألعاب الذكاء اليومي بوقت السيرفر، اليانصيب الأسبوعي، الدعم…)
- `firestore.rules` / `database.rules.json` — قواعد الأمان
- `hosting/public/games/` — ألعاب WebView (كازينو + ذكاء + تحديات 1v1 + برج التنين + البلياردو 3D)
- `casino-games/` — مصدر ألعاب الكازينو React
- `backup/` — نسخة البلياردو القديمة قبل الاستبدال

## النشر | Deploy
```bash
cd functions && npm install && cd ..
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules,database
```
المشروع: `linkup-dc45f`

## صلاحيات المشرفين والأمان (feature/backend-functions)
- `firestore.rules` — دوال `isSuperAdmin()`/`hasAdminPerm(key)` تتحقق من صلاحية كل مشرف قبل الكتابة، بدل السماح لأي مشرف بكل شيء.
- كتابة `config/{doc}` مقيدة بحقل `_permKey` المخزّن في كل مستند (يحدد أي صلاحية تسمح بتعديله).
- `reports` / `kycRequests` / `withdrawals` / `posts` / `agencies` — كل واحدة تتحقق من صلاحية المشرف الخاصة بها.
- `functions/src/index.ts` — `assertHasPermission()` مضافة داخل ~15 دالة إدارية (طبقة حماية إضافية بجانب قواعد Firestore).
- `VALID_PERMISSION_KEYS` + `sanitizePermissions()` — تمنع إضافة صلاحيات غير معروفة عبر استدعاء مباشر للـ API.
- `adminRunWeeklyLotteryDraw` — دالة onCall جديدة بدل الكتابة المباشرة غير المتحقق منها من لوحة التحكم.

## تعليق الحسابات المؤقت
- `functions/src/loginSession.ts` — يمنع تسجيل الدخول أثناء فترة التعليق (`isSuspended`/`suspendedUntil`)، ويرفع التعليق تلقائياً بعد انتهاء المدة.
