'use client';

interface Props<K extends string | null> {
  label: string;
  k: NonNullable<K>;
  sortKey: K;
  sortDir: 'asc' | 'desc';
  onSort: (k: NonNullable<K>) => void;
  align?: 'left' | 'right';
}

/**
 * A clickable column header. Click cycles asc → desc → off.
 * Always shows a small chevron pair (⇅) so users see at a glance that the
 * column is sortable. The active column shows a single ▲/▼ in the accent color.
 */
export default function SortHeader<K extends string | null>({
  label, k, sortKey, sortDir, onSort, align = 'left',
}: Props<K>) {
  const active = sortKey === k;
  const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        padding: '0 4px',
        background: 'transparent',
        border: 'none',
        borderRadius: 3,
        font: 'inherit',
        color: active ? 'var(--apex-primary-bright)' : 'var(--apex-text-muted)',
        cursor: 'pointer',
        textTransform: 'uppercase',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.16em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: align,
        width: '100%',
        transition: 'background-color 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        if (!active) el.style.color = 'var(--apex-text-secondary)';
        el.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        if (!active) el.style.color = 'var(--apex-text-muted)';
        el.style.background = 'transparent';
      }}
      title={
        active
          ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'} — click to ${sortDir === 'asc' ? 'reverse' : 'clear'}`
          : `Sort by ${label.toLowerCase()}`
      }
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: active ? 8 : 9,
          lineHeight: 1,
          marginLeft: 1,
          opacity: active ? 1 : 0.5,
        }}
      >
        {arrow}
      </span>
    </button>
  );
}
