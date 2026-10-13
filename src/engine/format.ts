/** Number formatting helpers (UK style: commas for thousands). */

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toString().split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '−' : '') + withCommas + (dec ? '.' + dec : '');
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return TENS[t] + (o ? '-' + ONES[o] : '');
}

/** 0..999, UK style ("three hundred and four") */
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (h === 0) return under100(r);
  return ONES[h] + ' hundred' + (r ? ' and ' + under100(r) : '');
}

/** Whole numbers 0..1,000,000 in UK English words. */
export function toWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new Error('toWords range: ' + n);
  if (n === 1_000_000) return 'one million';
  if (n === 0) return 'zero';
  const th = Math.floor(n / 1000), r = n % 1000;
  const parts: string[] = [];
  if (th) parts.push(under1000(th) + ' thousand');
  if (r) {
    // "two thousand and five" when the remainder is under 100
    if (th && r < 100) parts.push('and ' + under100(r));
    else parts.push(under1000(r));
  }
  return parts.join(th && r >= 100 ? ', ' : ' ');
}

/** Minutes since midnight → "19:05" (24-hour, two-digit hours). */
export function time24(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Minutes since midnight → "7:05 pm". */
export function time12(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60), mm = m % 60;
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, '0')} ${ampm}`;
}

/** Clock-face time (no am/pm) e.g. "7:05" */
export function clockFace(mins: number): string {
  const m = ((mins % 720) + 720) % 720;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h === 0 ? 12 : h}:${String(mm).padStart(2, '0')}`;
}

/** 135 → "2 hours 15 minutes" */
export function duration(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function plural(n: number, word: string, pluralWord = word + 's'): string {
  return `${fmt(n)} ${n === 1 ? word : pluralWord}`;
}

export const PLACE_NAMES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions'];
export const PLACE_SHORT = ['O', 'T', 'H', 'Th', 'TTh', 'HTh', 'M'];
