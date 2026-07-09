import { useEffect, useState } from 'react';
import { Shield, Plus, Pencil, Trash2, X, Crown, UserCog, BadgeCheck } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CountrySelect, formatCountryLabel } from '@/components/CountrySelect';
import { useAdminProfile } from '@/contexts/AdminProfileContext';
import {
  listPlatformStaffUsers,
  adminCreateStaffUser,
  adminUpdateStaffUser,
  adminRemoveStaffUser,
  getAgencies,
  logAdminAction,
  type PlatformStaffRow,
  type PlatformStaffRole,
  type AdminCreateStaffInput,
  type AdminAgency,
} from '@/services/admin';
import { uploadStaffAsset, uploadStaffEntryVideo, uploadStaffAgencyAsset } from '@/lib/storage';

const ROLE_OPTIONS: { value: PlatformStaffRole; label: string; desc: string }[] = [
  {
    value: 'manager',
    label: 'مانيجر',
    desc: 'تحكم كامل — كل الدول والوكالات',
  },
  {
    value: 'super_admin',
    label: 'سوبر أدمن',
    desc: 'تحكم كامل ضمن الدولة + وكالة رسمية في الاهتمامات',
  },
  {
    value: 'admin',
    label: 'أدمن إشراف',
    desc: 'إشراف فقط — مايك عادي بدون طرد',
  },
];

function roleBadge(role: PlatformStaffRole) {
  if (role === 'manager') return <Badge variant="gold"><Crown size={11} /> مانيجر</Badge>;
  if (role === 'super_admin') return <Badge variant="purple">سوبر أدمن</Badge>;
  return <Badge variant="blue">أدمن إشراف</Badge>;
}

