import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X, Shield, Layout, Settings } from 'lucide-react';
import { NAV_SECTIONS, navItemPerm, type SubPermission } from '@/lib/navConfig';

type Props = {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  label?: string;
};

export function PermissionSelect({ value, onChange, label = 'الصلاحيات التفصيلية والعمليات' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
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
          .map((item) => ({
            key: navItemPerm(item) as string,
            label: item.label,
            routePath: item.routePath,
            subPermissions: item.subPermissions ?? [],
          })),
      })).filter((s) => s.items.length > 0),
    [],
  );

  const q = search.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            it.routePath.toLowerCase().includes(q) ||
            it.subPermissions.some(
              (sp) =>
                sp.labelAr.toLowerCase().includes(q) ||
                sp.labelEn.toLowerCase().includes(q) ||
                sp.key.toLowerCase().includes(q)
            ),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, q]);

  // Auto-expand pages when searching
  useEffect(() => {
    if (q) {
      const nextExpanded: Record<string, boolean> = {};
      filteredSections.forEach((s) => {
        s.items.forEach((it) => {
          nextExpanded[it.key] = true;
        });
      });
      setExpandedPages(nextExpanded);
    }
  }, [q, filteredSections]);

  const totalCount = useMemo(() => {
    let count = 0;
    sections.forEach((s) => {
      s.items.forEach((it) => {
        count += 2; // base page + sidebar
        count += it.subPermissions.length;
      });
    });
    return count;
  }, [sections]);

  const selectedCount = useMemo(() => {
    return Object.keys(value).filter((k) => value[k]).length;
  }, [value]);

  const togglePerm = (key: string) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const togglePageAll = (pageKey: string, subPerms: SubPermission[], next: boolean) => {
    const patch: Record<string, boolean> = {
      [pageKey]: next,
      [`${pageKey}:sidebar`]: next,
    };
    subPerms.forEach((sp) => {
      patch[sp.key] = next;
    });
    onChange({ ...value, ...patch });
  };

  const toggleSectionAll = (items: { key: string; subPermissions: SubPermission[] }[], next: boolean) => {
    const patch: Record<string, boolean> = {};
    items.forEach((it) => {
      patch[it.key] = next;
      patch[`${it.key}:sidebar`] = next;
      it.subPermissions.forEach((sp) => {
        patch[sp.key] = next;
      });
    });
    onChange({ ...value, ...patch });
  };

  const toggleExpand = (pageKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPages((prev) => ({ ...prev, [pageKey]: !prev[pageKey] }));
  };

  return (
    <div className="country-select-wrap" ref={wrapRef}>
      {label && <label className="form-label">{label}</label>}
      <button
        type="button"
        className={`country-select-trigger form-input ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'start' }}
      >
        <span>
          {selectedCount === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>لم يتم تحديد أي صلاحيات</span>
          ) : (
            <span>
              تم اختيار <strong>{selectedCount}</strong> صلاحية من إجمالي <strong>{totalCount}</strong>
            </span>
          )}
        </span>
        <ChevronDown size={18} className={open ? 'rotated' : ''} />
      </button>

      {open && (
        <div
          className="country-select-dropdown perm-select-dropdown"
          style={{ width: '100%', maxHeight: 480, overflowY: 'auto', padding: 12, borderRadius: 12, zIndex: 100 }}
        >
          <div className="country-select-search" style={{ marginBottom: 12 }}>
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن صفحة، صلاحية، أو عملية..."
              autoFocus
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
            />
            {search && (
              <button type="button" className="action-icon" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredSections.length === 0 ? (
              <p className="country-select-empty" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                لا توجد نتائج مطابقة
              </p>
            ) : (
              filteredSections.map((section) => {
                const sectionKeys: string[] = [];
                section.items.forEach((it) => {
                  sectionKeys.push(it.key, `${it.key}:sidebar`);
                  it.subPermissions.forEach((sp) => sectionKeys.push(sp.key));
                });

                const sectionCheckedCount = sectionKeys.filter((k) => value[k]).length;
                const isSectionAllChecked = sectionCheckedCount === sectionKeys.length;
                const isSectionSomeChecked = sectionCheckedCount > 0 && !isSectionAllChecked;

                return (
                  <div
                    key={section.title}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 10,
                      background: 'var(--bg-app)',
                    }}
                  >
                    {/* Section Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--border)',
                        marginBottom: 10,
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isSectionAllChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = isSectionSomeChecked;
                          }}
                          onChange={() => toggleSectionAll(section.items, !isSectionAllChecked)}
                        />
                        <span>{section.title}</span>
                      </label>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ({sectionCheckedCount} مختار)
                      </span>
                    </div>

                    {/* Section Pages/Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.items.map((item) => {
                        const pageKeys = [item.key, `${item.key}:sidebar`, ...item.subPermissions.map((s) => s.key)];
                        const pageCheckedCount = pageKeys.filter((k) => value[k]).length;
                        const isPageAllChecked = pageCheckedCount === pageKeys.length;
                        const isPageSomeChecked = pageCheckedCount > 0 && !isPageAllChecked;
                        const isExpanded = !!expandedPages[item.key];

                        return (
                          <div
                            key={item.key}
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: 8,
                            }}
                          >
                            {/* Page Header Row */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                              }}
                              onClick={(e) => toggleExpand(item.key, e)}
                            >
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>

                              <input
                                type="checkbox"
                                checked={isPageAllChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = isPageSomeChecked;
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  togglePageAll(item.key, item.subPermissions, !isPageAllChecked);
                                }}
                                style={{ cursor: 'pointer' }}
                              />

                              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{item.label}</span>

                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 'auto' }}>
                                {pageCheckedCount}/{pageKeys.length}
                              </span>
                            </div>

                            {/* Collapsible Sub-Permissions */}
                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: 10,
                                  paddingTop: 8,
                                  borderTop: '1px solid var(--border)',
                                  paddingLeft: 18,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                }}
                              >
                                {/* Access & Sidebar Sub-Permissions */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      padding: '4px 6px',
                                      borderRadius: 4,
                                      background: 'var(--bg-app)',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!value[item.key]}
                                      onChange={() => togglePerm(item.key)}
                                    />
                                    <span>فتح وعرض الصفحة 🔓</span>
                                  </label>

                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      padding: '4px 6px',
                                      borderRadius: 4,
                                      background: 'var(--bg-app)',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!value[`${item.key}:sidebar`]}
                                      onChange={() => togglePerm(`${item.key}:sidebar`)}
                                    />
                                    <span>إظهار في القائمة 📁</span>
                                  </label>
                                </div>

                                {/* Custom Granular Sub-Permissions */}
                                {item.subPermissions.length > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      marginTop: 4,
                                      paddingTop: 8,
                                      borderTop: '1px dashed var(--border)',
                                    }}
                                  >
                                    {item.subPermissions.map((sp) => (
                                      <label
                                        key={sp.key}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          fontSize: 12,
                                          cursor: 'pointer',
                                          padding: '3px 6px',
                                          borderRadius: 4,
                                          transition: 'background 0.2s',
                                        }}
                                        className="perm-select-item"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!value[sp.key]}
                                          onChange={() => togglePerm(sp.key)}
                                        />
                                        <span>{sp.labelAr}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 'auto', fontFamily: 'monospace' }}>
                                          {sp.key}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
