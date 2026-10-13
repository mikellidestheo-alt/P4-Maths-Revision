/** Answer parsing. Accept sensible equivalents: "1,000", "1000", "01000", spaces. */

export function cleanNumber(raw: string): string {
  return String(raw ?? '').replace(/[\s,]/g, '').replace(/^\+/, '');
}

/** Whole number (or decimal if allowed). Returns null if unreadable. */
export function parseNumber(raw: string, allowDecimal = false): number | null {
  const s = cleanNumber(raw);
  if (s === '') return null;
  const re = allowDecimal ? /^\d+(\.\d+)?$|^\.\d+$/ : /^\d+$/;
  if (!re.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a clock time to minutes since midnight. Accepts "7:30", "07:30", "7.30", "730", "0730".
 * Returns { h, m } (h as typed, 0-23) or null.
 */
export function parseTime(raw: string): { h: number; m: number } | null {
  const s = String(raw ?? '').replace(/\s/g, '');
  let h: number, m: number;
  let match = /^(\d{1,2})[:.](\d{2})$/.exec(s);
  if (match) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else if ((match = /^(\d{1,2})(\d{2})$/.exec(s))) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else return null;
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** 24-hour time → minutes since midnight. */
export function parse24(raw: string): number | null {
  const t = parseTime(raw);
  return t ? t.h * 60 + t.m : null;
}

/** 12-hour time + am/pm → minutes since midnight (hour must be 1-12). */
export function parse12(raw: string, ampm: string): number | null {
  const t = parseTime(raw);
  if (!t || t.h < 1 || t.h > 12) return null;
  if (ampm !== 'am' && ampm !== 'pm') return null;
  const h = (t.h % 12) + (ampm === 'pm' ? 12 : 0);
  return h * 60 + t.m;
}

/** Clock-face time (12-hour, no am/pm) → minutes in [0, 720). Hour 1-12 (0 also accepted as 12). */
export function parseClockFace(raw: string): number | null {
  const t = parseTime(raw);
  if (!t || t.h > 12) return null;
  return (t.h % 12) * 60 + t.m;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
