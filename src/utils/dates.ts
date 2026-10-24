// The shop works on Manila time: a live's date is its Manila calendar day.
export function manilaDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "Fri, 24 Oct 2026" for a "2026-10-24" Manila day */
export function formatManilaDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}
