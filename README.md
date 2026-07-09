# LinkUp — Admin Dashboard | لوحة التحكم

لوحة تحكم LinkUp (React 18 + Vite + TypeScript) — إدارة المستخدمين، الاقتصاد، الألعاب، الهدايا، الوكالات، البلاغات، وكل إعدادات `config/*` في Firestore.

## التشغيل | Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # إنتاج → dist/
```

## أهم الصفحات
- `src/pages/Games.tsx` — كل أرقام/أوقات الألعاب (شرائح الرهان، المضاعفات، المؤقتات)
- `src/pages/Settings.tsx` — إعدادات المنصة العامة
- `src/services/admin.ts` — كل عمليات القراءة/الكتابة على Firestore

## الدخول
حساب Firebase Auth + مستند في مجموعة `admins/{uid}`.
