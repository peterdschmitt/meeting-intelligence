'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
  role: string | null;
  companyId: string | null;
  companyName: string | null;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Contact[] = await res.json();
      setContacts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.role?.toLowerCase().includes(q) ?? false) ||
        (c.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [contacts, search]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">People</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          style={{
            background: 'rgba(24,24,27,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e7',
            fontSize: '11px',
            padding: '8px 16px',
            outline: 'none',
            width: '220px',
          }}
        />
      </div>

      <div className="main-content">
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">People.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            {contacts.length} contacts
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p className="micro-label">Loading…</p>
          </div>
        ) : (
          <div className="glass-panel">
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 160px 200px',
                padding: '12px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span />
              <span className="micro-label">Name</span>
              <span className="micro-label">Role</span>
              <span className="micro-label">Company</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p className="micro-label">No contacts found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="data-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 160px 200px',
                    padding: '14px 24px',
                    alignItems: 'center',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      background: '#27272a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#e5e5e7',
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(c.fullName)}
                  </div>

                  {/* Name + email */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#e5e5e7', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
                      {c.fullName}
                    </p>
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        style={{ color: '#52525b', fontSize: '11px', textDecoration: 'none' }}
                      >
                        {c.email}
                      </a>
                    )}
                  </div>

                  {/* Role */}
                  <span className="micro-label" style={{ color: '#71717a' }}>{c.role ?? '—'}</span>

                  {/* Company */}
                  {c.companyName ? (
                    <span className="micro-label amber-accent">{c.companyName}</span>
                  ) : (
                    <span className="micro-label">—</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
