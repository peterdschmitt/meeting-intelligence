'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Company {
  id: string;
  name: string;
  type: string | null;
  notes: string | null;
}

interface Contact {
  id: string;
  companyId: string | null;
}

interface Meeting {
  id: string;
  companyId: string | null;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [co, ct, me] = await Promise.all([
        fetch('/api/companies').then((r) => r.ok ? r.json() : []),
        fetch('/api/contacts').then((r) => r.ok ? r.json() : []),
        fetch('/api/meetings').then((r) => r.ok ? r.json() : []),
      ]);
      setCompanies(co as Company[]);
      setContacts(ct as Contact[]);
      setMeetings(me as Meeting[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const enriched = useMemo(() => {
    return companies.map((c) => ({
      ...c,
      contactCount: contacts.filter((ct) => ct.companyId === c.id).length,
      meetingCount: meetings.filter((m) => m.companyId === c.id).length,
    }));
  }, [companies, contacts, meetings]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505' }}>
      {/* Top nav */}
      <div className="top-nav">
        <div className="amber-line">
          <span className="amber-tag">Companies</span>
        </div>
        <span className="micro-label">{companies.length} total</span>
      </div>

      <div className="main-content">
        <div style={{ marginBottom: '48px' }}>
          <h1 className="page-heading">Companies.</h1>
          <p className="micro-label" style={{ marginTop: '12px' }}>
            Portfolio companies and relationships
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
                gridTemplateColumns: '40px 1fr 140px 80px 80px',
                padding: '12px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span />
              <span className="micro-label">Name</span>
              <span className="micro-label">Type</span>
              <span className="micro-label" style={{ textAlign: 'right' }}>Meetings</span>
              <span className="micro-label" style={{ textAlign: 'right' }}>Contacts</span>
            </div>

            {enriched.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p className="micro-label">No companies yet</p>
              </div>
            ) : (
              enriched.map((c) => (
                <div
                  key={c.id}
                  className="data-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 140px 80px 80px',
                    padding: '16px 24px',
                    alignItems: 'center',
                  }}
                >
                  {/* Logo/initials */}
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
                    }}
                  >
                    {getInitials(c.name)}
                  </div>

                  {/* Name */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#e5e5e7', fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
                      {c.name}
                    </p>
                    {c.notes && (
                      <p
                        style={{
                          color: '#52525b',
                          fontSize: '11px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Type */}
                  {c.type ? (
                    <span className="status-open" style={{ color: '#d97706' }}>{c.type}</span>
                  ) : (
                    <span className="micro-label">—</span>
                  )}

                  {/* Meetings count */}
                  <span
                    style={{
                      color: c.meetingCount > 0 ? '#e5e5e7' : '#52525b',
                      fontSize: '13px',
                      fontWeight: 500,
                      textAlign: 'right',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {c.meetingCount}
                  </span>

                  {/* Contacts count */}
                  <span
                    style={{
                      color: c.contactCount > 0 ? '#e5e5e7' : '#52525b',
                      fontSize: '13px',
                      fontWeight: 500,
                      textAlign: 'right',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {c.contactCount}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
