import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
type ToastState = { id: number; kind: ToastKind; message: string } | null;

/** إشعار عائم (بديل alert()) — يظهر لثوانٍ ثم يختفي تلقائياً، ويمكن إغلاقه يدوياً. */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setToast({ id, kind, message });
    timerRef.current = setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 3500);
  }, []);

  const showSuccess = useCallback((message: string) => show('success', message), [show]);
  const showError = useCallback((message: string) => show('error', message), [show]);
  const dismiss = useCallback(() => setToast(null), []);

  const ToastPortal = toast ? (
    <div
      style={{
        position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 500,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 12,
        background: toast.kind === 'success' ? '#10B981' : '#EF4444',
        color: '#fff', fontSize: 14, fontWeight: 600,
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        maxWidth: 380,
      }}
    >
      {toast.kind === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        type="button"
        onClick={dismiss}
        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
        aria-label="إغلاق"
      >
        <X size={16} />
      </button>
    </div>
  ) : null;

  return { showSuccess, showError, ToastPortal };
}