export default function StaffPage() {
  const { isSuper, can } = useAdminProfile();
  const [rows, setRows] = useState<PlatformStaffRow[]>([]);
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PlatformStaffRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = isSuper || can('users');

  const load = () => {
    setLoading(true);
    Promise.all([listPlatformStaffUsers(), getAgencies()])
      .then(([staff, ag]) => {
        setRows(staff);
        setAgencies(ag);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (!canManage) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Shield size={40} color="var(--text-muted)" />
          <h3 style={{ marginTop: 12 }}>غير مصرّح</h3>
          <p style={{ color: 'var(--text-muted)' }}>إدارة موظفي التطبيق تتطلب صلاحية المستخدمين.</p>
        </div>
      </div>
    );
  }

  const handleRemove = async (row: PlatformStaffRow) => {
    if (!confirm(`إزالة صلاحيات الموظف "${row.displayName}"؟`)) return;
    setBusy(row.uid);
    try {
      await adminRemoveStaffUser(row.uid);
      await logAdminAction('إزالة موظف تطبيق', row.displayName, row.publicAccountId);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <UserCog size={22} color="#e11212" /> موظفو التطبيق
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            مانيجر / سوبر أدمن / أدمن إشراف — صلاحيات داخل التطبيق (منفصلة عن مشرفي اللوحة)
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setCreating(true)}
          style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}
        >
          <Plus size={18} /> موظف جديد
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="لا يوجد موظفو تطبيق بعد" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الدور</th>
                  <th>الدول</th>
                  <th>الوكالة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} style={!r.staffActive ? { opacity: 0.55 } : undefined}>
                    <td>
                      <div className="table-user-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {r.avatar ? (
                          <img src={r.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : null}
                        <div>
                          <p>{r.displayName}</p>
                          <span>{r.email || r.publicAccountId}</span>
                        </div>
                      </div>
                    </td>
                    <td>{roleBadge(r.staffRole)}</td>
                    <td style={{ fontSize: 13 }}>
                      {r.staffRole === 'manager'
                        ? 'كل الدول'
                        : r.staffCountries.map(formatCountryLabel).join('، ') || '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.staffRole === 'super_admin'
                        ? r.staffAgencyName ||
                          (r.staffAgencyId
                            ? agencies.find((a) => a.id === r.staffAgencyId)?.name ?? r.staffAgencyId
                            : '—')
                        : '—'}
                    </td>
                    <td>
                      {r.staffActive ? (
                        <Badge variant="green">نشط</Badge>
                      ) : (
                        <Badge variant="red">معطّل</Badge>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="action-icon edit" onClick={() => setEditing(r)} title="تعديل">
                          <Pencil size={15} />
                        </button>
                        {isSuper && (
                          <button
                            className="action-icon delete"
                            onClick={() => void handleRemove(r)}
                            disabled={busy === r.uid}
                            title="إزالة"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <StaffFormModal
          agencies={agencies}
          initial={editing}
          isSuper={isSuper}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StaffFormModal({
  agencies,
  initial,
  isSuper,
  onClose,
  onSaved,
}: {
  agencies: AdminAgency[];
  initial: PlatformStaffRow | null;
  isSuper: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const linkedAgency = initial?.staffAgencyId
    ? agencies.find((a) => a.id === initial.staffAgencyId)
    : undefined;
  const [form, setForm] = useState<AdminCreateStaffInput>({
    email: '',
    password: '',
    displayName: initial?.displayName ?? '',
    gender: 'male',
    country: initial?.country ?? 'PS',
    staffRole: initial?.staffRole ?? 'admin',
    staffCountries: initial?.staffCountries ?? [initial?.country ?? 'PS'],
    avatar: initial?.avatar,
    staffFrameUrl: initial?.staffFrameUrl,
    staffBadgeUrl: initial?.staffBadgeUrl,
    staffEntryVideoUrl: initial?.staffEntryVideoUrl,
    staffEntryVideoUrlMp4: initial?.staffEntryVideoUrlMp4,
    staffAgencyId: initial?.staffAgencyId,
    staffAgencyName: initial?.staffAgencyName ?? linkedAgency?.name ?? '',
    staffAgencyLogo: linkedAgency?.logo,
    staffAgencyBanner: linkedAgency?.banner,
  });
  const [staffActive, setStaffActive] = useState(initial?.staffActive !== false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const handleUpload = async (kind: 'avatar' | 'frame' | 'badge', file: File) => {
    const uid = initial?.uid ?? `new-${Date.now()}`;
    setUploading(kind);
    try {
      const url = await uploadStaffAsset(file, uid, kind);
      if (kind === 'avatar') setForm((f) => ({ ...f, avatar: url }));
      if (kind === 'frame') setForm((f) => ({ ...f, staffFrameUrl: url }));
      if (kind === 'badge') setForm((f) => ({ ...f, staffBadgeUrl: url }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
    }
  };

  const handleEntryVideoUpload = async (kind: 'video' | 'videoMp4', file: File) => {
    const uid = initial?.uid ?? `new-${Date.now()}`;
    const key = kind === 'video' ? 'entryVideo' : 'entryVideoMp4';
    setUploading(key);
    try {
      const url = await uploadStaffEntryVideo(file, uid, kind);
      if (kind === 'video') setForm((f) => ({ ...f, staffEntryVideoUrl: url }));
      else setForm((f) => ({ ...f, staffEntryVideoUrlMp4: url }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
    }
  };

  const handleAgencyAssetUpload = async (kind: 'logo' | 'banner', file: File) => {
    const uid = initial?.uid ?? `new-${Date.now()}`;
    const key = kind === 'logo' ? 'agencyLogo' : 'agencyBanner';
    setUploading(key);
    try {
      const url = await uploadStaffAgencyAsset(file, uid, kind);
      if (kind === 'logo') setForm((f) => ({ ...f, staffAgencyLogo: url }));
      else setForm((f) => ({ ...f, staffAgencyBanner: url }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الرفع');
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!isEdit) {
      if (!form.email.trim() || !form.password || form.password.length < 6) {
        return alert('بريد وكلمة مرور (6+ أحرف)');
      }
    }
    if (!form.displayName.trim()) return alert('الاسم مطلوب');
    if (form.staffRole !== 'manager' && !(form.staffCountries?.length)) {
      return alert('حدّد دولة واحدة على الأقل');
    }
    if (form.staffRole === 'manager' && !isSuper) {
      return alert('إنشاء المانيجر لمدير النظام فقط');
    }
    if (form.staffRole === 'super_admin' && !form.staffAgencyName?.trim() && !form.staffAgencyId) {
      return alert('اسم وكالة البلد مطلوب لسوبر أدمن');
    }

    setBusy(true);
    try {
      if (isEdit && initial) {
        await adminUpdateStaffUser({
          uid: initial.uid,
          staffRole: form.staffRole,
          staffCountries: form.staffRole === 'manager' ? [] : form.staffCountries,
          staffFrameUrl: form.staffFrameUrl ?? null,
          staffBadgeUrl: form.staffBadgeUrl ?? null,
          staffEntryVideoUrl: form.staffEntryVideoUrl ?? null,
          staffEntryVideoUrlMp4: form.staffEntryVideoUrlMp4 ?? null,
          staffAgencyId: form.staffAgencyId ?? null,
          staffAgencyName: form.staffAgencyName?.trim() || null,
          staffAgencyLogo: form.staffAgencyLogo ?? null,
          staffAgencyBanner: form.staffAgencyBanner ?? null,
          staffActive,
          avatar: form.avatar,
          displayName: form.displayName,
        });
        await logAdminAction('تعديل موظف تطبيق', form.displayName, initial.publicAccountId);
      } else {
        const res = await adminCreateStaffUser(form);
        await logAdminAction('إنشاء موظف تطبيق', res.displayName, res.publicAccountId);
        const agencyNote = res.agencyId ? `\nوكالة: ${form.staffAgencyName} (${res.agencyId})` : '';
        alert(`تم الإنشاء — المعرّف: ${res.publicAccountId}${agencyNote}`);
      }
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'تعديل موظف' : 'موظف تطبيق جديد'}</h3>
          <button className="action-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="form-label">نوع الموظف</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ROLE_OPTIONS.filter((o) => o.value !== 'manager' || isSuper).map((o) => (
              <label
                key={o.value}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: 8,
                  borderRadius: 8,
                  border: form.staffRole === o.value ? '2px solid #e11212' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="staffRole"
                  checked={form.staffRole === o.value}
                  onChange={() =>
                    setForm({
                      ...form,
                      staffRole: o.value,
                      staffCountries:
                        o.value === 'manager' ? [] : form.staffCountries?.length ? form.staffCountries : [form.country ?? 'PS'],
                    })
                  }
                />
                <div>
                  <strong>{o.label}</strong>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{o.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {!isEdit && (
            <>
              <Field label="البريد" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="كلمة المرور" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            </>
          )}
          <Field label="الاسم" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />

          {form.staffRole !== 'manager' && (
            <>
              <label className="form-label">دول الصلاحية</label>
              <CountrySelect
                value={form.staffCountries?.[0] ?? form.country ?? 'PS'}
                onChange={(c) => setForm({ ...form, staffCountries: [c], country: c })}
              />
            </>
          )}

          {form.staffRole === 'super_admin' && (
            <>
              <Field
                label="اسم وكالة البلد (تظهر في الاهتمامات لسكان الدولة)"
                value={form.staffAgencyName ?? ''}
                onChange={(v) => setForm({ ...form, staffAgencyName: v })}
              />
              <UploadRow
                label="شعار الوكالة"
                url={form.staffAgencyLogo}
                uploading={uploading === 'agencyLogo'}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onFile={(f) => void handleAgencyAssetUpload('logo', f)}
              />
              <UploadRow
                label="بانر الوكالة (اختياري)"
                url={form.staffAgencyBanner}
                uploading={uploading === 'agencyBanner'}
                accept="image/png,image/jpeg,image/webp"
                onFile={(f) => void handleAgencyAssetUpload('banner', f)}
              />
              {form.staffAgencyId ? (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  معرّف الوكالة: {form.staffAgencyId}
                </p>
              ) : null}
            </>
          )}

          <UploadRow
            label="صورة الملف"
            url={form.avatar}
            uploading={uploading === 'avatar'}
            onFile={(f) => void handleUpload('avatar', f)}
          />
          <UploadRow
            label="إطار الصورة (PNG / GIF)"
            url={form.staffFrameUrl}
            uploading={uploading === 'frame'}
            accept="image/png,image/jpeg,image/webp,image/gif"
            onFile={(f) => void handleUpload('frame', f)}
          />
          <UploadRow
            label="شعار الدخول (صورة ثابتة للشريط)"
            url={form.staffBadgeUrl}
            uploading={uploading === 'badge'}
            onFile={(f) => void handleUpload('badge', f)}
          />
          <UploadRow
            label="دخولية فيديو (MP4 / WebM)"
            url={form.staffEntryVideoUrl}
            uploading={uploading === 'entryVideo'}
            accept="video/mp4,video/webm,video/quicktime"
            hint="يُعرض ملء الشاشة عند الدخول — مثل SVIP"
            onFile={(f) => void handleEntryVideoUpload('video', f)}
          />
          <UploadRow
            label="دخولية فيديو iOS (MP4 احتياطي)"
            url={form.staffEntryVideoUrlMp4}
            uploading={uploading === 'entryVideoMp4'}
            accept="video/mp4,video/quicktime"
            hint="اختياري — لأجهزة iPhone"
            onFile={(f) => void handleEntryVideoUpload('videoMp4', f)}
          />

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={staffActive} onChange={(e) => setStaffActive(e.target.checked)} />
              <BadgeCheck size={16} /> حساب نشط
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'جارٍ الحفظ...' : isEdit ? 'حفظ' : 'إنشاء'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <>
      <label className="form-label">{label}</label>
      <input className="form-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

function UploadRow({
  label,
  url,
  uploading,
  accept = 'image/*',
  hint,
  onFile,
}: {
  label: string;
  url?: string;
  uploading: boolean;
  accept?: string;
  hint?: string;
  onFile: (f: File) => void;
}) {
  const isVideo = Boolean(url && /\.(mp4|webm|mov|m4v)($|\?)/i.test(url));
  return (
    <div>
      <label className="form-label">{label}</label>
      {hint ? <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)' }}>{hint}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {url && !isVideo ? (
          <img src={url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
        ) : null}
        {url && isVideo ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>✓ فيديو مرفوع</span>
        ) : null}
        <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
          {uploading ? 'جارٍ الرفع...' : 'رفع ملف'}
          <input
            type="file"
            accept={accept}
            hidden
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}
