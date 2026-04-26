'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string | null;
  placeholder?: string;
  onSave: (next: string) => Promise<void> | void;
}

export default function BulletProse({ value, placeholder = 'Click to add…', onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((draft ?? '') === (value ?? '')) return;
    await onSave(draft);
  };
  const cancel = () => { setDraft(value ?? ''); setEditing(false); };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = `${ref.current.scrollHeight}px`;
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
        placeholder="One bullet per line."
        style={{
          width: '100%', minHeight: 100, fontSize: 12.5, lineHeight: 1.6,
          color: 'var(--apex-text-secondary)', background: 'var(--apex-panel)',
          border: '1px solid var(--apex-border)', borderRadius: 4,
          padding: '8px 10px', font: 'inherit', resize: 'vertical',
        }}
      />
    );
  }

  const lines = (value ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ display: 'inline-block', fontSize: 12, color: 'var(--apex-text-faint)', cursor: 'text', padding: '2px 0' }}
      >
        {placeholder}
      </span>
    );
  }
  return (
    <ul
      onClick={() => setEditing(true)}
      style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.65, color: 'var(--apex-text-secondary)', cursor: 'text' }}
      title="Click to edit"
    >
      {lines.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
    </ul>
  );
}
