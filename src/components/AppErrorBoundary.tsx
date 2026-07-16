/**
 * AppErrorBoundary — حاجز أخطاء عام على مستوى التطبيق كاملاً.
 *
 * أي خطأ render غير مُعالَج كان يترك المستخدم على شاشة بيضاء ميتة
 * («كل ما كنت بالبرنامج بيطلعني وبتطلع الشاشة بيضاء») — هنا نلتقطه ونعرض
 * شاشة عربية ودّية مع زر «إعادة المحاولة»، ونسجّل الخطأ في الكونسول
 * وفي Firestore (clientCrashLogs) للتشخيص لاحقاً.
 *
 * ملاحظة: مكوّن class عمداً — Error Boundaries غير ممكنة بالـ hooks.
 * نستخدم مكوّنات RN الأساسية فقط (بدون ثيم/i18n) حتى تعمل الشاشة
 * حتى لو كان الخطأ نفسه قادماً من طبقة الثيم أو الترجمة.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/** تسجيل العطل في Firestore — fire-and-forget ولا يُسقط التطبيق أبداً */
function reportCrash(error: Error, componentStack?: string | null) {
  void (async () => {
    try {
      const { auth, firestore } = await import('@/services/firebase');
      const uid = auth.currentUser?.uid;
      if (!uid) return; // القواعد تشترط uid صاحب الجلسة
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(firestore, 'clientCrashLogs'), {
        uid,
        message: String(error?.message ?? error).slice(0, 1000),
        stack: String(error?.stack ?? '').slice(0, 4000),
        componentStack: String(componentStack ?? '').slice(0, 4000),
        createdAt: Date.now(),
      });
    } catch {
      // لا شيء — التسجيل تشخيصي فقط
    }
  })();
}

/**
 * تعارض معاملة Firestore حميد (سباق نسخة تفاؤلي) — رسالة الخادم الخام:
 * "the stored version (…) does not match the required base version (…)".
 * هذا خطأ عابر لا يجوز أبداً أن يُنهي التطبيق؛ نبتلعه في المعالج العام.
 */
function isBenignFirestoreContention(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';
  const msg = String((error as { message?: string })?.message ?? '');
  return (
    code === 'aborted' ||
    code === 'failed-precondition' ||
    /does not match the required base version/i.test(msg)
  );
}

// تسجيل الأخطاء القاتلة خارج شجرة React (معالجات الأحداث/الأكواد غير المتزامنة)
// — نسجّل قبل تمرير الخطأ للمعالج الأصلي؛ لكن تعارض معاملة Firestore الحميد
// نبتلعه ولا نمرّره حتى لا يُخرج المستخدم من التطبيق («يطلعني من البرنامج كله»).
try {
  const globalErrorUtils = (global as { ErrorUtils?: {
    getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler: (h: (error: Error, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (globalErrorUtils?.getGlobalHandler && globalErrorUtils?.setGlobalHandler) {
    const previousHandler = globalErrorUtils.getGlobalHandler();
    globalErrorUtils.setGlobalHandler((error, isFatal) => {
      if (isBenignFirestoreContention(error)) {
        // نسجّل فقط للتشخيص ولا نُسقط التطبيق على سباق معاملة عابر
        reportCrash(error, 'globalHandler(swallowed-firestore-contention)');
        return;
      }
      if (isFatal) reportCrash(error, 'globalHandler(fatal)');
      previousHandler?.(error, isFatal);
    });
  }
} catch {
  // اختياري بالكامل
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AppErrorBoundary caught:', error, info?.componentStack);
    reportCrash(error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.emoji}>😕</Text>
          <Text style={styles.title}>حدث خطأ غير متوقع</Text>
          <Text style={styles.subtitle}>
            نعتذر عن الإزعاج — اضغط «إعادة المحاولة» للمتابعة، وإذا تكررت
            المشكلة أغلق التطبيق وافتحه من جديد.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
          >
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
          {__DEV__ ? (
            <Text style={styles.devError} numberOfLines={12}>
              {String(this.state.error?.stack ?? this.state.error)}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    writingDirection: 'rtl',
  },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 999,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  devError: {
    marginTop: 24,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'left',
  },
});
