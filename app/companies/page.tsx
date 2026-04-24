'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  Building2,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyType = 'Portfolio' | 'Prospect' | 'Service Provider';

interface Company {
  id: string;
  name: string;
  type: CompanyType | string;
  notes: string | null;
  contactCount: number;
}

interface CompanyContact {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

interface NewCompanyForm {
  name: string;
  type: CompanyType;
  notes: string;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  Portfolio: 'text-violet-300 bg-violet-500/15 border-violet-500/25',
  Prospect: 'text-blue-300 bg-blue-500/15 border-blue-500/25',
  'Service Provider': 'text-slate-300 bg-slate-500/15 border-slate-500/25',
};

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? 'text-slate-300 bg-slate-500/15 border-slate-500/25';
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        style,
      )}
    >
      {type}
    </span>
  );
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-700',
  'from-amber-500 to-orange-600',
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

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
};

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-5 border border-white/[0.07] animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded-full w-24" />
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-4/5" />
      </div>
      <div className="h-3 bg-white/10 rounded w-16" />
    </div>
  );
}

// ─── Add Company Form ─────────────────────────────────────────────────────────

interface AddCompanyFormProps {
  onClose: () => void;
  onCreated: (company: Company) => void;
}

const COMPANY_TYPES: CompanyType[] = ['Portfolio', 'Prospect', 'Service Provider'];

function AddCompanyForm({ onClose, onCreated }: AddCompanyFormProps) {
  const [form, setForm] = useState<NewCompanyForm>({
    name: '',
    type: 'Prospect',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewCompanyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: Company = await res.json();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
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
      <h3 className="text-sm font-semibold text-white/80 mb-4">New Company</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            autoFocus
            type="text"
            placeholder="Company name *"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            className={cn(inputCls, 'text-white/80')}
          >
            {COMPANY_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#111827]">
                {t}
              </option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className={cn(inputCls, 'resize-none')}
        />
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
            {saving ? 'Saving…' : 'Add Company'}
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

// ─── Contacts Drawer (inline expansion) ──────────────────────────────────────

interface ContactsDrawerProps {
  companyId: string;
}

function ContactsDrawer({ companyId }: ContactsDrawerProps) {
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/companies/${companyId}/contacts`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CompanyContact[]>;
      })
      .then(setContacts)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) {
    return (
      <div className="pt-3 border-t border-white/[0.07] space-y-2 animate-pulse">
        {[0, 1].map((i) => (
          <div key={i} className="h-10 bg-white/[0.04] rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-3 border-t border-white/[0.07]">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="pt-3 border-t border-white/[0.07] text-center py-4">
        <p className="text-xs text-white/30">No contacts at this company</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-3 border-t border-white/[0.07] space-y-1.5"
    >
      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">
        Contacts
      </p>
      {contacts.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
        >
          <div
            className={cn(
              'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0',
              avatarGradient(c.name),
            )}
          >
            {initials(c.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/80 truncate">{c.name}</p>
            {c.role && <p className="text-[11px] text-white/35 truncate">{c.role}</p>}
          </div>
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="text-[11px] text-violet-400/70 hover:text-violet-300 truncate max-w-[120px] transition-colors"
              title={c.email}
            >
              {c.email}
            </a>
          )}
        </div>
      ))}
    </motion.div>
  );
}

// ─── Company Card ─────────────────────────────────────────────────────────────

interface CompanyCardProps {
  company: Company;
}

function CompanyCard({ company }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="glass rounded-xl border border-white/[0.07] hover:border-white/[0.12] transition-colors duration-150 overflow-hidden"
    >
      <div className="p-5">
        {/* Card header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Logo placeholder */}
          <div
            className={cn(
              'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md',
              avatarGradient(company.name),
            )}
          >
            {initials(company.name)}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold text-white/90 truncate leading-snug">
              {company.name}
            </h3>
            <div className="mt-1">
              <TypeBadge type={company.type} />
            </div>
          </div>
        </div>

        {/* Notes preview */}
        {company.notes ? (
          <p className="text-xs text-white/45 leading-relaxed line-clamp-2 mb-3">
            <FileText className="inline w-3 h-3 mr-1 opacity-60" />
            {company.notes}
          </p>
        ) : (
          <p className="text-xs text-white/20 italic mb-3">No notes</p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between">
          {/* Contact count */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
              expanded
                ? 'text-violet-300'
                : 'text-white/45 hover:text-white/70',
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              {company.contactCount === 1
                ? '1 contact'
                : `${company.contactCount} contacts`}
            </span>
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          </button>
        </div>

        {/* Contacts expansion */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="contacts"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden mt-3"
            >
              <ContactsDrawer companyId={company.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Type filter ──────────────────────────────────────────────────────────────

type TypeFilter = 'All' | CompanyType;

const TYPE_FILTERS: TypeFilter[] = ['All', 'Portfolio', 'Prospect', 'Service Provider'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Company[] = await res.json();
      setCompanies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (typeFilter === 'All') return companies;
    return companies.filter((c) => c.type === typeFilter);
  }, [companies, typeFilter]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const result: Record<TypeFilter, number> = {
      All: companies.length,
      Portfolio: 0,
      Prospect: 0,
      'Service Provider': 0,
    };
    for (const c of companies) {
      if (c.type in result) result[c.type as TypeFilter]++;
    }
    return result;
  }, [companies]);

  function handleCreated(company: Company) {
    setCompanies((prev) => [company, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white/90">Companies</h1>
            <p className="text-xs text-white/40">{companies.length} total</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCompanies}
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
            <span className="hidden sm:inline">Add Company</span>
          </motion.button>
        </div>
      </div>

      {/* ── Inline form ── */}
      <AnimatePresence>
        {showForm && (
          <AddCompanyForm onClose={() => setShowForm(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>

      {/* ── Type filter tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.07] rounded-xl w-fit mb-6 flex-wrap">
        {TYPE_FILTERS.map((type) => {
          const active = typeFilter === type;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                'relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap',
                active ? 'text-white' : 'text-white/40 hover:text-white/60',
              )}
            >
              {active && (
                <motion.div
                  layoutId="companyTypeIndicator"
                  className="absolute inset-0 rounded-lg bg-violet-600/80"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {type}
                {counts[type] > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/40',
                    )}
                  >
                    {counts[type]}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center mb-6">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchCompanies}
            className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && companies.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/50 text-sm mb-1">
            {typeFilter !== 'All'
              ? `No ${typeFilter} companies`
              : 'No companies yet'}
          </p>
          <p className="text-white/25 text-xs mb-5">
            {typeFilter !== 'All'
              ? 'Try a different filter'
              : 'Add your first company to start tracking relationships'}
          </p>
          {typeFilter === 'All' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Company
            </button>
          )}
        </motion.div>
      )}

      {/* ── Grid ── */}
      {!loading && filtered.length > 0 && (
        <motion.div
          key={typeFilter}
          variants={gridVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {filtered.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
