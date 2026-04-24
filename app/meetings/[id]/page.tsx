'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  Calendar,
  User,
  AlertCircle,
  Check,
} from 'lucide-react';
import { cn, formatDate, formatRelativeDate, priorityColors } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  meetingDate: string | null;
  participants: string[] | null;
  rawNotes: string | null;
  aiSummary: string | null;
  source: string | null;
  companyId: string | null;
  companyName?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  status: string | null;
  priority: string | null;
  meetingId: string | null;
}

type Priority = 'low' | 'medium' | 'high' | 'critical';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function avatarColor(name: string): string {
  const colors = [
    'from-violet-600 to-blue-600',
    'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-500',
    'from-fuchsia-500 to-purple-600',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % colors.length;
  return colors[Math.abs(hash) % colors.length];
}

function PriorityBadge({ priority }: { priority: string | null }) {
  const key = (priority ?? 'medium') as Priority;
  const colorClass = priorityColors[key] ?? priorityColors.medium;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize', colorClass)}>
      {key}
    </span>
  );
}

// ─── Participant avatars ───────────────────────────────────────────────────────

function ParticipantAvatars({ participants }: { participants: string[] | null }) {
  if (!participants || participants.length === 0) return null;
  const visible = participants.slice(0, 5);
  const extra = participants.length - 5;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((name, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          title={name}
          className={cn(
            'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white border-2 border-navy-900',
            avatarColor(name)
          )}
        >
          {getInitials(name)}
        </motion.div>
      ))}
      {extra > 0 && (
        <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-navy-900 flex items-center justify-center text-[10px] text-white/60 font-medium">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── Action item row ───────────────────────────────────────────────────────────

function ActionItemRow({
  item,
  onToggle,
}: {
  item: ActionItem;
  onToggle: (id: string, done: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const isDone = item.status === 'done';

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(item.id, !isDone);
    } finally {
      setToggling(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isDone
          ? 'border-emerald-500/10 bg-emerald-500/5'
          : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]'
      )}
    >
      <button
        onClick={handleToggle}
        disabled={toggling}
        className="mt-0.5 shrink-0 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
      >
        {toggling ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isDone ? (
          <CheckSquare className="w-4 h-4 text-emerald-400" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', isDone ? 'line-through text-white/30' : 'text-white/80')}>
          {item.title}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {item.assignee && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <User className="w-3 h-3" />
              {item.assignee}
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Calendar className="w-3 h-3" />
              {formatDate(item.dueDate)}
            </span>
          )}
          <PriorityBadge priority={item.priority} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add action item form ─────────────────────────────────────────────────────

interface AddActionItemFormProps {
  meetingId: string;
  onAdded: (item: ActionItem) => void;
}

function AddActionItemForm({ meetingId, onAdded }: AddActionItemFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          title: title.trim(),
          assignee: assignee.trim() || null,
          dueDate: dueDate || null,
          priority,
          status: 'open',
        }),
      });
      if (!res.ok) throw new Error('Failed to create action item');
      const item: ActionItem = await res.json();
      onAdded(item);
      setTitle('');
      setAssignee('');
      setDueDate('');
      setPriority('medium');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden"
          >
            <div className="space-y-2 py-1">
              <input
                autoFocus
                type="text"
                placeholder="Action item title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition"
                />
              </div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-violet-500/50 transition"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
                <option value="critical">Critical</option>
              </select>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {saving ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-violet-400 transition-colors py-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add action item
        </button>
      )}
    </div>
  );
}

// ─── Voice recorder ────────────────────────────────────────────────────────────

interface VoiceRecorderProps {
  meetingId: string;
  onTranscript: (text: string) => void;
}

function VoiceRecorder({ meetingId, onTranscript }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          const res = await fetch(`/api/meetings/${meetingId}/voice`, {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) throw new Error('Upload failed');
          const data = await res.json();
          if (data.transcript) onTranscript(data.transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
          setUploading(false);
        }
      };

      mr.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex items-center gap-2">
      <motion.button
        onClick={recording ? stopRecording : startRecording}
        disabled={uploading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
          recording
            ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
            : 'bg-white/[0.05] border-white/10 text-white/50 hover:text-white/80 hover:bg-white/[0.08]',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : recording ? (
          <>
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <MicOff className="w-3.5 h-3.5" />
            </motion.span>
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            Record Voice
          </>
        )}
      </motion.button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Auto-save textarea ────────────────────────────────────────────────────────

interface NotesEditorProps {
  meetingId: string;
  initialValue: string;
  onExternalChange?: (text: string) => void;
  externalValue?: string;
}

function NotesEditor({ meetingId, initialValue, externalValue }: NotesEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedRef = useRef(initialValue);

  // When externalValue changes (voice transcript), append it
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== '') {
      setValue((prev) => (prev ? prev + '\n\n' + externalValue : externalValue));
    }
  }, [externalValue]);

  async function handleBlur() {
    if (value === lastSavedRef.current) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      lastSavedRef.current = value;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write notes or paste a transcript here…"
        rows={14}
        className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-sm text-white/75 placeholder-white/20 resize-none focus:outline-none transition leading-relaxed"
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        {saving && <Loader2 className="w-3 h-3 text-white/30 animate-spin" />}
        {saved && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-emerald-400"
          >
            Saved
          </motion.span>
        )}
        {saveError && (
          <span className="text-[10px] text-red-400">{saveError}</span>
        )}
      </div>
    </div>
  );
}

// ─── Editable title ────────────────────────────────────────────────────────────

