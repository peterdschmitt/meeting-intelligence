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
 * Active sort shows a small ▲ / ▼ next to the label.
 */
export default function SortHeader<K extends string | null>({
  label, k, sortKey, sortDir, onSort, align = 'left',
}: Props<K>) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        padding: 0,
        background: 'transparent',
        border: 'none',
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
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text-secondary)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--apex-text-muted)'; }}
      title={active ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'} — click to ${sortDir === 'asc' ? 'reverse' : 'clear'}` : `Sort by ${label.toLowerCase()}`}
    >
      <span>{label}</span>
      {active && (
        <span style={{ fontSize: 8, lineHeight: 1, marginLeft: 1 }}>
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </button>
  );
}
