/** All "what time is it" questions go through here so tests can mock the clock. */
export const now = () => Date.now();

/** Local calendar date, e.g. "2026-10-17" (the daily allowance resets on this). */
export function localDate(t = now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
