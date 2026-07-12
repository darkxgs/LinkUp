/**
 * حالة التوثيق — يستمع لحقول users + kycRequests كما في المشروع
 */
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';

export type KycRequestStatus =
  | 'processing'
  | 'pending'
  | 'approved'
  | 'rejected'
  /** استدعاء التحليل فشل قبل قرار السيرفر — ليست حالة نهائية؛ إعادة المحاولة متاحة فوراً */
  | 'failed'
  | null;
export type VerificationStatus = 'approved' | 'rejected' | 'pending' | null;

/** مرحلة العرض — مبنية على users + kycRequests كما في Firestore */
export type KycUiPhase =
  | 'none'
  | 'verified'
  | 'processing'
  | 'pending'
  | 'rejected';

export function resolveKycUiPhase(state: Pick<
  KycVerificationState,
  'isVerified' | 'verificationStatus' | 'kycStatus'
>): KycUiPhase {
  // طلب فاشل (الاستدعاء لم يصل للسيرفر) — كأنه لا يوجد طلب: المحاولة متاحة فوراً
  if (
    state.kycStatus === 'failed'
    && state.isVerified !== true
    && state.verificationStatus !== 'approved'
  ) {
    return 'none';
  }

  // إلغاء صريح من الإدارة — لا نعتمد على حقول KYC القديمة المتبقية
  if (state.isVerified === false) {
    if (state.verificationStatus === 'rejected' || state.kycStatus === 'rejected') {
      return 'rejected';
    }
    if (state.kycStatus === 'processing') return 'processing';
    if (state.kycStatus === 'pending' || state.verificationStatus === 'pending') {
      return 'pending';
    }
    return 'none';
  }

  if (
    state.isVerified === true
    || state.verificationStatus === 'approved'
    || state.kycStatus === 'approved'
  ) {
    return 'verified';
  }
  if (state.verificationStatus === 'rejected' || state.kycStatus === 'rejected') {
    return 'rejected';
  }
  if (state.kycStatus === 'processing') return 'processing';
  if (state.kycStatus === 'pending' || state.verificationStatus === 'pending') {
    return 'pending';
  }
  return 'none';
}

export type KycVerificationState = {
  loading: boolean;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  kycStatus: KycRequestStatus;
  verifiedAt?: number;
  rejectionReason?: string;
};

const DEFAULT: KycVerificationState = {
  loading: true,
  isVerified: false,
  verificationStatus: null,
  kycStatus: null,
};

export function useKycVerification(): KycVerificationState {
  const { user } = useAuth();
  const uid = user?.uid;
  const [userSnap, setUserSnap] = useState<Partial<KycVerificationState>>({});
  const [kycSnap, setKycSnap] = useState<{ kycStatus: KycRequestStatus; rejectionReason?: string }>({
    kycStatus: null,
  });
  const [ready, setReady] = useState({ user: false, kyc: false });

  useEffect(() => {
    if (!uid) {
      setUserSnap({});
      setKycSnap({ kycStatus: null });
      setReady({ user: true, kyc: true });
      return;
    }

    setReady({ user: false, kyc: false });

    const unsubUser = onSnapshot(
      doc(firestore, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          setUserSnap({ isVerified: false, verificationStatus: null });
        } else {
          const d = snap.data();
          setUserSnap({
            isVerified: d.isVerified === true,
            verificationStatus: (d.verificationStatus as VerificationStatus) ?? null,
            verifiedAt: typeof d.verifiedAt === 'number' ? d.verifiedAt : undefined,
          });
        }
        setReady((r) => ({ ...r, user: true }));
      },
      () => setReady((r) => ({ ...r, user: true })),
    );

    const unsubKyc = onSnapshot(
      doc(firestore, 'kycRequests', uid),
      (snap) => {
        if (!snap.exists()) {
          setKycSnap({ kycStatus: null });
        } else {
          const d = snap.data();
          setKycSnap({
            kycStatus: (d.status as KycRequestStatus) ?? null,
            rejectionReason: typeof d.rejectionReason === 'string' ? d.rejectionReason : undefined,
          });
        }
        setReady((r) => ({ ...r, kyc: true }));
      },
      () => setReady((r) => ({ ...r, kyc: true })),
    );

    return () => {
      unsubUser();
      unsubKyc();
    };
  }, [uid]);

  return useMemo(
    () => ({
      loading: !ready.user || !ready.kyc,
      isVerified: userSnap.isVerified ?? false,
      verificationStatus: userSnap.verificationStatus ?? null,
      kycStatus: kycSnap.kycStatus ?? null,
      verifiedAt: userSnap.verifiedAt,
      rejectionReason: kycSnap.rejectionReason,
    }),
    [ready, userSnap, kycSnap],
  );
}
