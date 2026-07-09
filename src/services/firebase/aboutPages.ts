/**
 * أقسام حول التطبيق — نصوص عربي/إنجليزي من لوحة التحكم
 * Firestore: config/aboutPages
 */
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './index';

export type AboutSectionAction = 'page' | 'support' | 'url';

export interface AboutPageSection {
  id: string;
  order: number;
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  actionType: AboutSectionAction;
  externalUrl?: string;
}

export interface AboutPagesConfig {
  appVersion: string;
  sections: AboutPageSection[];
}

export const DEFAULT_ABOUT_PAGES: AboutPagesConfig = {
  appVersion: '1.0.0',
  sections: [
    {
      id: 'terms',
      order: 1,
      enabled: true,
      titleAr: 'شروط الخدمة',
      titleEn: 'Terms of Service',
      contentAr: 'باستخدامك تطبيق LinkUp فإنك توافق على الالتزام بشروط الخدمة هذه.\n\nيُحظر استخدام التطبيق لأي نشاط غير قانوني أو مسيء. نحتفظ بحق تعليق أو إنهاء الحسابات المخالفة.',
      contentEn: 'By using LinkUp you agree to these Terms of Service.\n\nIllegal or abusive use is prohibited. We may suspend or terminate violating accounts.',
      actionType: 'page',
    },
    {
      id: 'privacy',
      order: 2,
      enabled: true,
      titleAr: 'سياسة الخصوصية',
      titleEn: 'Privacy Policy',
      contentAr: 'نحترم خصوصيتك. نجمع البيانات الضرورية لتشغيل الخدمة وتحسين تجربتك.\n\nلا نبيع بياناتك الشخصية لأطراف ثالثة.',
      contentEn: 'We respect your privacy. We collect data needed to operate the service and improve your experience.\n\nWe do not sell your personal data to third parties.',
      actionType: 'page',
    },
    {
      id: 'copyright',
      order: 3,
      enabled: true,
      titleAr: 'إشعار حقوق الملكية',
      titleEn: 'Copyright Notice',
      contentAr: 'جميع المحتويات والعلامات التجارية في LinkUp محمية بموجب قوانين حقوق الملكية الفكرية.',
      contentEn: 'All content and trademarks in LinkUp are protected by intellectual property laws.',
      actionType: 'page',
    },
    {
      id: 'child-safety',
      order: 4,
      enabled: true,
      titleAr: 'سياسة حماية الأطفال',
      titleEn: 'Child Safety Policy',
      contentAr: 'نلتزم بحماية القُصّر. يُمنع استخدام التطبيق من قبل من هم دون السن القانوني دون إشراف ولي الأمر.',
      contentEn: 'We are committed to protecting minors. The app must not be used by underage users without parental supervision.',
      actionType: 'page',
    },
    {
      id: 'music',
      order: 5,
      enabled: true,
      titleAr: 'تعليمات استخدام المكتبة الموسيقية',
      titleEn: 'Music Library Usage',
      contentAr: 'الموسيقى في الغرف تخضع لتراخيص الاستخدام. يُمنع رفع أو بث محتوى مخالف لحقوق النشر.',
      contentEn: 'Room music is subject to usage licenses. Uploading or streaming infringing content is prohibited.',
      actionType: 'page',
    },
    {
      id: 'community',
      order: 6,
      enabled: true,
      titleAr: 'إرشادات المجتمع',
      titleEn: 'Community Guidelines',
      contentAr: 'كن محترماً مع الآخرين. يُمنع التحرش، خطاب الكراهية، والاحتيال.\n\nالبلاغات تُراجع من فريق الإدارة.',
      contentEn: 'Be respectful to others. Harassment, hate speech, and fraud are prohibited.\n\nReports are reviewed by our team.',
      actionType: 'page',
    },
    {
      id: 'about-us',
      order: 7,
      enabled: true,
      titleAr: 'من نحن',
      titleEn: 'About Us',
      contentAr: 'LinkUp منصة اجتماعية للبث الصوتي والدردشة والترفيه. نربط المستخدمين حول العالم.',
      contentEn: 'LinkUp is a social platform for voice streaming, chat, and entertainment. We connect users worldwide.',
      actionType: 'page',
    },
    {
      id: 'ip',
      order: 8,
      enabled: true,
      titleAr: 'حقوق الملكية الفكرية',
      titleEn: 'Intellectual Property',
      contentAr: 'للإبلاغ عن انتهاك حقوق الملكية الفكرية، تواصل معنا عبر مركز الدعم.',
      contentEn: 'To report intellectual property infringement, contact us through the support center.',
      actionType: 'page',
    },
    {
      id: 'return',
      order: 9,
      enabled: true,
      titleAr: 'سياسة الإرجاع',
      titleEn: 'Return Policy',
      contentAr: 'المشتريات الرقمية داخل التطبيق غير قابلة للاسترداد إلا حيث يقتضي القانون ذلك.',
      contentEn: 'In-app digital purchases are non-refundable except where required by law.',
      actionType: 'page',
    },
    {
      id: 'contact',
      order: 10,
      enabled: true,
      titleAr: 'تواصل معنا',
      titleEn: 'Contact Us',
      contentAr: '',
      contentEn: '',
      actionType: 'support',
    },
  ],
};

function mergeConfig(data: Partial<AboutPagesConfig> | undefined): AboutPagesConfig {
  if (!data?.sections?.length) return DEFAULT_ABOUT_PAGES;
  const defaultsById = Object.fromEntries(DEFAULT_ABOUT_PAGES.sections.map((s) => [s.id, s]));
  const merged = data.sections.map((s) => ({
    ...defaultsById[s.id],
    ...s,
  }));
  return {
    appVersion: data.appVersion ?? DEFAULT_ABOUT_PAGES.appVersion,
    sections: merged.sort((a, b) => a.order - b.order),
  };
}

export const subscribeToAboutPages = (
  cb: (config: AboutPagesConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'aboutPages');
  return onSnapshot(
    ref,
    (snap) => {
      cb(snap.exists() ? mergeConfig(snap.data() as Partial<AboutPagesConfig>) : DEFAULT_ABOUT_PAGES);
    },
    () => cb(DEFAULT_ABOUT_PAGES),
  );
};

export const getAboutPagesOnce = async (): Promise<AboutPagesConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'aboutPages'));
    if (snap.exists()) return mergeConfig(snap.data() as Partial<AboutPagesConfig>);
  } catch { /* fallback */ }
  return DEFAULT_ABOUT_PAGES;
};

export function getEnabledAboutSections(config: AboutPagesConfig): AboutPageSection[] {
  return [...config.sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order);
}

export function getAboutSection(config: AboutPagesConfig, id: string): AboutPageSection | undefined {
  return config.sections.find((s) => s.id === id && s.enabled);
}
