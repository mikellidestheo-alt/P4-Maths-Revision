import { fmt } from '../engine/format';
import { PLACE_NAMES } from '../engine/format';
import type { Answer, CheckResult } from '../engine/types';

export const digitAt = (n: number, p: number) => Math.floor(n / 10 ** p) % 10;
export const nDigits = (n: number) => String(n).length;

/** Number of columns that carry when adding. */
export function carries(nums: number[]): number {
  let c = 0, count = 0;
  const len = Math.max(...nums.map(nDigits));
  for (let p = 0; p < len; p++) {
    const s = nums.reduce((t, n) => t + digitAt(n, p), 0) + c;
    c = Math.floor(s / 10);
    if (c) count++;
  }
  return count;
}

/** Number of columns that need an exchange when subtracting a − b. */
export function exchanges(a: number, b: number): number {
  let borrow = 0, count = 0;
  for (let p = 0; p < nDigits(a); p++) {
    const top = digitAt(a, p) - borrow, bot = digitAt(b, p);
    borrow = top < bot ? 1 : 0;
    count += borrow;
  }
  return count;
}

/** Read the answer row from the column widget: '_' marks an empty box. */
export function readRow(a: Answer): { value: number | null; gap: boolean; empty: boolean } {
  const s = String(a ?? '').replace(/^_+/, '');
  if (s === '') return { value: null, gap: false, empty: true };
  if (s.includes('_')) return { value: null, gap: true, empty: false };
  if (!/^\d+$/.test(s)) return { value: null, gap: false, empty: true };
  return { value: Number(s), gap: false, empty: false };
}

export function rowExpected(ans: number, width: number): string {
  const s = String(ans);
  return '_'.repeat(Math.max(0, width - s.length)) + s;
}

export function checkAddColumns(nums: number[], got: Answer): CheckResult {
  const sum = nums.reduce((s, n) => s + n, 0);
  const r = readRow(got);
  if (r.empty) return { correct: false, feedback: 'Fill in the answer boxes, starting with the ones on the right.' };
  if (r.gap) return { correct: false, feedback: 'One of the answer boxes in the middle is empty.' };
  const v = r.value!;
  if (v === sum) return { correct: true };
  let carry = 0;
  const len = Math.max(nDigits(sum), nDigits(v));
  for (let p = 0; p < len; p++) {
    const colSum = nums.reduce((t, n) => t + digitAt(n, p), 0);
    const want = (colSum + carry) % 10;
    const g = digitAt(v, p);
    if (g !== want) {
      const place = PLACE_NAMES[p] ?? 'next';
      if (carry && g === colSum % 10) return { correct: false, feedback: `The stock book doesn’t balance. Check the ${place} column — did you add the number you carried?` };
      if (colSum + carry >= 10 && p + 1 < len) return { correct: false, feedback: `Check the ${place} column. It makes ${colSum + carry}: write the ${want} and carry the ${Math.floor((colSum + carry) / 10)}.` };
      return { correct: false, feedback: `The stock book doesn’t balance. Check the ${place} column.` };
    }
    carry = Math.floor((colSum + carry) / 10);
  }
  return { correct: false, feedback: 'Not quite — check each column again.' };
}

export function checkSubColumns(a: number, b: number, got: Answer): CheckResult {
  const diff = a - b;
  const r = readRow(got);
  if (r.empty) return { correct: false, feedback: 'Fill in the answer boxes, starting with the ones on the right.' };
  if (r.gap) return { correct: false, feedback: 'One of the answer boxes in the middle is empty.' };
  const v = r.value!;
  if (v === diff) return { correct: true };
  let borrow = 0;
  for (let p = 0; p < Math.max(nDigits(a), nDigits(v)); p++) {
    const top = digitAt(a, p) - borrow, bot = digitAt(b, p);
    const need = top < bot;
    const want = need ? top + 10 - bot : top - bot;
    const g = digitAt(v, p);
    if (g !== want) {
      const place = PLACE_NAMES[p] ?? 'next';
      if (need && g === Math.abs(digitAt(a, p) - bot)) return { correct: false, feedback: `Check the ${place} column. The top digit is smaller, so exchange 1 from the column to the left first.` };
      if (borrow && g === digitAt(a, p) - bot) return { correct: false, feedback: `Check the ${place} column. You exchanged from this column, so the top digit is one less now.` };
      return { correct: false, feedback: `The count is off. Check the ${place} column.` };
    }
    borrow = need ? 1 : 0;
  }
  return { correct: false, feedback: 'Not quite — check each column again.' };
}

export function workedAdd(nums: number[]): string[] {
  const sum = nums.reduce((s, n) => s + n, 0);
  const lines: string[] = [];
  let carry = 0;
  const len = nDigits(sum);
  for (let p = 0; p < Math.max(...nums.map(nDigits)); p++) {
    const ds = nums.map((n) => digitAt(n, p));
    const s = ds.reduce((t, d) => t + d, 0) + carry;
    lines.push(`${cap(PLACE_NAMES[p])}: ${ds.join(' + ')}${carry ? ` + ${carry} carried` : ''} = ${s}${s >= 10 ? ` → write ${s % 10}, carry ${Math.floor(s / 10)}` : ''}`);
    carry = Math.floor(s / 10);
  }
  if (carry && len > Math.max(...nums.map(nDigits))) lines.push(`Write the carried ${carry} at the front.`);
  lines.push(`${nums.map(fmt).join(' + ')} = ${fmt(sum)}`);
  return lines;
}

export function workedSub(a: number, b: number): string[] {
  const lines: string[] = [];
  const top = String(a).split('').reverse().map(Number);
  for (let p = 0; p < top.length; p++) {
    const bot = digitAt(b, p);
    if (p >= nDigits(b) && top.slice(p + 1).every((d) => d === 0) && top[p] === digitAt(a - b, p)) break;
    if (top[p] < bot) {
      let q = p + 1;
      while (top[q] === 0) q++;
      const before = top[p];
      top[q]--;
      for (let r = p + 1; r < q; r++) top[r] = 9;
      top[p] += 10;
      const across = q > p + 1 ? ` There ${q - p - 1 === 1 ? 'is a zero' : 'are zeros'} next door, so exchange from the ${PLACE_NAMES[q]}: ${q - p - 1 === 1 ? 'the 0 becomes 9' : 'the zeros become 9s'}.` : ` Exchange 1 from the ${PLACE_NAMES[q]}.`;
      const was = before !== digitAt(a, p) ? `The ${digitAt(a, p)} is now ${before}. ` : '';
      lines.push(`${cap(PLACE_NAMES[p])}: ${was}${before} is smaller than ${bot}.${across} ${top[p]} − ${bot} = ${top[p] - bot}`);
    } else {
      const was = top[p] !== digitAt(a, p) ? `the ${digitAt(a, p)} is now ${top[p]}, so ` : '';
      lines.push(`${cap(PLACE_NAMES[p])}: ${was}${top[p]} − ${bot} = ${top[p] - bot}`);
    }
  }
  lines.push(`${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`);
  return lines;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
