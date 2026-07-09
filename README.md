# LinkUp — Mobile App | تطبيق الموبايل

تطبيق LinkUp للدردشة الصوتية (React Native / Expo SDK 52).

## التشغيل | Run
```bash
npm install
npx expo start          # Expo Go (بدون غرف LiveKit)
npx expo run:android    # Dev build كامل (مطلوب للغرف/المكالمات)
```

## البناء | Build APK
```bash
eas build --platform android --profile preview
```

## أهم المجلدات | Key folders
- `app/` — الشاشات (expo-router)
- `src/services/` — Firebase + LiveKit + منطق الأعمال
- `src/components/` — مكوّنات الواجهة
- `src/localization/` — الترجمة ar/en

## ملاحظات
- الإعدادات الحية تُقرأ من Firestore `config/*` وتُدار من لوحة التحكم (فرع `admin`).
- غرف الصوت/المكالمات: LiveKit Cloud — لا تعمل داخل Expo Go.
