import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type ConfirmState = { message: string; resolve: (ok: boolean) => void } | null;

/** نافذة تأكيد HTML (بديل confirm()) — تُستخدم عبر await confirmAsync('نص السؤال؟'). */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmAsync = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, resolve });
    });
  }, []);

  const close = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setState(null);
  };

  const ConfirmPortal = state ? (
    <div className="modal-overlay" onClick={() => close(false)}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#F59E0B" />
            تأكيد
          </h3>
          <button type="button" className="action-icon" onClick={() => close(false)}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{state.message}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={() => close(true)}>تأكيد</button>
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>إلغاء</button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmAsync, ConfirmPortal };
}
