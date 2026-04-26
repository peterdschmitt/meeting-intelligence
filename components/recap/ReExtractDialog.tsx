'use client';

import { useState } from 'react';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function ReExtractDialog({ open, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };

  return (
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, background: 'var(--apex-panel)', border: '1px solid var(--apex-border)',
          borderRadius: 6, padding: 20, color: 'var(--apex-text)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Re-extract this meeting?</h3>
        <p style={{ margin: '12px 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--apex-text-secondary)' }}>
          The LLM will replace the following from the raw notes:
        </p>
        <ul style={{ margin: '0 0 12px 18px', fontSize: 12, lineHeight: 1.6, color: 'var(--apex-text-secondary)' }}>
          <li>Executive summary</li>
          <li>Topics</li>
          <li>Attendees</li>
          <li>Decisions</li>
          <li>Risks</li>
          <li>Opportunities</li>
          <li>Next-meeting prep (agenda, questions, outcomes)</li>
          <li>Effectiveness (time breakdown, improvement note)</li>
        </ul>
        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--apex-text-muted)' }}>
          Action items are <strong>preserved</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : 'Re-extract'}
          </button>
        </div>
      </div>
    </div>
  );
}
