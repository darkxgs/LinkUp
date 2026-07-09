# نموذج الوكالة (Agency) — LinkUp

**آخر تحديث:** يونيو 2026

---

## السيناريو الرسمي

1. **التقديم** — من التطبيق (`/agency/apply`) أو عبر **بوت الدعم** (دردشة `linkup_support` → `?source=chat`).
   - معرّف الحساب، اسم الوكالة، دولة، **واتساب** موثّق.
   - **لا** يُطلب معرّفات المضيفات عند التقديم.
   - المصدر: `source: 'app' | 'support_bot'` — مرئي في لوحة التحكم.
2. **المراجعة** — خلال **12 ساعة** (`reviewDeadline`)، توجيه حسب الدولة (`assignedTeam`: `gcc` | `global`).
3. **الموافقة** → حالة `awaiting_hosts`، إنشاء `agencies/{id}` بحالة `pending`، **كود دعوة**، مهلة **7 أيام** (`hostsDeadline`).
4. **جمع المضيفات** — بالكود أو دعوة مباشرة؛ **توثيق الجنس** من `/agency/confirm-host`:
   - **أنثى** → تُحسب ضمن الـ10، `agencyRole: 'host'`، `isFemaleHost: true`.
   - **ذكر** → ينضم كعضو، `agencyRole: 'member'`، `isFemaleHost: false`، بدون مزايا مضيفة.
5. **10 إناث موثّقات** → `ready` ثم **تفعيل** من اللوحة → `active`.
6. **انتهاء المهلة** دون العدد → `expired` (مجدولة يومياً).

---

## أنواع الحسابات والصلاحيات

### الحساب العادي
- جميع الخدمات الأساسية (غرف، ألعاب، هدايا، مطابقات).
- يمكنه التقديم لوكالة أو الانضمام كمضيف.
- `agencyRole: null`, `isAgent: false`.

### حساب المضيف / المضيفة
- يُمنح عند الانضمام لوكالة وتوثيق الجنس **أنثى**.
- حقول Firestore: `agencyRole: 'host'`, `isFemaleHost: true`, `agencyId`.
- **المزايا المنفَّذة:**
  - تُحسب ضمن شرط الـ10 إناث لتفعيل الوكالة.
  - يمكن تحويل اللؤلؤ للوكيل عبر `collect.tsx`.
- **المزايا المخططة (لاحقاً):**
  - إعفاء من كوينز المكالمات والمطابقات والرسائل.
  - إحصائيات خاصة بالمضيف (من شحن مؤخراً، فائزو الكازينو).

### حساب الوكيل
- يُمنح عند تفعيل وكالة.
- حقول Firestore: `isAgent: true`, `agencyRole: 'owner'`, `agencyId`.
- **الصلاحيات المنفَّذة:**
  - إدارة الوكالة الكاملة (دعوة، إزالة، إدارة الأعضاء).
  - جمع لؤلؤ المضيفات عبر نظام السحب (`collect.tsx`).
  - الاطلاع على إحصائيات الوكالة في `agency/center`.
- **المزايا المخططة (لاحقاً):**
  - تواصل مجاني مع المضيفين التابعين (رسائل + مكالمات).
  - عرض أرصدة المضيفين ضمن حدود النظام.

---

## Cloud Functions

| الدالة | الغرض |
|--------|--------|
| `submitAgencyApplication` | تقديم الطلب + واتساب + SLA + فريق المراجعة |
| `reviewAgencyApplication` | موافقة / رفض من الإدارة |
| `confirmAgencyHostGender` | توثيق ذاتي للجنس من الملف |
| `adminVerifyAgencyHost` | توثيق يدوي (الإناث فقط — الإدارة) |
| `activateAgencyApplication` | تفعيل الوكالة عند الاكتمال |
| `acceptAgencyHostInviteByCode` | انضمام بكود الدعوة |
| `sendAgencyHostInvite` | دعوة مباشرة من الوكيل |
| `acceptDirectAgencyInvite` | قبول دعوة مباشرة |
| `rejectDirectAgencyInvite` | رفض دعوة مباشرة |
| `checkExpiredAgencyApplications` | إغلاق المهلة المنتهية (مجدولة يومياً) |
| `notifyUser` | إشعار in-app + FCM push لكل أحداث الوكالة |

### دالة `notifyUser` — التدفق

```typescript
// 1. تكتب إشعاراً في Firestore (notifications/{id})
// 2. تقرأ fcmToken من users/{uid}
// 3. تُرسل FCM push (best-effort، لا تُوقف العملية عند الفشل)
await admin.messaging().send({ token, notification, apns, android });
```

