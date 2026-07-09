# نماذج face-api للتحقق من الجنس

Cloud Function `verifyGenderFace` تحاول تحميل النماذج من `functions/models/` عند أول طلب.
إذا لم تتوفر، يُستخدم Gemini / Hugging Face / AWS تلقائياً (كما في `processKycVerification`).

## الملفات المطلوبة

ضع في `linkup-functions/functions/models/`:

| ملف | مصدر |
|-----|------|
| `tiny_face_detector_model-weights_manifest.json` | [@vladmandic/face-api/model](https://github.com/vladmandic/face-api/tree/master/model) |
| `tiny_face_detector_model-shard1` | نفس المجلد |
| `age_gender_model-weights_manifest.json` | نفس المجلد |
| `age_gender_model-shard1` | نفس المجلد |

## التنزيل (من جذر `functions/`)

```bash
cd linkup-functions/functions
mkdir -p models
cd models

BASE="https://raw.githubusercontent.com/vladmandic/face-api/master/model"

curl -LO "$BASE/tiny_face_detector_model-weights_manifest.json"
curl -LO "$BASE/tiny_face_detector_model-shard1"
curl -LO "$BASE/age_gender_model-weights_manifest.json"
curl -LO "$BASE/age_gender_model-shard1"
```

## بعد التثبيت

```bash
npm install
npm run build
firebase deploy --only functions:verifyGenderFace,functions:processKycVerification
```

## متغيرات البيئة (بديل عن face-api)

```bash
firebase functions:secrets:set GEMINI_API_KEY
# أو HF_TOKEN / AWS keys في .env
```

## الحقول في Firestore (سيناريو المشروع)

| مجموعة | حقل | قيم |
|--------|-----|-----|
| `users/{uid}` | `isVerified` | `true` عند الموافقة |
| `users/{uid}` | `verificationStatus` | `approved` \| `rejected` \| `pending` |
| `users/{uid}` | `verifiedGender` | `female` \| `male` |
| `kycRequests/{uid}` | `status` | `processing` → `approved` \| `rejected` \| `pending` |
| `kycRequests/{uid}` | `method` | `face` \| `ai` \| `manual` |
