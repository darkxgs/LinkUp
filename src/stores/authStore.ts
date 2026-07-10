/**
 * LinkUp App — Auth Store (Email/Password)
 * Firebase Authentication الحقيقي
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  User as FirebaseUser,
} from '@firebase/auth';
import { generatePublicAccountId } from '@/utils/publicAccountId';
import { getDefaultProfileMedia } from '@/constants/defaultAvatars';
import { signInWithPublicAccountId as signInWithPublicAccountIdFn } from '@/services/firebase/accountLogin';
import { normalizePublicId, syncPublicAccountIndex } from '@/services/publicAccountIndex';
import { requestAccountDeletion, cancelAccountDeletion } from '@/services/accountSecurity';
import { readUserAgencyPrince } from '@/services/firebase/agencyPrinceSystem';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { auth, firestore, isFirebaseReady, onSnapshot } from '@/services/firebase';
import { waitForFirestoreAuth } from '@/services/firebase/authReady';
import { markOnboardingSeen } from '@/services/onboardingStorage';
import {
  statsFromFirestoreDoc,
  buildBalanceFirestoreUpdate,
  reconcileUserBalances,
} from '@/utils/userBalance';
import { parseTimestampMs } from '@/utils/joinDays';

interface UserProfile {
  displayName: string;
  avatar: string;
  bio?: string;
  gender: 'male' | 'female';
  birthYear: number;
  country: string;
  email: string;
  // الحقول الجديدة
  residence?: string;
  photos?: string[];
  voiceBio?: string;
  voiceBioDuration?: number;
  tags?: string[];
  height?: string;
  weight?: string;
  education?: string;
  job?: string;
  relationship?: string;
}

interface UserStats {
  coins: number;
  pearls: number;
  casinoCoins: number;
  level: number;
  xp: number;
  followers: number;
  following: number;
  visitors: number;
  totalRoomsCreated: number;
}

export interface User {
  uid: string;
  /** معرّف عام 8 أرقام — للنسخ ودعوة الوكالة */
  publicAccountId?: string;
  email: string;
  profile: UserProfile;
  stats: UserStats;
  createdAt: number;
  isVerified?: boolean;
  isVIP?: boolean;
  vipLevel?: number;
  vipPoints?: number;
  vipPointsMonth?: number;
  vipMonthKey?: string;
  vipExpiresAt?: number | null;
  isBanned?: boolean;
  withdrawalBlocked?: boolean;
  banReason?: string;
  wealthExpBubbles?: {
    dateKey: string;
    claimedIds: string[];
  };
  mysterySuitExpiresAt?: number | null;
  mysterySuitActive?: boolean;
  rewardsProgress?: import('@/services/firebase/rewardsCenter').RewardsProgress;
  freeMessageCards?: number;
  aristocracy?: import('@/services/firebase/aristocracySystem').AristocracyUserState;
  aristocracyLevel?: number;
  aristocracyExpiresAt?: number | null;
  aristocracyPendingReturns?: number;
  aristocracyFrozenReturns?: number;
  aristocracyAutoRenew?: boolean;
  userTitles?: import('@/services/firebase/titleSystem').UserTitlesState;
  isAgent?: boolean;
  isFemaleHost?: boolean;
  agencyRole?: 'owner' | 'host' | 'agent' | null;
  agencyId?: string | null;
  agencyName?: string | null;
  agencyPrince?: import('@/services/firebase/agencyPrinceSystem').UserAgencyPrince | null;
  /** إطار الملف الشخصي المفعّل حالياً */
  equippedFrameId?: string | null;
  frameInventory?: Record<string, number>;
  /** موظف منصة — مانيجر / سوبر أدمن / أدمن إشراف */
  staffRole?: import('@/types/platformStaff').PlatformStaffRole | null;
  staffCountries?: string[];
  staffFrameUrl?: string | null;
  staffBadgeUrl?: string | null;
  staffEntryVideoUrl?: string | null;
  staffEntryVideoUrlMp4?: string | null;
  staffAgencyId?: string | null;
  staffActive?: boolean;
  firstRechargeBonusClaimed?: boolean;
  /** إعدادات الخصوصية — النقطة الخضراء وحالة الاتصال */
  privacyHideOnline?: boolean;
  privacyHideVisitors?: boolean;
  privacySettings?: Record<string, boolean>;
  /** حقول جذر قديمة (legacy) قد توجد في وثائق حسابات سابقة — تُقرأ كاحتياط بعد profile */
  country?: string;
  phoneNumber?: string;
}

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  gender: 'male' | 'female';
  country: string;
  birthYear?: number;
  birthDay?: number;
  birthMonth?: number;
}

