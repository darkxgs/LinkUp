import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

type Props = {
  id: string;
  label?: string;
  mono?: boolean;
};

export function CopyableId({ id, label, mono = true }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('انسخ المعرّف:', id);
    }
  };

  return (
    <button
      type="button"
      className="copy-id-btn"
      onClick={copy}
      title="نسخ المعرّف"
    >
      {label ? <span className="copy-id-label">{label}</span> : null}
      <span className={mono ? 'copy-id-value' : ''}>{id}</span>
      {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
    </button>
  );
}
