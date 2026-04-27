// Timezone-safe MM-DD-YY formatter for list pages.
//
// `new Date("YYYY-MM-DD")` parses as UTC midnight, but `getDate()`/`getMonth()`
// return *local* values — which off-by-ones the day in any non-UTC timezone.
// For YYYY-MM-DD strings we pull the components straight out of the string;
// for full ISO timestamps we use the UTC getters.

export function formatDate(input: string | null | undefined): string {
  if (!input) return '—';
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, year, month, day] = m;
    return `${month}-${day}-${year.slice(-2)}`;
  }
  const x = new Date(input);
  if (isNaN(x.getTime())) return '—';
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const yy = String(x.getUTCFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
}
