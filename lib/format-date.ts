// Timezone-safe date formatters for list and detail pages.
//
// `new Date("YYYY-MM-DD")` parses as UTC midnight, but `getDate()`/`getMonth()`
// return *local* values — which off-by-ones the day in any non-UTC timezone.
// For YYYY-MM-DD strings we pull the components straight out of the string;
// for full ISO timestamps we use the UTC getters.

function dateParts(input: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!input) return null;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }
  const x = new Date(input);
  if (isNaN(x.getTime())) return null;
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

export function formatDate(input: string | null | undefined): string {
  const parts = dateParts(input);
  if (!parts) return '—';
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  const yy = String(parts.year).slice(-2);
  return `${mm}-${dd}-${yy}`;
}

export function formatLongDate(input: string | null | undefined): string {
  const parts = dateParts(input);
  if (!parts) return '—';
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