const CACHED_USER_KEY = '@linkup_user';

async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.uid) return null;
    const mergedStats = statsFromFirestoreDoc(parsed as unknown as Record<string, unknown>);
    const createdAt = parseTimestampMs(parsed.createdAt);
    return {
      ...parsed,
      stats: { ...DEFAULT_STATS, ...parsed.stats, ...mergedStats },
      createdAt: createdAt || 0,
    };
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** true بعد انتهاء فحص جلسة Firebase الأول — آمن للتوجيه من شاشة البداية */
  authReady: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithAccountId: (accountId: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestAccountDeletionWithPassword: (password: string) => Promise<void>;
  cancelAccountDeletionRequest: () => Promise<void>;
  updateUserData: (data: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  loadUser: (uid: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

let userDocUnsubscribe: (() => void) | null = null;
let authListenerAttached = false;

function stopUserDocListener() {
  userDocUnsubscribe?.();
  userDocUnsubscribe = null;
}

function startUserDocListener(
  uid: string,
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
) {
  stopUserDocListener();
  userDocUnsubscribe = onSnapshot(doc(firestore, 'users', uid), (snap: DocumentSnapshot) => {
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const current = get().user;
    if (!current || current.uid !== uid) return;
    const updated: User = {
      ...current,
      publicAccountId:
        data.publicAccountId != null
          ? String(data.publicAccountId)
          : current.publicAccountId,
      profile: {
        displayName: String(data.displayName ?? current.profile?.displayName ?? 'مستخدم'),
        avatar: String(data.avatar ?? current.profile?.avatar ?? ''),
        bio: data.bio != null ? String(data.bio) : current.profile?.bio,
        gender: (() => {
          const g = (data.profile as { gender?: string } | undefined)?.gender
            ?? (data.gender as string | undefined)
            ?? current.profile?.gender;
          return g === 'female' ? 'female' : 'male';
        })(),
        birthYear: Number(data.birthYear ?? current.profile?.birthYear ?? 1995),
        country: String(data.country ?? current.profile?.country ?? 'PS'),
        email: String(data.email ?? current.profile?.email ?? ''),
        photos: (data.photos as string[]) ?? current.profile?.photos ?? [],
        residence: data.residence != null ? String(data.residence) : current.profile?.residence,
        voiceBio: data.voiceBio != null ? String(data.voiceBio) : current.profile?.voiceBio,
        voiceBioDuration: data.voiceBioDuration != null ? Number(data.voiceBioDuration) : current.profile?.voiceBioDuration,
        tags: (data.tags as string[]) ?? current.profile?.tags ?? [],
        height: data.height != null ? String(data.height) : current.profile?.height,
        weight: data.weight != null ? String(data.weight) : current.profile?.weight,
        education: data.education != null ? String(data.education) : current.profile?.education,
        job: data.job != null ? String(data.job) : current.profile?.job,
        relationship: data.relationship != null ? String(data.relationship) : current.profile?.relationship,
      },
      stats: statsFromFirestoreDoc(data),
      createdAt: parseTimestampMs(data.createdAt) || current.createdAt || 0,
      isVerified: data.isVerified === true,
      isVIP: data.isVIP === true,
      vipLevel: Number(data.vipLevel ?? 0),
      vipPoints: Number(data.vipPoints ?? 0),
      vipPointsMonth: Number(data.vipPointsMonth ?? 0),
      vipMonthKey: data.vipMonthKey != null ? String(data.vipMonthKey) : undefined,
      vipExpiresAt: data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null,
      isBanned: data.isBanned === true,
      banReason: data.banReason != null ? String(data.banReason) : undefined,
      withdrawalBlocked: data.withdrawalBlocked === true,
      wealthExpBubbles: data.wealthExpBubbles as User['wealthExpBubbles'],
      mysterySuitExpiresAt: data.mysterySuitExpiresAt != null ? Number(data.mysterySuitExpiresAt) : null,
      mysterySuitActive: data.mysterySuitActive === true,
      rewardsProgress: data.rewardsProgress as User['rewardsProgress'],
      freeMessageCards: Number((data.rewardsProgress as { freeMessageCards?: number } | undefined)?.freeMessageCards ?? 0),
      aristocracy: data.aristocracy as User['aristocracy'],
      aristocracyLevel: Number(data.aristocracyLevel ?? (data.aristocracy as { level?: number } | undefined)?.level ?? 0),
      aristocracyExpiresAt: data.aristocracyExpiresAt != null ? Number(data.aristocracyExpiresAt) : ((data.aristocracy as { expiresAt?: number } | undefined)?.expiresAt ?? null),
      aristocracyPendingReturns: Number(data.aristocracyPendingReturns ?? (data.aristocracy as { pendingReturns?: number } | undefined)?.pendingReturns ?? 0),
      aristocracyFrozenReturns: Number(data.aristocracyFrozenReturns ?? 0),
      aristocracyAutoRenew: data.aristocracyAutoRenew === true,
      isAgent: data.isAgent === true,
      isFemaleHost: data.isFemaleHost === true,
      agencyRole: data.agencyRole as any,
      agencyId: data.agencyId ? String(data.agencyId) : null,
      agencyName: data.agencyName != null ? String(data.agencyName) : null,
      agencyPrince: readUserAgencyPrince(data.agencyPrince),
      userTitles: data.userTitles as User['userTitles'],
      equippedFrameId:
        data.equippedFrameId != null ? String(data.equippedFrameId) : current.equippedFrameId,
      frameInventory: (data.frameInventory as Record<string, number>) ?? current.frameInventory,
      firstRechargeBonusClaimed: data.firstRechargeBonusClaimed === true,
      // إعدادات الخصوصية — النقطة الخضراء بالبروفايل تعتمد عليها وكانت غير مُمرَّرة للستور
      privacyHideOnline: data.privacyHideOnline === true,
      privacyHideVisitors: data.privacyHideVisitors === true,
      privacySettings: (data.privacySettings as Record<string, boolean> | undefined) ?? undefined,
    };
    void AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated));
    set({ user: updated });
  });
}

const DEFAULT_STATS: UserStats = {
  coins: 0,
  pearls: 0,
  casinoCoins: 0,
  level: 1,
  xp: 0,
  followers: 0,
  following: 0,
  visitors: 0,
  totalRoomsCreated: 0,
};

/** رصيد ابتدائي صفر — لا مكافأة ترحيب عند التسجيل */
function buildNewUserStats(): UserStats {
  return { ...DEFAULT_STATS };
}

// تحويل أخطاء Firebase إلى رسائل عربية
const translateError = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجّل مسبقاً';
    case 'auth/invalid-email':
      return 'البريد الإلكتروني غير صحيح';
    case 'auth/operation-not-allowed':
      return 'التسجيل بالبريد غير مفعّل في Firebase';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)';
    case 'auth/user-disabled':
      return 'هذا الحساب محظور';
    case 'auth/user-not-found':
      return 'البريد الإلكتروني غير مسجّل';
    case 'auth/wrong-password':
      return 'كلمة المرور خاطئة';
    case 'auth/invalid-credential':
      return 'البريد أو كلمة المرور خاطئة';
    case 'auth/requires-recent-login':
      return 'أعد تسجيل الدخول ثم حاول مرة أخرى';
    case 'auth/credential-already-in-use':
      return 'هذا الحساب مربوط بمستخدم آخر';
    case 'auth/provider-already-linked':
      return 'الحساب مربوط مسبقاً';
    case 'auth/too-many-requests':
      return 'تم حظر هذا الجهاز مؤقتاً. حاول لاحقاً';
    case 'auth/network-request-failed':
      return 'تحقق من اتصال الإنترنت';
    case 'permission-denied':
      return 'لا تملك صلاحية لهذه العملية';
    case 'DEVICE_REVOKED':
      return 'تم إزالة هذا الجهاز من حسابك ولا يمكنك الدخول منه';
    case 'auth/invalid-credential':
    case 'auth/invalid-custom-token':
      return 'البريد أو كلمة المرور خاطئة';
    default:
      return 'حدث خطأ غير متوقع';
  }
};

