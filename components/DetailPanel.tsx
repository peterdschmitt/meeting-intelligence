'use client';

import { useEffect } from 'react';

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function DetailPanel({ open, onClose, title, children }: DetailPanelProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
            background: 'rgba(0,0,0,0.3)',
          }}
        />
      )}

      {/* Panel */}
      <div className={`detail-panel${open ? ' open' : ''}`}>
        <div className="detail-panel-header">
          <div>
            <div className="detail-section-label" style={{ marginBottom: 4 }}>Detail</div>
            <div className="page-title" style={{ fontSize: 12, letterSpacing: '0.05em', textTransform: 'none', fontWeight: 500 }}>
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#52525b',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 4px',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="detail-panel-body">
          {children}
        </div>
      </div>
    </>
  );
}
