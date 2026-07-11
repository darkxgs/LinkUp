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

## نظام الصلاحيات (feature/admin-dashboard)
- صلاحية مستقلة لكل صفحة في الشريط الجانبي (~39 صلاحية) بدل مجموعات صلاحيات عامة.
- `src/lib/navConfig.ts` — مصدر واحد لمسارات الصفحات وصلاحياتها.
- `src/components/PermissionRoute.tsx` — يمنع فتح أي صفحة عبر رابط مباشر بدون صلاحية.
- `src/components/PermissionSelect.tsx` — قائمة اختيار متعددة لتعيين صلاحيات كل مشرف من صفحة Admins.
- الصفحات المخفية لا تظهر في الشريط الجانبي ولا يمكن الوصول لها مباشرة (الحماية أيضاً من جهة السيرفر عبر Firestore rules وCloud Functions).

## تفاصيل المستخدم والأجهزة
- `src/pages/UserDetail.tsx` — حالة الحساب (نشط/محظور/معلّق مؤقتاً/محذوف)، سجل الجلسات، الأجهزة المستخدمة، عدد مرات الدخول.
- `src/components/SuspendUserModal.tsx` — تعليق مؤقت للحساب لمدة محددة مع سبب اختياري.
- `src/components/Toast.tsx` / `src/components/ConfirmDialog.tsx` — إشعارات وتأكيدات مخصصة بدل `alert()`/`confirm()` الافتراضية للمتصفح.
