import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, LogIn } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { adminLogin } from '@/services/v2AdminAuth';
import { ADMIN_BASE } from '@/lib/adminPaths';
import { recordAdminLoginSession } from '@/services/adminSession';
import { logAdminAction } from '@/services/admin';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kickNote, setKickNote] = useState('');

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('admin_kick_msg');
      if (msg) {
        setKickNote(msg);
        sessionStorage.removeItem('admin_kick_msg');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1) تسجيل الدخول على سيرفرنا — هو الذي يتحقق من كلمة المرور
      //    ومن أن الحساب إداري فعلاً (AdminGuard على /admin/me).
      //    لا مفاتيح قاعدة بيانات في المتصفح بعد الآن.
      const admin = await adminLogin(email, password);

      // 2) مفاتيح الجلسة التي تقرأها صفحات اللوحة كما هي — بلا تغيير في الصفحات.
      localStorage.setItem('admin_auth', 'true');
      localStorage.setItem('admin_uid', admin.uid);
      localStorage.setItem('admin_email', email.trim());
      localStorage.setItem('admin_name', admin.name || email.trim());

      // 3) تسجيل الجلسة على السيرفر (IP + موقع + جهاز)
      try {
        const session = await recordAdminLoginSession();
        await logAdminAction(
          'تسجيل دخول لوحة التحكم',
          admin.name || email,
          `${session.ip || 'IP؟'} · ${[session.location?.city, session.location?.country].filter(Boolean).join('، ') || 'موقع غير معروف'}`,
        );
      } catch (sessionErr) {
        console.warn('recordAdminLoginSession failed:', sessionErr);
      }

      navigate(ADMIN_BASE);
    } catch (err: any) {
      // 401 = كلمة مرور/حساب خاطئ. 403 = حساب حقيقي لكنه ليس إدارياً — رسالتان
      // مختلفتان لأن السببين مختلفان تماماً.
      const status: number = err?.status ?? 0;
      const code: string = err?.code ?? '';
      if (status === 401) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (status === 403 || code === 'not-admin') {
        setError('هذا الحساب لا يملك صلاحية الوصول للوحة التحكم');
      } else if (code === 'network') {
        setError('تعذّر الاتصال بالخادم — تأكد أن الرابط صحيح وأن السيرفر يعمل');
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

        {kickNote && (
          <div style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309', padding: '10px 14px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {kickNote}
          </div>
        )}

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
          استخدم حساب LinkUp الخاص بك — يجب أن يكون دوره <b>admin</b> أو <b>superadmin</b>.<br />
          الدخول يتم على سيرفر التطبيق نفسه، بنفس كلمة مرور الحساب.
        </p>
      </div>
    </div>
  );
}
