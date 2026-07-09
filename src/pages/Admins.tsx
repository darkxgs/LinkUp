import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Pencil, X, Globe, Crown, Lock, UserCheck } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CountrySelect, formatCountryLabel } from '@/components/CountrySelect';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import {
  listAdmins, createAdminUser, updateAdminUser, deleteAdminUser,
  logAdminAction, PERMISSION_SECTIONS, type AdminProfile,
} from '@/services/admin';

const EMPTY_PERMS = () =>
  Object.fromEntries(PERMISSION_SECTIONS.map((s) => [s.key, false])) as Record<string, boolean>;

export default function AdminsPage() {
  const { isSuper, profile } = useAdminProfile();
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listAdmins().then((a) => { setAdmins(a); setLoading(false); });
  };
  useEffect(load, []);

  if (!isSuper) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Lock size={40} color="var(--text-muted)" />
          <h3 style={{ marginTop: 12 }}>غير مصرّح</h3>
          <p style={{ color: 'var(--text-muted)' }}>إدارة المشرفين متاحة لمدير النظام فقط.</p>
        </div>
      </div>
    );
  }

  const handleDelete = async (a: AdminProfile) => {
    if (a.uid === profile?.uid) return alert('لا يمكنك حذف حسابك');
    if (!confirm(`حذف المشرف "${a.name}"؟ سيُعطّل حسابه.`)) return;
    setBusy(a.uid);
    try {
      await deleteAdminUser(a.uid);
      await logAdminAction('حذف مشرف', a.name, a.email);
      load();
    } catch (e: any) { alert('فشل: ' + (e?.message ?? 'خطأ')); }
    finally { setBusy(null); }
  };

  const toggleDisabled = async (a: AdminProfile) => {
    setBusy(a.uid);
    try {
      await updateAdminUser({ targetUid: a.uid, disabled: !a.disabled });
      await logAdminAction(a.disabled ? 'تفعيل مشرف' : 'تعطيل مشرف', a.name, a.email);
      load();
    } catch (e: any) { alert('فشل: ' + (e?.message ?? 'خطأ')); }
    finally { setBusy(null); }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <ShieldCheck size={22} color="#e11212" /> المشرفون والصلاحيات
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            أنشئ مشرفين بصلاحيات محدّدة لكل دولة — كل مشرف يرى وكالات ومستخدمي دوله فقط.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)} style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Plus size={18} /> مشرف جديد
        </button>
      </div>

      <div className="card">
        {loading ? <Loading /> : admins.length === 0 ? <Empty text="لا يوجد مشرفون" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>المشرف</th><th>الدور</th><th>الدول</th><th>الصلاحيات</th><th>الحالة</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const permCount = a.role === 'super'
                    ? PERMISSION_SECTIONS.length
                    : Object.values(a.permissions ?? {}).filter(Boolean).length;
                  return (
                    <tr key={a.uid} style={a.disabled ? { opacity: 0.5 } : undefined}>
                      <td>
                        <div className="table-user-info">
                          <p>{a.name}{a.uid === profile?.uid ? ' (أنت)' : ''}</p>
                          <span>{a.email}</span>
                        </div>
                      </td>
                      <td>
                        {a.role === 'super'
                          ? <Badge variant="gold"><Crown size={11} style={{ display: 'inline', marginInlineEnd: 3 }} />مدير النظام</Badge>
                          : <Badge variant="purple">مشرف دول</Badge>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {a.role === 'super' ? 'كل الدول' : (a.countries ?? []).map(formatCountryLabel).join('، ') || '—'}
                      </td>
                      <td><Badge variant="blue">{permCount} قسم</Badge></td>
                      <td>{a.disabled ? <Badge variant="red">معطّل</Badge> : <Badge variant="green">نشط</Badge>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="action-icon edit" onClick={() => setEditing(a)} title="تعديل"><Pencil size={15} /></button>
                          {a.uid !== profile?.uid && (
                            <>
                              <button className="action-icon" onClick={() => toggleDisabled(a)} disabled={busy === a.uid} title={a.disabled ? 'تفعيل' : 'تعطيل'} style={{ color: a.disabled ? '#10B981' : '#F59E0B' }}>
                                <UserCheck size={15} />
                              </button>
                              <button className="action-icon delete" onClick={() => handleDelete(a)} disabled={busy === a.uid} title="حذف"><Trash2 size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <AdminFormModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <AdminFormModal admin={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

// ==================== نموذج إنشاء/تعديل مشرف ====================
function AdminFormModal({ admin, onClose, onSaved }: {
  admin?: AdminProfile; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!admin;
  const [email, setEmail] = useState(admin?.email ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(admin?.name ?? '');
  const [role, setRole] = useState<'super' | 'country'>(admin?.role ?? 'country');
  const [countries, setCountries] = useState<string[]>(admin?.countries ?? []);
  const [perms, setPerms] = useState<Record<string, boolean>>({ ...EMPTY_PERMS(), ...(admin?.permissions ?? {}) });
  const [pickCountry, setPickCountry] = useState('');
  const [saving, setSaving] = useState(false);

  const addCountry = (code: string) => {
    if (!code) return;
    const up = code.toUpperCase();
    setCountries((prev) => (prev.includes(up) ? prev : [...prev, up]));
    setPickCountry('');
  };
  const removeCountry = (code: string) => setCountries((prev) => prev.filter((c) => c !== code));
  const togglePerm = (key: string) => setPerms((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    if (!isEdit && (!email.trim() || password.length < 6)) return alert('بريد صالح وكلمة مرور (6+) مطلوبان');
    if (role === 'country' && countries.length === 0) return alert('اختر دولة واحدة على الأقل لمشرف الدول');
    setSaving(true);
    try {
      if (isEdit) {
        await updateAdminUser({ targetUid: admin!.uid, name, role, countries, permissions: perms });
        await logAdminAction('تعديل صلاحيات مشرف', name, admin!.email);
      } else {
        await createAdminUser({ email: email.trim(), password, name: name || email.trim(), role, countries, permissions: perms });
        await logAdminAction('إنشاء مشرف', name || email, role === 'super' ? 'مدير نظام' : countries.join('،'));
      }
      onSaved();
    } catch (e: any) { alert('فشل: ' + (e?.message ?? 'خطأ')); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{isEdit ? 'تعديل مشرف' : 'مشرف جديد'}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <Field label="الاسم">
            <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المشرف" />
          </Field>
          {!isEdit && (
            <>
              <Field label="البريد الإلكتروني">
                <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </Field>
              <Field label="كلمة المرور">
                <input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
              </Field>
            </>
          )}

          <Field label="الدور">
            <div style={{ display: 'flex', gap: 8 }}>
              <RoleBtn active={role === 'country'} onClick={() => setRole('country')} icon={<Globe size={15} />} label="مشرف دول" />
              <RoleBtn active={role === 'super'} onClick={() => setRole('super')} icon={<Crown size={15} />} label="مدير النظام" />
            </div>
          </Field>

          {role === 'country' && (
            <>
              <Field label="الدول المسموح بها">
                <CountrySelect value={pickCountry} onChange={addCountry} label="" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {countries.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>لم تُختر دول بعد</span> : countries.map((c) => (
                    <span key={c} className="country-chip">
                      {formatCountryLabel(c)}
                      <button onClick={() => removeCountry(c)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </Field>

              <Field label="الصلاحيات (الأقسام المتاحة)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PERMISSION_SECTIONS.map((s) => (
                    <label key={s.key} className={`perm-toggle ${perms[s.key] ? 'on' : ''}`}>
                      <input type="checkbox" checked={!!perms[s.key]} onChange={() => togglePerm(s.key)} />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {role === 'super' && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-app)', padding: 12, borderRadius: 10 }}>
              مدير النظام يملك صلاحية كاملة على كل الدول وكل الأقسام.
            </p>
          )}

          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء المشرف'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function RoleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="role-btn"
      style={{
        flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
        border: `1.5px solid ${active ? 'var(--brand-primary)' : 'var(--border, #E5E7EB)'}`,
        background: active ? 'rgba(225,18,18,0.08)' : 'transparent',
        color: active ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer',
      }}
    >
      {icon}{label}
    </button>
  );
}
