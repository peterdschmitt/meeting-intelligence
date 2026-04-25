'use client';

import { useState } from 'react';

export default function TopBar() {
  const [query, setQuery] = useState('');

  return (
    <header className="apex-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
        <div style={{ position: 'relative' }}>
          <span
            className="material-symbols-outlined"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--apex-text-muted)',
              fontSize: 18,
              pointerEvents: 'none',
            }}
          >
            search
          </span>
          <input
            className="apex-search"
            placeholder="Search meetings, people, action items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          aria-label="Command menu"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--apex-border)',
            borderRadius: '0.5rem',
            color: 'var(--apex-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            keyboard_command_key
          </span>
        </button>
        <button
          aria-label="Notifications"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--apex-border)',
            borderRadius: '0.5rem',
            color: 'var(--apex-text-secondary)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            notifications
          </span>
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 9,
              width: 6,
              height: 6,
              background: 'var(--apex-primary)',
              borderRadius: '9999px',
            }}
          />
        </button>
      </div>
    </header>
  );
}
