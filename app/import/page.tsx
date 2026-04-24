'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Upload,
  FileText,
  HardDrive,
  Mic,
  MicOff,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  File,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import PriorityBadge from '@/components/PriorityBadge';

// ─── shared types ─────────────────────────────────────────────────────────────
interface ExtractedActionItem {
  title: string;
  assignee?: string;
  dueDate?: string;
  priority: string;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
}

type Tab = 'paste' | 'gdrive' | 'voice';

// ─── small helpers ────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
        active
          ? 'text-white bg-violet-600/25 border border-violet-500/30'
          : 'text-white/45 hover:text-white/75',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

function StatusMessage({
  type,
  message,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
}) {
  const cfg = {
    success: { icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    error: { icon: AlertCircle, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    info: { icon: Loader2, cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className={cn('flex items-start gap-2 px-4 py-3 rounded-xl border text-sm', cfg.cls)}
    >
      <cfg.icon className={cn('w-4 h-4 mt-0.5 shrink-0', type === 'info' && 'animate-spin')} />
      <span>{message}</span>
    </motion.div>
  );
}

// ─── Tab 1: Paste Notes ───────────────────────────────────────────────────────
function PasteNotesTab() {
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ExtractedActionItem[] | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(
    null,
  );

  const handleExtract = async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    setStatus({ type: 'info', msg: 'Extracting action items…' });
    setPreview(null);
    setMeetingId(null);

    try {
      const res = await fetch('/api/import/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, title: title || 'Untitled Meeting', date }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { actionItems: ExtractedActionItem[]; meetingId: string } = await res.json();
      setPreview(data.actionItems);
      setMeetingId(data.meetingId);
      setStatus(
        data.actionItems.length > 0
          ? { type: 'success', msg: `Found ${data.actionItems.length} action item(s). Review and save below.` }
          : { type: 'info', msg: 'No action items detected. You can still save the meeting.' },
      );
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Extraction failed' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!meetingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/import/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          title: title || 'Untitled Meeting',
          date,
          meetingId,
          confirmed: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ type: 'success', msg: 'Meeting and action items saved!' });
      setNotes('');
      setTitle('');
      setDate('');
      setPreview(null);
      setMeetingId(null);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50">Meeting Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Q2 Portfolio Review"
            className="w-full px-3 py-2.5 rounded-xl bg-navy-800/80 border border-white/[0.07] text-sm text-white/90 placeholder-white/25 focus:outline-none focus:border-violet-500/40 focus:bg-navy-800 transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/50">Meeting Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-navy-800/80 border border-white/[0.07] text-sm text-white/60 focus:outline-none focus:border-violet-500/40 focus:bg-navy-800 transition-all [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/50">Transcript / Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your meeting transcript or notes here…&#10;&#10;e.g. Action: Peter to send deck by Friday. Sarah will schedule follow-up call."
          rows={10}
          className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/[0.07] text-sm text-white/85 placeholder-white/20 resize-y focus:outline-none focus:border-violet-500/40 focus:bg-navy-800 transition-all leading-relaxed"
        />
        <p className="text-xs text-white/25 text-right">{notes.length.toLocaleString()} chars</p>
      </div>

      {/* Status */}
      <AnimatePresence>
        {status && <StatusMessage type={status.type} message={status.msg} />}
      </AnimatePresence>

      {/* Preview */}
      <AnimatePresence>
        {preview && preview.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Extracted Action Items
            </h3>
            <div className="space-y-2">
              {preview.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl glass',
                    `border-priority-${item.priority}`,
                  )}
                >
                  <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/85">{item.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {item.assignee && (
                        <span className="text-xs text-white/40">{item.assignee}</span>
                      )}
                      {item.dueDate && (
                        <span className="text-xs text-white/35">
                          Due {formatDate(item.dueDate)}
                        </span>
                      )}
                      <PriorityBadge priority={item.priority} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          onClick={handleExtract}
          disabled={!notes.trim() || extracting || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all active:scale-95"
        >
          {extracting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {extracting ? 'Extracting…' : 'Extract & Save'}
        </button>

        {preview !== null && meetingId && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Confirm & Save'}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Google Drive ──────────────────────────────────────────────────────
function GoogleDriveTab() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(
    null,
  );

  const loadFiles = async () => {
    setLoading(true);
    setStatus({ type: 'info', msg: 'Loading Drive files…' });
    setFiles([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/import/gdrive/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DriveFile[] = await res.json();
      setFiles(data);
      setStatus(
        data.length === 0
          ? { type: 'info', msg: 'No Google Docs found in your Drive.' }
          : null,
      );
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to list files' });
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
    setStatus({ type: 'info', msg: `Importing ${selected.size} file(s)…` });
    try {
      const res = await fetch('/api/import/gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { imported: number } = await res.json();
      setStatus({ type: 'success', msg: `Successfully imported ${data.imported} meeting(s)!` });
      setSelected(new Set());
      setFiles([]);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Load button */}
      <button
        onClick={loadFiles}
        disabled={loading || importing}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-700/80 border border-white/[0.08] hover:border-white/[0.15] hover:bg-navy-700 disabled:opacity-40 text-white/80 text-sm font-medium transition-all active:scale-95"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <HardDrive className="w-4 h-4 text-violet-400" />
        )}
        {loading ? 'Loading…' : 'Load Drive Files'}
      </button>

      {/* Status */}
      <AnimatePresence>
        {status && <StatusMessage type={status.type} message={status.msg} />}
      </AnimatePresence>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Recent Google Docs
              </h3>
              {selected.size > 0 && (
                <span className="text-xs text-violet-400">{selected.size} selected</span>
              )}
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {files.map((file, i) => {
                const isSelected = selected.has(file.id);
                return (
                  <motion.label
                    key={file.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                      isSelected
                        ? 'bg-violet-600/15 border border-violet-500/30'
                        : 'glass hover:bg-white/[0.04] border border-transparent',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                    />
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                        isSelected
                          ? 'border-violet-500 bg-violet-500'
                          : 'border-white/20',
                      )}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M10 3L5 9 2 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <File className="w-4 h-4 text-blue-400/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 truncate">{file.name}</p>
                      <p className="text-xs text-white/35 mt-0.5">
                        Modified {formatDate(file.modifiedTime)}
                      </p>
                    </div>
                  </motion.label>
                );
              })}
            </div>

            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all active:scale-95"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing
                ? 'Importing…'
                : selected.size > 0
                  ? `Import ${selected.size} Selected`
                  : 'Import Selected'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab 3: Voice Record ──────────────────────────────────────────────────────
function VoiceRecordTab() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(
    null,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      setStatus(null);
      setTranscript('');

      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (e) {
      setStatus({
        type: 'error',
        msg: e instanceof Error ? e.message : 'Microphone access denied',
      });
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    const mr = mediaRecorderRef.current;
    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
    });

    mr.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setTranscribing(true);
    setStatus({ type: 'info', msg: 'Transcribing audio…' });

    try {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const res = await fetch('/api/import/voice', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { transcript: string } = await res.json();
      setTranscript(data.transcript);
      setStatus({ type: 'success', msg: 'Transcription complete. Review and save.' });
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Transcription failed' });
    } finally {
      setTranscribing(false);
    }
  }, []);

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setSaving(true);
    setStatus({ type: 'info', msg: 'Saving meeting…' });
    try {
      const res = await fetch('/api/import/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: transcript,
          title: 'Voice Recording',
          source: 'voice',
          confirmed: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ type: 'success', msg: 'Meeting saved with action items!' });
      setTranscript('');
      setRecordingSeconds(0);
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Mic button area */}
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="relative flex items-center justify-center">
          {/* Pulse rings when recording */}
          {recording && (
            <>
              <motion.div
                animate={{ scale: [1, 1.45], opacity: [0.35, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-red-500"
              />
              <motion.div
                animate={{ scale: [1, 1.75], opacity: [0.2, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut', delay: 0.3 }}
                className="absolute inset-0 rounded-full bg-red-500"
              />
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={recording ? stopAndTranscribe : startRecording}
            disabled={transcribing || saving}
            className={cn(
              'relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all',
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              recording
                ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                : 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_40px_rgba(124,58,237,0.35)]',
            )}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? (
              <Square className="w-8 h-8 text-white" fill="white" />
            ) : transcribing ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </motion.button>
        </div>

        {/* Timer / label */}
        <div className="text-center">
          {recording ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <motion.div
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
              <span className="text-lg font-mono font-semibold text-red-400">
                {formatTime(recordingSeconds)}
              </span>
              <span className="text-xs text-white/40">Recording…</span>
            </motion.div>
          ) : transcribing ? (
            <p className="text-sm text-violet-400">Transcribing…</p>
          ) : (
            <p className="text-sm text-white/35">
              {transcript ? 'Recording saved' : 'Tap to start recording'}
            </p>
          )}
        </div>

        {/* Stop label hint */}
        {recording && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/35"
          >
            Tap the button to stop & transcribe
          </motion.p>
        )}
      </div>

      {/* Status */}
      <AnimatePresence>
        {status && <StatusMessage type={status.type} message={status.msg} />}
      </AnimatePresence>

      {/* Transcript textarea */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <label className="text-xs font-medium text-white/50">Transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-navy-800/80 border border-white/[0.07] text-sm text-white/85 resize-y focus:outline-none focus:border-violet-500/40 focus:bg-navy-800 transition-all leading-relaxed"
            />

            <button
              onClick={handleSave}
              disabled={!transcript.trim() || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-all active:scale-95"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : 'Save as Meeting'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone not supported */}
      {typeof window !== 'undefined' && !navigator.mediaDevices && (
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <MicOff className="w-4 h-4" />
          Microphone not available in this browser.
        </div>
      )}
    </div>
  );
}

// ─── Main Import page ─────────────────────────────────────────────────────────
export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('paste');

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'paste', label: 'Paste Notes', icon: FileText },
    { key: 'gdrive', label: 'Google Drive', icon: HardDrive },
    { key: 'voice', label: 'Voice Record', icon: Mic },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <Upload className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white/90">Import Meeting</h1>
          <p className="text-xs text-white/40">Add notes, connect Drive, or record audio</p>
        </div>
      </div>

      {/* Card */}
      <div className="glass rounded-2xl overflow-hidden border border-white/[0.07]">
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] bg-navy-900/40">
          {TABS.map(({ key, label, icon }) => (
            <TabButton
              key={key}
              active={tab === key}
              onClick={() => setTab(key)}
              icon={icon}
              label={label}
            />
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'paste' && <PasteNotesTab />}
              {tab === 'gdrive' && <GoogleDriveTab />}
              {tab === 'voice' && <VoiceRecordTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
