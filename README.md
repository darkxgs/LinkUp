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