---

## تسجيل FCM Token (التطبيق)

```
_layout.tsx
  └── <FcmRegistrar />                  # يُراقب تغيير uid
        └── registerFcmToken(uid)       # عند تسجيل الدخول
              └── users/{uid}.fcmToken  # يُكتب في Firestore
        └── clearFcmToken(uid)          # عند تسجيل الخروج
```

**الملفات:**
- `src/services/firebase/pushNotifications.ts` — `registerFcmToken`, `clearFcmToken`
- `src/components/FcmRegistrar.tsx` — مكوّن صامت، يُوضع في `_layout.tsx`

---

## بوت الدعم — تدفق تقديم الطلب

```
chat/[userId].tsx (مع linkup_support)
  └── بطاقة «فتح طلب وكالة»
        └── router.push('/agency/apply?source=chat')
              └── apply.tsx
                    ├── source === 'chat' → submitAgencyApplication({ source: 'support_bot' })
                    ├── sendAgencyApplicationConfirmation(uid)  ← رسالة تأكيد في الدردشة
                    └── router.replace('/chat/linkup_support')
```

**الملفات:**
- `src/services/supportAccount.ts` — `sendAgencyApplicationConfirmation`, `AGENCY_SUPPORT_HINT`
- `app/chat/[userId].tsx` — بطاقة الدعم + زر التقديم
- `app/agency/apply.tsx` — قراءة `source=chat` + `source: 'support_bot'`

---

## التطبيق — الشاشات

| الشاشة | المسار | الوظيفة |
|--------|--------|---------|
| قائمة الوكالات | `app/agencies/index.tsx` | الانضمام بكود + استعراض |
| تقديم الطلب | `app/agency/apply.tsx` | نموذج الطلب (app + chat) |
| مركز الوكالة | `app/agency/center.tsx` | تتبع الحالة + الكود + الإحصائيات |
| توثيق مضيفة | `app/agency/confirm-host.tsx` | تأكيد الجنس |
| دعوة مضيفين | `app/agency/invite.tsx` | دعوة مباشرة |
| دعواتي | `app/agency/my-invites.tsx` | قبول/رفض دعوات |
| أعضاء الوكالة | `app/agency/members.tsx` | إدارة الأعضاء |
| جمع لؤلؤ | `app/agency/collect.tsx` | الوكيل يجمع من المضيفات |
| BD Center | `app/agency/bd-center.tsx` | دعوات الـ BD |
| دردشة الدعم | `app/chat/[userId].tsx` | مع `linkup_support` |
| الإشعارات | `app/notifications.tsx` | deep links لأحداث الوكالة |

---

## لوحة التحكم

| الميزة | الملف |
|--------|-------|
| قائمة الطلبات + فلاتر | `src/pages/AgencyApplications.tsx` |
| فلتر الفريق gcc/global | نفس الملف |
| تنبيه SLA متأخر | نفس الملف |
| عمود المضيفات (femaleHostCount) | `src/services/admin.ts` |
| مصدر الطلب (app / support_bot) | Badge في نافذة التفاصيل |
| موافقة / رفض / تفعيل فوري | أزرار + Cloud Functions |
| توثيق يدوي (إناث فقط) | `adminVerifyAgencyHost` |
| إنشاء وكالة مباشرة | تبويب «إنشاء» |

---

## Firestore Security Rules (المهم)

```javascript
match /agencyApplications/{id} {
  allow read:   if request.auth != null && isOwner(id);
  allow create: if false;   // عبر Cloud Function فقط
  allow update: if false;
  allow delete: if false;
}
```

---

## Firestore Indexes المطلوبة

```json
{ "collectionGroup": "agencyMembers", "fields": [
    { "fieldPath": "uid", "order": "ASCENDING" },
    { "fieldPath": "hostVerified", "order": "ASCENDING" }
]}
```

---

## نشر

```bash
cd linkup-functions/functions && npm run build && cd ..

# الكل
firebase deploy --only firestore:rules,firestore:indexes,functions

# دوال الوكالة فقط
firebase deploy --only \
  functions:submitAgencyApplication,\
  functions:reviewAgencyApplication,\
  functions:confirmAgencyHostGender,\
  functions:adminVerifyAgencyHost,\
  functions:activateAgencyApplication,\
  functions:acceptAgencyHostInviteByCode,\
  functions:sendAgencyHostInvite,\
  functions:acceptDirectAgencyInvite,\
  functions:rejectDirectAgencyInvite,\
  functions:checkExpiredAgencyApplications
```

تأكد أن `admins/{uid}` موجود في Firestore قبل استخدام دوال الإدارة.
