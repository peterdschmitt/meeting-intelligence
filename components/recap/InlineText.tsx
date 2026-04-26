'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string | null;
  placeholder?: string;
  onSave: (next: string) => Promise<void> | void;
  multiline?: boolean;
  fontSize?: number;
  color?: string;
}

export default function InlineText({ value, placeholder = 'Click to edit…', onSave, multiline = false, fontSize = 12.5, color }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if ('select' in ref.current) ref.current.select();
    }
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((draft ?? '') === (value ?? '')) return;
    await onSave(draft);
  };
  const cancel = () => { setDraft(value ?? ''); setEditing(false); };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          style={{
            width: '100%', minHeight: 80, fontSize, lineHeight: 1.55,
            color: color ?? 'var(--apex-text-secondary)',
            background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
            borderRadius: 4, padding: '8px 10px', font: 'inherit', resize: 'vertical',
          }}
        />
      );
    }
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); }}
        style={{
          width: '100%', fontSize, color: color ?? 'var(--apex-text-secondary)',
          background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
          borderRadius: 4, padding: '4px 8px', font: 'inherit',
        }}
      />
    );
  }

  const display = (value ?? '').trim();
  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        display: 'inline-block', fontSize, lineHeight: 1.55,
        color: display ? (color ?? 'var(--apex-text-secondary)') : 'var(--apex-text-faint)',
        cursor: 'text', whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        minWidth: 40, padding: '2px 0',
      }}
      title="Click to edit"
    >
      {display || placeholder}
    </span>
  );
}
