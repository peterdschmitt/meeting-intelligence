'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryNav = [
  { href: '/',             icon: 'space_dashboard', label: 'Inbox' },
  { href: '/meetings',     icon: 'event_note',      label: 'Meetings' },
  { href: '/action-items', icon: 'checklist',       label: 'Action Items' },
  { href: '/contacts',     icon: 'group',           label: 'People' },
  { href: '/companies',    icon: 'business',        label: 'Companies' },
];

const secondaryNav = [
  { href: '/import', icon: 'cloud_upload', label: 'Import' },
];

const MIN_WIDTH = 160;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 208;

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const [draggingState, setDraggingState] = useState(false);

  useEffect(() => { widthRef.current = width; }, [width]);

  // Restore persisted width on mount (avoids hydration mismatch by deferring)
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('sidebar-width') ?? '', 10);
    if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
      setWidth(saved);
    }
  }, []);

  // Global drag listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      setWidth(next);
    };
    const handleUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setDraggingState(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('sidebar-width', String(widthRef.current)); } catch {}
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setDraggingState(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Double-click handle: reset to default
  const resetWidth = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    try { localStorage.setItem('sidebar-width', String(DEFAULT_WIDTH)); } catch {}
  }, []);

  // Below ~180px, hide the "Meeting Intelligence" sub-label so the brand line stays clean
  const compact = width < 180;

  return (
    <aside
      className="apex-sidebar"
      style={{ width, minWidth: width, position: 'relative' }}
    >
      {/* Brand */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--apex-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 24, height: 24,
              background: 'var(--apex-primary)',
              borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 14 }}>
              forest
            </span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--apex-text)', lineHeight: 1.1, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Pine Lake
            </div>
            {!compact && (
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--apex-text-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Meeting Intelligence
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create CTA */}
      <div style={{ padding: '10px 8px 4px' }}>
        <Link href="/import" className="btn btn-primary" style={{ width: '100%', height: 28, fontSize: 12 }}>
          <span className="material-symbols-outlined">add</span>
          New
          {!compact && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>⌘N</span>
          )}
        </Link>
      </div>

      {/* Primary */}
      <nav style={{ flex: 1, padding: '8px 8px', overflow: 'auto', minWidth: 0 }}>
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
            title={item.label}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          </Link>
        ))}

        <div className="apex-nav-section-label" style={{ marginTop: 14 }}>{compact ? '·' : 'Workspace'}</div>
        {secondaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`apex-nav-item${isActive(item.href) ? ' active' : ''}`}
            title={item.label}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer: user */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--apex-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', minWidth: 0 }}>
          <div className="avatar accent" style={{ width: 24, height: 24, fontSize: 10 }}>P</div>
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--apex-text)', lineHeight: 1.1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Peter Schmitt
            </p>
            {!compact && (
              <p style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--apex-text-faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Managing Director
              </p>
            )}
          </div>
          <button className="btn-icon" aria-label="Settings">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>settings</span>
          </button>
        </div>
      </div>

      {/* Drag handle on the right edge */}
      <div
        onMouseDown={startDrag}
        onDoubleClick={resetWidth}
        title="Drag to resize · Double-click to reset"
        className={`sidebar-drag-handle${draggingState ? ' dragging' : ''}`}
        aria-label="Resize sidebar"
        role="separator"
      />
    </aside>
  );
}
