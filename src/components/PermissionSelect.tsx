import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { NAV_SECTIONS, navItemPerm } from '@/lib/navConfig';
import type { PermissionKey } from '@/services/admin';

type Props = {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  label?: string;
};

/** قائمة منسدلة متعددة الاختيار للصلاحيات — مجمّعة حسب أقسام الشريط الجانبي، مع تحديد/إلغاء الكل لكل قسم. */
export function PermissionSelect({ value, onChange, label = 'الصلاحيات (صفحة بصفحة)' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        title: section.title,
        items: section.items
          .filter((item) => !item.superOnly && navItemPerm(item))
          .map((item) => ({ key: navItemPerm(item) as PermissionKey, label: item.label, routePath: item.routePath })),
      })).filter((s) => s.items.length > 0),
    [],
  );

  // ⚡ يطابق العنوان العربي أو routePath الإنجليزي (مثل "gifts"، "call-pricing") —
  //    حتى يعمل البحث بأي من اللغتين إن استُخدم مترجم المتصفح لعرض الواجهة بالإنجليزية.
  const q = search.trim().toLowerCase();
  const filteredSections = q
    ? sections
        .map((s) => ({
          ...s,
          items: s.items.filter(
            (it) => it.label.toLowerCase().includes(q) || it.routePath.toLowerCase().includes(q),
          ),
        }))
        .filter((s) => s.items.length > 0)
    : sections;

  const selectedCount = Object.values(value).filter(Boolean).length;
  const totalCount = sections.reduce((n, s) => n + s.items.length, 0);

  const togglePerm = (key: string) => onChange({ ...value, [key]: !value[key] });
  const toggleSection = (keys: string[], next: boolean) => {
    const patch: Record<string, boolean> = {};
    keys.forEach((k) => { patch[k] = next; });
    onChange({ ...value, ...patch });
  };

  return (
    <div className="country-select-wrap" ref={wrapRef}>
      {label && <label className="form-label">{label}</label>}
      <button
        type="button"
        className={`country-select-trigger form-input ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          {selectedCount === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>لم تُحدَّد صلاحيات بعد</span>
          ) : (
            <span>{selectedCount} من {totalCount} صفحة محدّدة</span>
          )}
        </span>
        <ChevronDown size={18} className={open ? 'rotated' : ''} />
      </button>

      {open && (
        <div className="country-select-dropdown perm-select-dropdown">
          <div className="country-select-search">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن صفحة..."
              autoFocus
            />
            {search && (
              <button type="button" className="action-icon" onClick={() => setSearch('')} aria-label="مسح">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="perm-select-list">
            {filteredSections.length === 0 ? (
              <p className="country-select-empty">لا توجد نتائج</p>
            ) : (
              filteredSections.map((section) => {
                const keys = section.items.map((it) => it.key);
                const checkedCount = keys.filter((k) => value[k]).length;
                const allChecked = checkedCount === keys.length;
                const someChecked = checkedCount > 0 && !allChecked;
                return (
                  <div key={section.title} className="perm-select-section">
                    <label className="perm-select-section-header">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked; }}
                        onChange={() => toggleSection(keys, !allChecked)}
                      />
                      <span>{section.title} — تحديد الكل</span>
                    </label>
                    {section.items.map((item) => (
                      <label key={item.key} className="perm-select-item">
                        <input
                          type="checkbox"
                          checked={!!value[item.key]}
                          onChange={() => togglePerm(item.key)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
