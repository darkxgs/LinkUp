import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { ALL_COUNTRIES, filterCountries, getCountryByCode } from '@/data/countries';

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  required?: boolean;
};

export function CountrySelect({ value, onChange, label = 'الدولة', required }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = getCountryByCode(value);
  const list = useMemo(() => filterCountries(search), [search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="country-select-wrap" ref={wrapRef}>
      {label && (
        <label className="form-label">
          {label}
          {required && ' *'}
        </label>
      )}
      <button
        type="button"
        className={`country-select-trigger form-input ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          {selected ? (
            <>
              <span className="country-select-flag">{flagEmoji(selected.code)}</span>
              {selected.name}
              <span className="country-select-code">({selected.code})</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>اختر الدولة...</span>
          )}
        </span>
        <ChevronDown size={18} className={open ? 'rotated' : ''} />
      </button>

      {open && (
        <div className="country-select-dropdown">
          <div className="country-select-search">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الرمز..."
              autoFocus
            />
            {search && (
              <button type="button" className="action-icon" onClick={() => setSearch('')} aria-label="مسح">
                <X size={14} />
              </button>
            )}
          </div>
          <ul className="country-select-list" role="listbox">
            {list.length === 0 ? (
              <li className="country-select-empty">لا توجد نتائج</li>
            ) : (
              list.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === value}
                    className={c.code === value ? 'selected' : ''}
                    onClick={() => {
                      onChange(c.code);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="country-select-flag">{flagEmoji(c.code)}</span>
                    <span className="country-select-name">{c.name}</span>
                    <span className="country-select-code">{c.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** علم إيموجي من رمز ISO */
export function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  const u = code.toUpperCase();
  return String.fromCodePoint(
    ...[...u].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)),
  );
}

export function formatCountryLabel(code: string): string {
  const c = getCountryByCode(code);
  return c ? `${c.name} (${c.code})` : code || '—';
}

export function getCountryName(code: string): string {
  return getCountryByCode(code)?.name ?? (code || '—');
}

type CountryBadgeProps = {
  code: string;
  showCode?: boolean;
  size?: 'sm' | 'md';
};

export function CountryBadge({ code, showCode = false, size = 'md' }: CountryBadgeProps) {
  const name = getCountryName(code);
  return (
    <span className={`country-badge country-badge--${size}`} title={formatCountryLabel(code)}>
      <span className="country-badge-flag" aria-hidden>{flagEmoji(code)}</span>
      <span className="country-badge-name">{name}</span>
      {showCode && code ? <span className="country-badge-code">{code}</span> : null}
    </span>
  );
}
