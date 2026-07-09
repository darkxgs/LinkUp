/**
 * LinkUp App — useAuth Hook
 */

import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/stores/authStore';

// ⚡ useShallow: يشترك فقط بالحقول المحددة بمقارنة سطحية، فلا يُعاد رسم الـ88 مستهلكاً
//    إلا عند تغيّر أحد هذه الحقول فعلياً (الأكشنز مستقرة المرجع في zustand).
//    سابقاً كان useAuthStore() بلا selector يعيد الرسم عند أي تغيّر في الستور.
export const useAuth = () =>
  useAuthStore(
    useShallow((s) => ({
      user: s.user,
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
      authReady: s.authReady,
      error: s.error,
      register: s.register,
      login: s.login,
      loginWithAccountId: s.loginWithAccountId,
      resetPassword: s.resetPassword,
      verifyPassword: s.verifyPassword,
      changePassword: s.changePassword,
      requestAccountDeletionWithPassword: s.requestAccountDeletionWithPassword,
      cancelAccountDeletionRequest: s.cancelAccountDeletionRequest,
      signOut: s.signOut,
      updateUserData: s.updateUserData,
      refreshUser: s.refreshUser,
      clearError: s.clearError,
    })),
  );
