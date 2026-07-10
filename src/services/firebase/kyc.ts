/**
 * التحقق من الهوية (KYC) — رفع الوثائق + فيديو + تحليل AI من السيرفر
 */
import * as FileSystem from 'expo-file-system';
import { doc, setDoc } from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { firestore, storage, auth, functions } from './index';

export type KycFileKind = 'idFront' | 'idBack' | 'selfie' | 'video' | 'frame';

export interface KycPersonalInfo {
  fullName: string;
  birthDate: string;
  nationality: string;
  phoneNumber: string;
}

/** بيانات التحقق الفوري بالوجه — الاسم فقط */
export interface KycFacePersonalInfo {
  fullName: string;
}

export interface KycUploadUrls {
  idFront: string;
  idBack: string;
  selfie: string;
  videoUrl: string;
  verificationFrameUrl: string;
}

export interface KycManualUploadUrls {
  idFront: string;
  idBack: string;
  selfie: string;
}

export interface KycSubmitResult {
  ok: boolean;
  verified?: boolean;
  pending?: boolean;
  suspended?: boolean;
  genderMismatch?: boolean;
  message?: string;
  aiGender?: string;
  aiConfidence?: number;
}

const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return response.blob();
};

const extFromUri = (uri: string, fallback: string): string => {
  const match = uri.match(/\.(\w+)(\?|$)/);
  return match?.[1]?.toLowerCase() ?? fallback;
};

/** رفع ملف KYC إلى Storage: kyc/{uid}/{kind}.{ext} */
export async function uploadKycAsset(uri: string, kind: KycFileKind): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // تجديد التوكن قبل الرفع — يمنع storage/unauthorized عند انتهاء الجلسة
  await user.getIdToken(true);

  const ext =
    kind === 'video' ? extFromUri(uri, 'mp4')
      : kind === 'frame' ? 'jpg'
        : extFromUri(uri, 'jpg');
  const path = `kyc/${user.uid}/${kind}.${ext}`;
  const fileRef = storageRef(storage, path);
  const blob = await uriToBlob(uri);
  const maxSize = kind === 'video' ? 40 * 1024 * 1024 : 12 * 1024 * 1024;
  if (blob.size > maxSize) {
    throw new Error(kind === 'video' ? 'حجم الفيديو كبير جداً (الحد 40MB)' : 'حجم الملف كبير جداً');
  }
  const contentType =
    kind === 'video'
      ? 'video/mp4'
      : blob.type?.startsWith('image/')
        ? blob.type
        : 'image/jpeg';
  await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(fileRef);
}

/** حفظ طلب KYC ثم استدعاء تحليل AI على السيرفر */
export async function submitKycVerification(
  personal: KycPersonalInfo,
  urls: KycUploadUrls,
  displayName: string,
): Promise<KycSubmitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const now = Date.now();
  await setDoc(
    doc(firestore, 'kycRequests', user.uid),
    {
      uid: user.uid,
      displayName,
      fullName: personal.fullName.trim(),
      birthDate: personal.birthDate.trim(),
      nationality: personal.nationality,
      phoneNumber: personal.phoneNumber,
      idFront: urls.idFront,
      idBack: urls.idBack,
      selfie: urls.selfie,
      videoUrl: urls.videoUrl,
      verificationFrameUrl: urls.verificationFrameUrl,
      status: 'processing',
      method: 'ai',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const fn = httpsCallable<Record<string, never>, KycSubmitResult>(
    functions,
    'processKycVerification',
  );
  const res = await fn({});
  return res.data;
}

async function uploadKycBase64Image(base64: string, kind: KycFileKind): Promise<string> {
  const b64 = base64.replace(/^data:image\/\w+;base64,/, '').trim();
  if (!b64) throw new Error('صورة غير صالحة');
  const dest = `${FileSystem.cacheDirectory}kyc_${kind}_${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(dest, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uploadKycAsset(dest, kind);
}

/**
 * تحقق سريع بالوجه — verifyGenderFace Cloud Function.
 * `framesBase64`: حتى 3 إطارات تُلتقط تلقائياً أثناء إيماءة بسيطة (تحقق حيوية) —
 * اختيارية؛ بدونها يعمل بإطار واحد كالسابق.
 */
export async function submitKycFaceVerification(
  imageBase64: string,
  fullName: string,
  displayName: string,
  framesBase64?: string[],
  gesture?: string,
): Promise<KycSubmitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const trimmedName = fullName.trim();
  const verificationImageUrl = await uploadKycBase64Image(imageBase64, 'selfie');
  const now = Date.now();
  await setDoc(
    doc(firestore, 'kycRequests', user.uid),
    {
      uid: user.uid,
      displayName: displayName.trim() || trimmedName,
      fullName: trimmedName,
      selfie: verificationImageUrl,
      verificationFrameUrl: verificationImageUrl,
      status: 'processing',
      method: 'face',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const fn = httpsCallable<
    {
      imageBase64: string;
      framesBase64?: string[];
      gesture?: string;
      personal: { fullName: string; displayName: string };
    },
    KycSubmitResult
  >(functions, 'verifyGenderFace');

  const res = await fn({
    imageBase64,
    ...(framesBase64 && framesBase64.length > 1 ? { framesBase64 } : {}),
    ...(gesture ? { gesture } : {}),
    personal: {
      fullName: trimmedName,
      displayName: displayName.trim() || trimmedName,
    },
  });
  return res.data;
}

/** طلب يدوي — بيانات + صور → pending للوحة التحكم (بدون AI) */
export async function submitKycManualRequest(
  personal: KycPersonalInfo,
  urls: KycManualUploadUrls,
  displayName: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const now = Date.now();
  await setDoc(
    doc(firestore, 'kycRequests', user.uid),
    {
      uid: user.uid,
      displayName,
      fullName: personal.fullName.trim(),
      birthDate: personal.birthDate.trim(),
      nationality: personal.nationality,
      phoneNumber: personal.phoneNumber,
      idFront: urls.idFront,
      idBack: urls.idBack,
      selfie: urls.selfie,
      status: 'pending',
      method: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return { ok: true, message: 'تم إرسال طلبك — ستراجعه الإدارة خلال 24–48 ساعة' };
}

/** تحقق بالفيديو فقط — رفع فيديو + تحليل AI */
export async function submitKycVideoVerification(
  personal: KycPersonalInfo,
  videoUrl: string,
  verificationFrameUrl: string,
  displayName: string,
): Promise<KycSubmitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const now = Date.now();
  await setDoc(
    doc(firestore, 'kycRequests', user.uid),
    {
      uid: user.uid,
      displayName,
      fullName: personal.fullName.trim(),
      birthDate: personal.birthDate.trim(),
      nationality: personal.nationality,
      phoneNumber: personal.phoneNumber,
      videoUrl,
      verificationFrameUrl,
      status: 'processing',
      method: 'ai',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const fn = httpsCallable<Record<string, never>, KycSubmitResult>(
    functions,
    'processKycVerification',
  );
  const res = await fn({});
  return res.data;
}

/** يرفع حظراً خاطئاً من فشل توثيق سابق (قبل تحديث السيرفر) */
export async function repairKycMismatchBan(): Promise<boolean> {
  const fn = httpsCallable<Record<string, never>, { repaired?: boolean }>(
    functions,
    'repairKycMismatchBan',
  );
  const res = await fn({});
  return res.data.repaired === true;
}
