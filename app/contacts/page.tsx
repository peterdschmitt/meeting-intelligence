'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  Building2,
  CalendarDays,
  Mail,
  Plus,
  Search,
  Users,
  X,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { cn, formatRelativeDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  companyId: string | null;
  companyName: string | null;
  meetingCount: number;
}

interface Company {
  id: string;
  name: string;
}

interface RecentMeeting {
  id: string;
  title: string;
  meetingDate: string | null;
  companyName: string | null;
}

interface ContactDetail extends Contact {
  recentMeetings: RecentMeeting[];
}

interface NewContactForm {
  name: string;
  email: string;
  role: string;
  companyId: string;
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-700',
  'from-amber-500 to-orange-600',
  'from-indigo-500 to-blue-700',
] as const;

function avatarGradient(name: string): string {
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── Animation variants ───────────────────────────────────────────────────────

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4 animate-pulse border border-white/[0.07]">
      <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/10 rounded w-1/3" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
      <div className="h-5 w-8 bg-white/10 rounded-full" />
    </div>
  );
}

// ─── Add Contact Form ─────────────────────────────────────────────────────────

interface AddContactFormProps {
  companies: Company[];
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}

function AddContactForm({ companies, onClose, onCreated }: AddContactFormProps) {
  const [form, setForm] = useState<NewContactForm>({
    name: '',
    email: '',
    role: '',
    companyId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewContactForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          role: form.role.trim() || null,
          companyId: form.companyId || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: Contact = await res.json();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="glass rounded-xl p-5 border border-violet-500/30 mb-6"
    >
      <h3 className="text-sm font-semibold text-white/80 mb-4">New Contact</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Full name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Role / title"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            className={inputCls}
          />
          <select
            value={form.companyId}
            onChange={(e) => set('companyId', e.target.value)}
            className={cn(inputCls, 'text-white/70')}
          >
            <option value="" className="bg-[#111827]">
              No company
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#111827]">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving…' : 'Add Contact'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

interface ContactCardProps {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
}

function ContactCard({ contact, isSelected, onClick }: ContactCardProps) {
  return (
    <motion.button
      variants={cardVariants}
      layout
      onClick={onClick}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        'w-full text-left glass rounded-xl p-4 flex items-center gap-4 border transition-all duration-150 group',
        isSelected
          ? 'border-violet-500/40 bg-violet-600/10'
          : 'border-white/[0.07] hover:border-white/[0.12] hover:bg-white/[0.06]',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-lg',
          avatarGradient(contact.name),
        )}
      >
        {initials(contact.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{contact.name}</p>
        <p className="text-xs text-white/45 truncate mt-0.5">
          {[contact.role, contact.companyName].filter(Boolean).join(' · ') || 'No role'}
        </p>
        {contact.email && (
          <p className="text-xs text-white/30 truncate mt-0.5">{contact.email}</p>
        )}
      </div>

      {/* Meeting badge */}
      <div className="flex items-center gap-2 shrink-0">
        {contact.meetingCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/20">
            <CalendarDays className="w-3 h-3" />
            {contact.meetingCount}
          </span>
        )}
        <ChevronRight
          className={cn(
            'w-4 h-4 transition-all duration-150',
            isSelected ? 'text-violet-400' : 'text-white/20 group-hover:text-white/40',
          )}
        />
      </div>
    </motion.button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  contact: ContactDetail | null;
  loading: boolean;
  onClose: () => void;
}

function DetailPanel({ contact, loading, onClose }: DetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/[0.07] shrink-0">
        <h2 className="text-sm font-semibold text-white/70">Contact Details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-white/10 mx-auto" />
            <div className="h-4 bg-white/10 rounded w-1/2 mx-auto" />
            <div className="h-3 bg-white/10 rounded w-1/3 mx-auto" />
            <div className="space-y-2 mt-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 bg-white/[0.04] rounded-lg" />
              ))}
            </div>
          </div>
        ) : contact ? (
          <>
            {/* Contact hero */}
            <div className="flex flex-col items-center text-center gap-2 pt-2">
              <div
                className={cn(
                  'w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xl font-bold shadow-xl',
                  avatarGradient(contact.name),
                )}
              >
                {initials(contact.name)}
              </div>
              <div>
                <p className="text-base font-semibold text-white/95">{contact.name}</p>
                {contact.role && (
                  <p className="text-xs text-white/50 mt-0.5">{contact.role}</p>
                )}
              </div>
            </div>

            {/* Info rows */}
            <div className="space-y-2">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors group"
                >
                  <Mail className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-sm text-white/70 truncate group-hover:text-white/90 transition-colors">
                    {contact.email}
                  </span>
                </a>
              )}
              {contact.companyName && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm text-white/70 truncate">{contact.companyName}</span>
                </div>
              )}
            </div>

            {/* Recent meetings */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-white/30" />
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Recent Meetings
                </h3>
                <span className="ml-auto text-xs text-white/30">
                  {contact.meetingCount} total
                </span>
              </div>

              {contact.recentMeetings.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-white/[0.08]">
                  <CalendarDays className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/30">No meetings yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contact.recentMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors"
                    >
                      <p className="text-sm text-white/80 font-medium truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {m.meetingDate && (
                          <span className="text-xs text-white/35">
                            {formatRelativeDate(m.meetingDate)}
                          </span>
                        )}
                        {m.companyName && (
                          <>
                            <span className="text-white/20 text-xs">·</span>
                            <span className="text-xs text-white/35 truncate">
                              {m.companyName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Detail panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch contacts ────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Contact[] = await res.json();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch companies (for Add Contact form) ────────────────────────────────
  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string }>) => setCompanies(data))
      .catch(() => {/* non-critical */});
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ── Fetch contact detail ──────────────────────────────────────────────────
  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ContactDetail = await res.json();
      setDetail(data);
    } catch {
      // Fall back to basic info from list
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCreated(contact: Contact) {
    setContacts((prev) => [contact, ...prev]);
    setShowForm(false);
  }

  const panelOpen = selectedId !== null;

  return (
    <div className="flex h-full min-h-screen relative">
      {/* ── Main content ── */}
      <div
        className={cn(
          'flex-1 p-6 lg:p-8 transition-all duration-300',
          panelOpen ? 'lg:mr-[420px]' : '',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white/90">Contacts</h1>
              <p className="text-xs text-white/40">{contacts.length} people</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchContacts}
              disabled={loading}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-900/40"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Contact</span>
            </motion.button>
          </div>
        </div>

        {/* Inline form */}
        <AnimatePresence>
          {showForm && (
            <AddContactForm
              companies={companies}
              onClose={() => setShowForm(false)}
              onCreated={handleCreated}
            />
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="relative mb-5 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center mb-5">
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <button
              onClick={fetchContacts}
              className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && contacts.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Contact list */}
        {!loading && filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 text-sm mb-1">
              {search ? 'No contacts match your search' : 'No contacts yet'}
            </p>
            <p className="text-white/25 text-xs mb-5">
              {search ? 'Try a different search term' : 'Add your first contact to get started'}
            </p>
            {!search && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={search}
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2.5"
          >
            {filtered.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                isSelected={selectedId === contact.id}
                onClick={() =>
                  selectedId === contact.id ? closeDetail() : openDetail(contact.id)
                }
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Detail panel (desktop: fixed right, mobile: full-screen overlay) ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-30 lg:hidden"
              onClick={closeDetail}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={panelRef}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
              className={cn(
                'fixed top-0 right-0 z-40 glass border-l border-white/[0.07] shadow-2xl',
                // Mobile: full-screen
                'w-full h-full',
                // Desktop: side panel
                'lg:w-[420px]',
              )}
            >
              <DetailPanel
                contact={detail}
                loading={detailLoading}
                onClose={closeDetail}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
