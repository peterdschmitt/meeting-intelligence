'use client';

import { useRef, useState } from 'react';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

// ─── Paste Notes Tab ──────────────────────────────────────────────────────────
function PasteNotesPanel() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/import/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Meeting',
          rawNotes: notes.trim(),
          meetingDate: date || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { meeting?: { id: string } };
      setResult({ type: 'success', msg: `Meeting saved successfully!${data.meeting?.id ? ' ID: ' + data.meeting.id : ''}` });
      setTitle('');
      setDate('');
      setNotes('');
    } catch (err) {
      setResult({ type: 'error', msg: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(24,24,27,0.6)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e5e5e7',
    fontSize: '13px',
    padding: '10px 16px',
    outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label className="micro-label" style={{ display: 'block', marginBottom: '8px' }}>Meeting Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 Portfolio Review"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="micro-label" style={{ display: 'block', marginBottom: '8px' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>
      </div>

      <div>
        <label className="micro-label" style={{ display: 'block', marginBottom: '8px' }}>Notes / Transcript</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your meeting transcript or notes here…"
          rows={12}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
        />
        <p className="micro-label" style={{ marginTop: '6px', textAlign: 'right' }}>
          {notes.length.toLocaleString()} chars
        </p>
      </div>

      {result && (
        <div
          style={{
            padding: '12px 16px',
            background: result.type === 'success' ? 'rgba(217,119,6,0.1)' : 'rgba(255,100,100,0.1)',
            border: `1px solid ${result.type === 'success' ? 'rgba(217,119,6,0.3)' : 'rgba(255,100,100,0.3)'}`,
            color: result.type === 'success' ? '#d97706' : '#f87171',
            fontSize: '12px',
          }}
        >
          {result.msg}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={!notes.trim() || loading}
          className="btn-amber"
          style={{ opacity: !notes.trim() || loading ? 0.5 : 1 }}
        >
          {loading ? 'Importing…' : 'Extract & Save'}
        </button>
      </div>
    </form>
  );
}

// ─── Google Drive Panel ───────────────────────────────────────────────────────
function GoogleDrivePanel() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setResult(null);
    setFiles([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/import/gdrive/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DriveFile[] = await res.json();
      setFiles(data);
      if (data.length === 0) setResult({ type: 'error', msg: 'No Google Docs found.' });
    } catch (err) {
      setResult({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch('/api/import/gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { imported: number };
      setResult({ type: 'success', msg: `Successfully imported ${data.imported} meeting(s)!` });
      setSelected(new Set());
      setFiles([]);
    } catch (err) {
      setResult({ type: 'error', msg: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p className="micro-label" style={{ marginBottom: '16px', color: '#71717a' }}>
          Connect to Google Drive to import meeting documents directly.
        </p>
        <button onClick={loadFiles} disabled={loading || importing} className="btn-primary">
          {loading ? 'Loading…' : 'Load Drive Files'}
        </button>
      </div>

      {result && (
        <div
          style={{
            padding: '12px 16px',
            background: result.type === 'success' ? 'rgba(217,119,6,0.1)' : 'rgba(255,100,100,0.1)',
            border: `1px solid ${result.type === 'success' ? 'rgba(217,119,6,0.3)' : 'rgba(255,100,100,0.3)'}`,
            color: result.type === 'success' ? '#d97706' : '#f87171',
            fontSize: '12px',
          }}
        >
          {result.msg}
        </div>
      )}

      {files.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="micro-label">{files.length} files found</span>
            {selected.size > 0 && (
              <span className="micro-label amber-accent">{selected.size} selected</span>
            )}
          </div>

          <div className="glass-panel" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {files.map((file) => {
              const isSel = selected.has(file.id);
              return (
                <div
                  key={file.id}
                  onClick={() => toggleSelect(file.id)}
                  className="data-row"
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    background: isSel ? 'rgba(217,119,6,0.08)' : undefined,
                  }}
                >
                  <div
                    style={{
                      width: '16px', height: '16px',
                      border: `1px solid ${isSel ? '#d97706' : 'rgba(255,255,255,0.2)'}`,
                      background: isSel ? '#d97706' : 'transparent',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {isSel && <span style={{ color: '#000', fontSize: '10px', fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: '#e5e5e7', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </p>
                    <span className="micro-label">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="btn-amber"
              style={{ opacity: selected.size === 0 || importing ? 0.5 : 1 }}
            >
              {importing ? 'Importing…' : `Import ${selected.size > 0 ? selected.size + ' Selected' : 'Selected'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ImportPage() {
  const [tab, setTab] = useState<'paste' | 'gdrive'>('paste');

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">Import</span>
        </div>
      </div>

      <div className="main-content">
        {/* Heading */}
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">Import.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            Bring meeting notes into the system
          </p>
        </div>

        {/* Two side-by-side option cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '48px' }}>
          <button
            onClick={() => setTab('paste')}
            style={{
              padding: '32px',
              background: tab === 'paste' ? 'rgba(217,119,6,0.08)' : '#050505',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: tab === 'paste' ? '2px solid #d97706' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: tab === 'paste' ? '#d97706' : '#52525b', fontSize: '24px', marginBottom: '12px', display: 'block' }}>
              content_paste
            </span>
            <p style={{ color: tab === 'paste' ? '#e5e5e7' : '#71717a', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              Paste Notes
            </p>
            <p className="micro-label">Paste a transcript or meeting notes directly</p>
          </button>

          <button
            onClick={() => setTab('gdrive')}
            style={{
              padding: '32px',
              background: tab === 'gdrive' ? 'rgba(217,119,6,0.08)' : '#050505',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: tab === 'gdrive' ? '2px solid #d97706' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: tab === 'gdrive' ? '#d97706' : '#52525b', fontSize: '24px', marginBottom: '12px', display: 'block' }}>
              drive_folder_upload
            </span>
            <p style={{ color: tab === 'gdrive' ? '#e5e5e7' : '#71717a', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              Google Drive
            </p>
            <p className="micro-label">Import meeting documents from Google Drive</p>
          </button>
        </div>

        {/* Active panel */}
        <div className="glass-panel" style={{ padding: '40px' }}>
          <div style={{ marginBottom: '24px' }}>
            <span className="micro-label amber-accent">
              {tab === 'paste' ? 'Paste Notes' : 'Google Drive'}
            </span>
          </div>
          {tab === 'paste' ? <PasteNotesPanel /> : <GoogleDrivePanel />}
        </div>
      </div>
    </div>
  );
}
