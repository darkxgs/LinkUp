import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Lock, Mail, LogIn } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { auth, firestore } from '@/lib/firebase';
import { ADMIN_BASE } from '@/lib/adminPaths';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1) تسجيل دخول حقيقي عبر Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 2) ⚠️ حرج: التحقق أن هذا المستخدم أدمن فعلاً
      // (يقرأ من admins/{uid} — يجب أن تكون الوثيقة موجودة)
      const adminDoc = await getDoc(doc(firestore, 'admins', cred.user.uid));
      if (!adminDoc.exists()) {
        // ليس أدمن — اخرجه واعرض خطأ
        await signOut(auth);
        setError('هذا الحساب لا يملك صلاحية الوصول للوحة التحكم');
        setLoading(false);
        return;
      }

      // 3) حفظ معلومات الجلسة
      localStorage.setItem('admin_auth', 'true');
      localStorage.setItem('admin_uid', cred.user.uid);
      localStorage.setItem('admin_email', cred.user.email ?? '');
      navigate(ADMIN_BASE);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (code.includes('too-many-requests')) {
        setError('محاولات كثيرة، حاول لاحقاً');
      } else {
        setError('فشل تسجيل الدخول: ' + (err?.message ?? code));
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <BrandLogo size={72} className="login-brand-logo" />
        </div>
        <h1>LinkUp Admin</h1>
        <p>سجّل الدخول للوصول إلى لوحة التحكم</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">البريد الإلكتروني</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', right: 14, top: 14, color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingRight: 44 }}
                type="email"
                placeholder="admin@linkup.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: 14, top: 14, color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingRight: 44 }}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'جارٍ الدخول...' : <><LogIn size={18} /> تسجيل الدخول</>}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, lineHeight: 1.6 }}>
          استخدم حساب مسؤول مُنشأ في Firebase Authentication.<br />
          راجع ملف SETUP_ADMIN.md لإنشاء حساب الأدمن.
        </p>
      </div>
    </div>
  );
}