const translateCallableLoginError = (e: { code?: string; message?: string }): string | null => {
  const fnCode = e?.code ?? '';
  const detail = String(e?.message ?? '');

  if (fnCode === 'functions/invalid-argument') {
    if (detail.includes('password-too-short')) return translateError('auth/weak-password');
    return 'INVALID_ACCOUNT_ID';
  }
  if (fnCode === 'functions/not-found') {
    if (detail.includes('account-not-found')) return 'ACCOUNT_ID_NOT_FOUND';
    return translateError('auth/network-request-failed');
  }
  if (fnCode === 'functions/failed-precondition') {
    if (detail.includes('account-no-email') || detail.includes('auth-email-missing')) {
      return 'ACCOUNT_NO_EMAIL';
    }
  }
  if (fnCode === 'functions/internal') {
    if (detail.includes('signBlob') || detail.includes('insufficient-permission')) {
      return translateError('auth/network-request-failed');
    }
    return translateError('auth/network-request-failed');
  }
  if (fnCode === 'functions/permission-denied') {
    if (detail.includes('user-disabled')) return translateError('auth/user-disabled');
    if (detail.includes('wrong-password')) return translateError('auth/wrong-password');
    return translateError('auth/wrong-password');
  }
  if (fnCode === 'functions/resource-exhausted') {
    return translateError('auth/too-many-requests');
  }
  if (fnCode === 'functions/unavailable' || fnCode === 'functions/deadline-exceeded') {
    return translateError('auth/network-request-failed');
  }
  return null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isAuthenticated: false,
  isLoading: false,
  authReady: false,
  error: null,

  // === تهيئة - التحقق من جلسة سابقة ===
  initialize: async () => {
    if (get().authReady && authListenerAttached) return;

    set({ isLoading: true, authReady: false });
    try {
      if (!isFirebaseReady()) {
        console.warn('Firebase not ready');
        return;
      }

      const cached = await readCachedUser();
      if (cached) {
        set({ user: cached, isAuthenticated: true });
      }

      const initialUser = await waitForFirestoreAuth(20_000);
      if (initialUser) {
        set({ firebaseUser: initialUser });
        await get().loadUser(initialUser.uid);
        startUserDocListener(initialUser.uid, get, set);
      } else {
        await AsyncStorage.removeItem(CACHED_USER_KEY);
        set({ user: null, isAuthenticated: false, firebaseUser: null });
      }

      if (!authListenerAttached) {
        authListenerAttached = true;
        onAuthStateChanged(auth, async (fbUser) => {
          if (!get().authReady) return;

          if (fbUser) {
            if (get().firebaseUser?.uid === fbUser.uid && get().user?.uid === fbUser.uid) {
              set({ firebaseUser: fbUser });
              return;
            }
            set({ firebaseUser: fbUser });
          await get().loadUser(fbUser.uid);
          startUserDocListener(fbUser.uid, get, set);
        } else {
          stopUserDocListener();
          await AsyncStorage.removeItem(CACHED_USER_KEY);
          set({ user: null, isAuthenticated: false, firebaseUser: null });
        }
      });
      }
    } catch (e) {
      console.error('Initialize error:', e);
    } finally {
      set({ isLoading: false, authReady: true });
    }
  },

  // === تسجيل حساب جديد ===
  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      if (!isFirebaseReady()) {
        throw new Error('Firebase غير جاهز');
      }

      // 0. تحقق من إعدادات النظام (maintenanceMode + allowRegistration) من config/settings
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const settingsSnap = await getDoc(doc(firestore, 'config', 'settings'));
        if (settingsSnap.exists()) {
          const s = settingsSnap.data() as any;
          if (s.maintenanceMode === true) {
            throw new Error('التطبيق تحت الصيانة، حاول لاحقاً');
          }
          if (s.allowRegistration === false) {
            throw new Error('التسجيل مغلق حالياً');
          }
        }
      } catch (cfgErr: any) {
        // لو رمى خطأ من إعدادات النظام، نعيد الرمي
        if (cfgErr.message?.includes('الصيانة') || cfgErr.message?.includes('التسجيل مغلق')) {
          throw cfgErr;
        }
        // وإلا نتابع بالقيم الافتراضية
      }

      // 1. إنشاء حساب Firebase Authentication
      const cred = await createUserWithEmailAndPassword(
        auth,
        data.email.trim().toLowerCase(),
        data.password,
      );
      const fbUser = cred.user;

      // 2. تحديث الاسم في Firebase Auth
      const { avatar, photos: defaultPhotos } = getDefaultProfileMedia(data.gender);
      await updateFirebaseProfile(fbUser, {
        displayName: data.displayName,
        photoURL: avatar,
      });

      // 3. إنشاء User Document في Firestore — بدون أي كوينز/مكافأة ترحيب
      const initialStats = buildNewUserStats();
      // حساب العمر من تاريخ الميلاد الكامل
      const computeAge = (): number => {
        const y = data.birthYear ?? 1995;
        const m = (data.birthMonth ?? 1) - 1;
        const d = data.birthDay ?? 1;
        const birth = new Date(y, m, d);
        const today = new Date();
        let a = today.getFullYear() - y;
        const md = today.getMonth() - m;
        if (md < 0 || (md === 0 && today.getDate() < d)) a--;
        return a;
      };
      const userAge = computeAge();
      const userDocData = {
        uid: fbUser.uid,
        publicAccountId: generatePublicAccountId(fbUser.uid),
        email: data.email.trim().toLowerCase(),
        displayName: data.displayName,
        avatar,
        bio: 'مرحباً بكم في LinkUp 👋',
        gender: data.gender,
        birthYear: data.birthYear ?? 1995,
        birthDay: data.birthDay ?? null,
        birthMonth: data.birthMonth ?? null,
        age: userAge,
        country: data.country,
        photos: defaultPhotos,
        stats: initialStats,
        ...initialStats,
        isVerified: false,
        isVIP: false,
        vipLevel: 0,
        vipPoints: 0,
        vipPointsMonth: 0,
        createdAt: Date.now(),
        lastSeen: Date.now(),
      };

      await setDoc(doc(firestore, 'users', fbUser.uid), userDocData);
      await syncPublicAccountIndex(userDocData.publicAccountId, fbUser.uid).catch(() => {});

      // 4. حفظ في الـ store
      const newUser: User = {
        uid: fbUser.uid,
        publicAccountId: userDocData.publicAccountId,
        email: data.email.trim().toLowerCase(),
        profile: {
          displayName: data.displayName,
          avatar,
          bio: userDocData.bio,
          gender: data.gender,
          birthYear: userDocData.birthYear,
          country: data.country,
          email: data.email.trim().toLowerCase(),
          photos: defaultPhotos,
        },
        stats: initialStats,
        createdAt: Date.now(),
        isVerified: false,
        isVIP: false,
      };

      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(newUser));
      set({
        user: newUser,
        firebaseUser: fbUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      void import('@/services/loginSession').then((m) => m.recordLoginSession('register'));

      // 5. إرسال رسالة ترحيب من حساب الدعم الرسمي (فشل صامت لا يعطّل التسجيل)
      try {
        const { sendWelcomeMessageIfNeeded } = await import('@/services/supportAccount');
        sendWelcomeMessageIfNeeded(); // لا ننتظرها — تعمل بالخلفية
      } catch {
        // ignore
      }
    } catch (e: any) {
      const msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل التسجيل');
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // === تسجيل دخول ===
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!isFirebaseReady()) {
        throw new Error('Firebase غير جاهز');
      }

      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
      const fbUser = cred.user;

      const { isCurrentDeviceRevoked } = await import('@/services/accountSecurity');
      if (await isCurrentDeviceRevoked(fbUser.uid)) {
        await firebaseSignOut(auth);
        throw new Error('DEVICE_REVOKED');
      }

      // تحديث lastSeen
      try {
        await updateDoc(doc(firestore, 'users', fbUser.uid), {
          lastSeen: Date.now(),
        });
      } catch {}

      // تحميل البيانات
      await get().loadUser(fbUser.uid);
      void import('@/services/loginSession').then((m) => m.recordLoginSession('email'));
      try {
        const { sendWelcomeMessageIfNeeded } = await import('@/services/supportAccount');
        void sendWelcomeMessageIfNeeded();
      } catch {
        // ignore
      }
      set({ isLoading: false, error: null });
    } catch (e: any) {
      const msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل تسجيل الدخول');
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  loginWithAccountId: async (accountId: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!isFirebaseReady()) {
        throw new Error('Firebase غير جاهز');
      }

      const normalizedId = normalizePublicId(accountId);
      const { email } = await signInWithPublicAccountIdFn(normalizedId, password);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = cred.user;

      const { isCurrentDeviceRevoked } = await import('@/services/accountSecurity');
      if (await isCurrentDeviceRevoked(fbUser.uid)) {
        await firebaseSignOut(auth);
        throw new Error('DEVICE_REVOKED');
      }

      try {
        await updateDoc(doc(firestore, 'users', fbUser.uid), {
          lastSeen: Date.now(),
        });
      } catch {}

      await get().loadUser(fbUser.uid);
      void import('@/services/loginSession').then((m) => m.recordLoginSession('accountId'));
      try {
        const { sendWelcomeMessageIfNeeded } = await import('@/services/supportAccount');
        void sendWelcomeMessageIfNeeded();
      } catch {
        // ignore
      }
      set({ isLoading: false, error: null });
    } catch (e: any) {
      let msg: string;
      const callableMsg = translateCallableLoginError(e);
      if (callableMsg) {
        msg = callableMsg;
      } else if (e?.message === 'INVALID_ACCOUNT_ID') {
        msg = 'INVALID_ACCOUNT_ID';
      } else if (e?.message === 'ACCOUNT_ID_NOT_FOUND') {
        msg = 'ACCOUNT_ID_NOT_FOUND';
      } else if (e?.message === 'ACCOUNT_NO_EMAIL') {
        msg = 'ACCOUNT_NO_EMAIL';
      } else {
        msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل تسجيل الدخول');
      }
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // === التحقق من كلمة المرور (إعادة مصادقة) ===
  verifyPassword: async (password: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser?.email) {
      throw new Error('لا يوجد بريد مرتبط بهذا الحساب');
    }
    if (!isFirebaseReady()) {
      throw new Error('Firebase غير جاهز');
    }
    const cred = EmailAuthProvider.credential(fbUser.email, password);
    try {
      await reauthenticateWithCredential(fbUser, cred);
    } catch (e: any) {
      const msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل التحقق');
      throw new Error(msg);
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    if (newPassword.length < 6) {
      throw new Error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    }
    await get().verifyPassword(currentPassword);
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('يجب تسجيل الدخول');
    try {
      await updatePassword(fbUser, newPassword);
    } catch (e: any) {
      const msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل تغيير كلمة المرور');
      throw new Error(msg);
    }
  },

  requestAccountDeletionWithPassword: async (password: string) => {
    await get().verifyPassword(password);
    const uid = auth.currentUser?.uid ?? get().user?.uid;
    if (!uid) throw new Error('يجب تسجيل الدخول');
    await requestAccountDeletion(uid);
    await get().signOut();
  },

  cancelAccountDeletionRequest: async () => {
    const uid = auth.currentUser?.uid ?? get().user?.uid;
    if (!uid) return;
    await cancelAccountDeletion(uid);
  },

  // === إعادة تعيين كلمة المرور ===
  resetPassword: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!isFirebaseReady()) {
        throw new Error('Firebase غير جاهز');
      }
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      set({ isLoading: false });
    } catch (e: any) {
      const msg = e?.code ? translateError(e.code) : (e.message ?? 'فشل الإرسال');
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // === تحديث بيانات المستخدم ===
  updateUserData: async (data: Partial<User> = {}) => {
    try {
      const current = get().user;
      if (!current) return;
      const updated = { ...current, ...data };

      if (isFirebaseReady() && auth.currentUser) {
        const patch: Record<string, unknown> = { updatedAt: Date.now() };
        if (data?.profile) Object.assign(patch, data.profile);
        if (data?.stats) Object.assign(patch, buildBalanceFirestoreUpdate(data.stats));
        if (Object.keys(patch).length > 1) {
          await updateDoc(doc(firestore, 'users', current.uid), patch as any);
        }
      }

      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated));
      set({ user: updated });
    } catch (e: any) {
      console.error('updateUserData error:', e);
    }
  },

  // === تحميل بيانات المستخدم من Firestore ===
  loadUser: async (uid: string) => {
    try {
      if (!isFirebaseReady()) return;
      try {
        const { syncVipMaintenanceForUser } = await import('@/services/firebase/vipSystem');
        await syncVipMaintenanceForUser(uid);
      } catch { /* non-blocking */ }
      await reconcileUserBalances(uid).catch(() => {});
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const user: User = {
          uid,
          publicAccountId:
            data.publicAccountId != null
              ? String(data.publicAccountId)
              : generatePublicAccountId(uid),
          email: data.email ?? '',
          profile: {
            displayName: data.displayName ?? 'مستخدم',
            avatar: data.avatar ?? '',
            bio: data.bio,
            gender: (() => {
              const g = (data.profile as { gender?: string } | undefined)?.gender
                ?? (data.gender as string | undefined);
              return g === 'female' ? 'female' : 'male';
            })(),
            birthYear: data.birthYear ?? 1995,
            country: data.country ?? 'PS',
            email: data.email ?? '',
            photos: data.photos ?? [],
            residence: data.residence,
            voiceBio: data.voiceBio,
            voiceBioDuration: data.voiceBioDuration != null ? Number(data.voiceBioDuration) : undefined,
            tags: data.tags ?? [],
            height: data.height,
            weight: data.weight,
            education: data.education,
            job: data.job,
            relationship: data.relationship,
          },
          stats: statsFromFirestoreDoc(data as Record<string, unknown>),
          createdAt: parseTimestampMs(data.createdAt) || 0,
          isVerified: data.isVerified,
          isVIP: data.isVIP,
          vipLevel: Number(data.vipLevel ?? 0),
          vipPoints: Number(data.vipPoints ?? 0),
          vipPointsMonth: Number(data.vipPointsMonth ?? 0),
          vipMonthKey: data.vipMonthKey != null ? String(data.vipMonthKey) : undefined,
          vipExpiresAt: data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null,
          isBanned: data.isBanned === true,
          withdrawalBlocked: data.withdrawalBlocked === true,
          banReason: data.banReason ? String(data.banReason) : undefined,
          wealthExpBubbles: data.wealthExpBubbles as User['wealthExpBubbles'],
          mysterySuitExpiresAt: data.mysterySuitExpiresAt != null ? Number(data.mysterySuitExpiresAt) : null,
          mysterySuitActive: data.mysterySuitActive === true,
          rewardsProgress: data.rewardsProgress as User['rewardsProgress'],
          freeMessageCards: Number((data.rewardsProgress as { freeMessageCards?: number } | undefined)?.freeMessageCards ?? 0),
          aristocracy: data.aristocracy as User['aristocracy'],
          aristocracyLevel: Number(data.aristocracyLevel ?? (data.aristocracy as { level?: number } | undefined)?.level ?? 0),
          aristocracyExpiresAt: data.aristocracyExpiresAt != null ? Number(data.aristocracyExpiresAt) : ((data.aristocracy as { expiresAt?: number } | undefined)?.expiresAt ?? null),
          aristocracyPendingReturns: Number(data.aristocracyPendingReturns ?? (data.aristocracy as { pendingReturns?: number } | undefined)?.pendingReturns ?? 0),
          aristocracyFrozenReturns: Number(data.aristocracyFrozenReturns ?? 0),
          aristocracyAutoRenew: data.aristocracyAutoRenew === true,
          isAgent: data.isAgent === true,
          isFemaleHost: data.isFemaleHost === true,
          agencyRole: data.agencyRole as any,
          agencyId: data.agencyId ? String(data.agencyId) : null,
          agencyName: data.agencyName != null ? String(data.agencyName) : null,
          agencyPrince: readUserAgencyPrince(data.agencyPrince),
          userTitles: data.userTitles as User['userTitles'],
          equippedFrameId: data.equippedFrameId != null ? String(data.equippedFrameId) : null,
          frameInventory: data.frameInventory as User['frameInventory'],
          staffRole:
            data.staffRole === 'manager' ||
            data.staffRole === 'super_admin' ||
            data.staffRole === 'admin'
              ? data.staffRole
              : null,
          staffCountries: Array.isArray(data.staffCountries)
            ? (data.staffCountries as string[]).map((c) => String(c).toUpperCase())
            : [],
          staffFrameUrl: data.staffFrameUrl != null ? String(data.staffFrameUrl) : null,
          staffBadgeUrl: data.staffBadgeUrl != null ? String(data.staffBadgeUrl) : null,
          staffEntryVideoUrl:
            data.staffEntryVideoUrl != null ? String(data.staffEntryVideoUrl) : null,
          staffEntryVideoUrlMp4:
            data.staffEntryVideoUrlMp4 != null ? String(data.staffEntryVideoUrlMp4) : null,
          staffAgencyId: data.staffAgencyId != null ? String(data.staffAgencyId) : null,
          staffActive: data.staffActive !== false,
        };
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
        set({ user, isAuthenticated: true });
        void markOnboardingSeen();
        {
          const { ensurePublicAccountId } = await import('@/services/firebase/users');
          const { syncPublicAccountIndex } = await import('@/services/publicAccountIndex');
          if (data.publicAccountId == null) {
            ensurePublicAccountId(uid).catch(() => {});
          } else {
            syncPublicAccountIndex(String(data.publicAccountId), uid).catch(() => {});
          }
        }
      }
    } catch (e: any) {
      console.error('Load user error:', e);
    }
  },

  // === إعادة تحميل بيانات المستخدم الحالي (بعد الألعاب/الهدايا/إلخ) ===
  refreshUser: async () => {
    const currentUser = get().user;
    const fbUser = auth.currentUser;
    const uid = currentUser?.uid ?? fbUser?.uid;
    if (!uid) return;
    await get().loadUser(uid);
  },

  // === تسجيل الخروج ===
  signOut: async () => {
    stopUserDocListener();
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      error: null,
    });
    try {
      await AsyncStorage.removeItem(CACHED_USER_KEY);
      if (isFirebaseReady() && auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  clearError: () => set({ error: null }),
}));