function EditableTitle({ meetingId, initial }: { meetingId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function handleBlur() {
    setEditing(false);
    if (value.trim() === initial || !value.trim()) {
      setValue(initial);
      return;
    }
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: value.trim() }),
      });
    } catch {
      setValue(initial);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.blur();
          if (e.key === 'Escape') { setValue(initial); setEditing(false); }
        }}
        className="text-2xl font-bold text-white bg-transparent border-b border-violet-500/50 focus:outline-none w-full pb-0.5"
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="text-2xl font-bold text-white cursor-text hover:text-violet-200 transition-colors group-hover:underline decoration-dotted decoration-white/20"
    >
      {value}
    </h1>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meetingId = params.id;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Fetch meeting + action items
  useEffect(() => {
    if (!meetingId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/meetings/${meetingId}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        // API may return { meeting, actionItems } or just the meeting
        if (data.meeting) {
          setMeeting(data.meeting);
          setActionItems(data.actionItems ?? []);
        } else {
          setMeeting(data);
          // Fetch action items separately if not bundled
          const aiRes = await fetch(`/api/meetings/${meetingId}/action-items`).catch(() => null);
          if (aiRes?.ok) setActionItems(await aiRes.json());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meetingId]);

  const handleToggleActionItem = useCallback(async (id: string, done: boolean) => {
    const newStatus = done ? 'done' : 'open';
    // Optimistic update
    setActionItems((prev) =>
      prev.map((ai) => (ai.id === id ? { ...ai, status: newStatus } : ai))
    );
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch {
      // Revert on failure
      setActionItems((prev) =>
        prev.map((ai) => (ai.id === id ? { ...ai, status: done ? 'open' : 'done' } : ai))
      );
    }
  }, []);

  async function handleExtract() {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/extract`, { method: 'POST' });
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        setActionItems((prev) => [...prev, ...data]);
      } else if (data.actionItems) {
        setActionItems((prev) => [...prev, ...data.actionItems]);
      }
      if (data.aiSummary && meeting) {
        setMeeting((m) => m ? { ...m, aiSummary: data.aiSummary } : m);
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract action items');
    } finally {
      setExtracting(false);
    }
  }

  function handleVoiceTranscript(text: string) {
    setVoiceTranscript(text);
  }

  function handleActionItemAdded(item: ActionItem) {
    setActionItems((prev) => [...prev, item]);
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-7 bg-white/10 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="h-64 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-10 bg-white/[0.04] rounded-xl animate-pulse w-40" />
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-white/[0.04] rounded-xl animate-pulse" />
            <div className="h-48 bg-white/[0.04] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/meetings')}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Meetings
        </button>
        <div className="glass rounded-xl p-6 border border-red-500/20 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error ?? 'Meeting not found'}</p>
        </div>
      </div>
    );
  }

  const openItems = actionItems.filter((ai) => ai.status !== 'done');
  const doneItems = actionItems.filter((ai) => ai.status === 'done');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Top nav */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/meetings')}
          className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>
        <span className="text-xs text-white/30">Meetings</span>
      </div>

      {/* Title + meta */}
      <div className="mb-8">
        <div className="group mb-2">
          <EditableTitle meetingId={meetingId} initial={meeting.title} />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          {meeting.meetingDate && (
            <div className="flex items-center gap-1.5 text-sm text-white/40">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(meeting.meetingDate)}</span>
              <span className="text-white/20">·</span>
              <span>{formatRelativeDate(meeting.meetingDate)}</span>
            </div>
          )}
          {meeting.companyName && (
            <span className="text-sm text-white/40">{meeting.companyName}</span>
          )}
        </div>
        {/* Participant avatars */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <ParticipantAvatars participants={meeting.participants} />
            <span className="text-xs text-white/30">
              {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column: Notes + extract ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="glass rounded-xl p-5 border border-white/[0.07]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/70">Notes / Transcript</h2>
              <VoiceRecorder meetingId={meetingId} onTranscript={handleVoiceTranscript} />
            </div>
            <NotesEditor
              meetingId={meetingId}
              initialValue={meeting.rawNotes ?? ''}
              externalValue={voiceTranscript}
            />
          </div>

          {/* Extract action items button */}
          <div className="flex flex-col gap-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExtract}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-lg shadow-violet-900/30 self-start"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {extracting ? 'Extracting…' : 'Extract Action Items'}
            </motion.button>
            {extractError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {extractError}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Right column: Summary + action items ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="space-y-4"
        >
          {/* AI Summary */}
          <div className="glass rounded-xl p-5 border border-white/[0.07] border-l-4 border-l-violet-500/70">
            <h2 className="text-sm font-semibold text-violet-300 mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              AI Summary
            </h2>
            {meeting.aiSummary ? (
              <p className="text-sm text-white/60 leading-relaxed">{meeting.aiSummary}</p>
            ) : (
              <p className="text-sm text-white/20 italic">
                No summary yet. Add notes and click &ldquo;Extract Action Items&rdquo; to generate one.
              </p>
            )}
          </div>

          {/* Action items */}
          <div className="glass rounded-xl p-5 border border-white/[0.07]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/70">
                Action Items
                {actionItems.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-white/10 text-white/50">
                    {openItems.length} open
                  </span>
                )}
              </h2>
            </div>

            {actionItems.length === 0 ? (
              <p className="text-xs text-white/25 italic py-2">No action items yet.</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {openItems.map((item) => (
                    <ActionItemRow key={item.id} item={item} onToggle={handleToggleActionItem} />
                  ))}
                </AnimatePresence>

                {doneItems.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pt-2"
                  >
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">
                      Completed
                    </p>
                    <AnimatePresence initial={false}>
                      {doneItems.map((item) => (
                        <ActionItemRow key={item.id} item={item} onToggle={handleToggleActionItem} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            )}

            {/* Add action item form */}
            <AddActionItemForm meetingId={meetingId} onAdded={handleActionItemAdded} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
