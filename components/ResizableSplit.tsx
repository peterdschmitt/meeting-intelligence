'use client';
import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';

interface ResizableSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftPct?: number; // 0–100, default 60
  minLeftPx?: number;
  minRightPx?: number;
  storageKey?: string; // localStorage key to persist width
}

export default function ResizableSplit({
  left, right,
  defaultLeftPct = 60,
  minLeftPx = 200,
  minRightPx = 200,
  storageKey,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startLeftPx = useRef(0);

  const getInitialPct = () => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseFloat(saved);
    }
    return defaultLeftPct;
  };

  const [leftPct, setLeftPct] = useState(defaultLeftPct);

  // Read from localStorage on mount (client only)
  useEffect(() => {
    setLeftPct(getInitialPct());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    const container = containerRef.current;
    if (container) {
      startLeftPx.current = container.offsetWidth * (leftPct / 100);
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftPct]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const totalWidth = containerRef.current.offsetWidth;
      const dx = e.clientX - startX.current;
      const newLeftPx = Math.max(minLeftPx, Math.min(totalWidth - minRightPx - 4, startLeftPx.current + dx));
      const newPct = (newLeftPx / totalWidth) * 100;
      setLeftPct(newPct);
      if (storageKey) localStorage.setItem(storageKey, String(newPct));
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minLeftPx, minRightPx, storageKey]);

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ width: `${leftPct}%`, minWidth: minLeftPx, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: '#0a0a0a' }}>
        {left}
      </div>
      <div
        className="split-divider"
        onMouseDown={onMouseDown}
        style={{ width: 4, flexShrink: 0, background: 'rgba(255,255,255,0.06)', cursor: 'col-resize', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#d97706')}
        onMouseLeave={e => { if (!dragging.current) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      />
      <div style={{ flex: 1, minWidth: minRightPx, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: '#111111' }}>
        {right}
      </div>
    </div>
  );
}
