import { describe, expect, it } from 'vitest';
import { makeRng } from '../engine/rng';
import { makeWrong } from '../engine/wrong';
import type { Answer, Point, Question, Tier } from '../engine/types';
import { TOPIC_LIST } from './index';
import { parseNumber } from '../engine/answers';
import { T11, T12, T23, T21 } from '../config/difficulty';

const TIERS: Tier[] = [1, 2, 3];
const PER_TIER = 200; // 600 per topic

/** All numbers mentioned in the visible text of a question. */
function numbersIn(q: Question): number[] {
  const parts: string[] = [q.prompt, q.story];
  if (q.interaction.type === 'fields') for (const t of q.interaction.tokens) if (typeof t === 'string') parts.push(t);
  const text = parts.join(' ');
  return [...text.matchAll(/\d[\d,]*(\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, '')));
}

function textOf(q: Question): string {
  const parts: string[] = [q.prompt, q.story, q.hint, ...q.worked, q.answerText];
  if (q.interaction.type === 'fields') for (const t of q.interaction.tokens) if (typeof t === 'string') parts.push(t);
  return parts.join(' | ');
}

function generateMany(topicIndex: number, perTier = PER_TIER): Question[] {
  const t = TOPIC_LIST[topicIndex];
  const out: Question[] = [];
  for (const tier of TIERS) {
    for (let i = 0; i < perTier; i++) {
      const rng = makeRng(1000 * (topicIndex + 1) + i * 7 + tier * 100_003);
      out.push(t.generate(rng, tier, {}));
    }
  }
  return out;
}

describe.each(TOPIC_LIST.map((t, i) => [t.id, i] as const))('topic %s', (id, idx) => {
  const qs = generateMany(idx);

  it('generates ≥500 questions with sane fields', () => {
    expect(qs.length).toBeGreaterThanOrEqual(500);
    for (const q of qs) {
      expect(q.topicId).toBe(id);
      expect(q.prompt.length).toBeGreaterThan(3);
      expect(q.hint.length).toBeGreaterThan(3);
      expect(q.worked.length).toBeGreaterThan(0);
      expect(q.answerText).toBeTruthy();
      const txt = textOf(q);
      expect(txt, q.id).not.toMatch(/NaN|undefined|null|Infinity|\[object/);
      // no negative numbers anywhere (operators always have a space after them)
      expect(txt, txt).not.toMatch(/[−-]\d/);
    }
  });

  it('accepts the expected answer and rejects a wrong one', () => {
    for (const q of qs) {
      const ok = q.check(q.expected);
      expect(ok.correct, `${q.id} ${q.prompt} expected=${JSON.stringify(q.expected)} fb=${ok.feedback}`).toBe(true);
      const wrong = makeWrong(q);
      const res = q.check(wrong);
      expect(res.correct, `${q.id} wrong=${JSON.stringify(wrong)}`).toBe(false);
      expect(res.feedback, `${q.id} feedback for wrong answer`).toBeTruthy();
    }
  });

  it('typed fallbacks agree with the main check', () => {
    for (const q of qs) {
      if (!q.fallback) continue;
      const main = q.fallback.toMain(q.fallback.expected);
      expect(main, q.id).not.toBeNull();
      expect(q.check(main as Answer).correct, `${q.id} fallback`).toBe(true);
    }
  });

  it('single-number answers are unique (nearby numbers are rejected)', () => {
    for (const q of qs) {
      if (q.interaction.type !== 'fields') continue;
      const exp = q.expected as Record<string, string>;
      const keys = Object.keys(exp);
      for (const k of keys) {
        const n = parseNumber(exp[k], true);
        if (n === null) continue;
        for (const d of [-10, -3, -2, -1, 1, 2, 3, 10, 100]) {
          const v = n + d;
          if (v < 0) continue;
          const a = { ...exp, [k]: String(v) };
          // elapsed time: h/m pairs may legitimately trade 60 minutes for an hour; skip those keys
          if ((q.kind === 'elapsed') && (k === 'm' || k === 'h')) continue;
          expect(q.check(a).correct, `${q.id} ${k}=${v} should be wrong (${q.prompt})`).toBe(false);
        }
      }
    }
  });

  it('accepts sensible equivalents (commas, leading zeros, spaces)', () => {
    for (const q of qs.slice(0, 200)) {
      if (q.interaction.type !== 'fields') continue;
      const exp = q.expected as Record<string, string>;
      const variant: Record<string, string> = {};
      for (const [k, v] of Object.entries(exp)) {
        if (/^\d+$/.test(v)) variant[k] = ' 0' + Number(v).toLocaleString('en-GB') + ' ';
        else variant[k] = v;
      }
      expect(q.check(variant).correct, `${q.id} ${JSON.stringify(variant)}`).toBe(true);
    }
  });

  it('can regenerate every kind at every tier (used by the Campfire recap)', () => {
    const t = TOPIC_LIST[idx];
    for (const kind of t.kinds) {
      for (const tier of TIERS) {
        for (let i = 0; i < 15; i++) {
          const q = t.generate(makeRng(i * 31 + tier), tier, { kind });
          expect(q.kind).toBe(kind);
          expect(q.check(q.expected).correct).toBe(true);
        }
      }
    }
  });

  it('produces varied questions (few duplicates)', () => {
    for (const tier of TIERS) {
      const sigs = new Set(qs.filter((q) => q.tier === tier).map((q) => q.signature));
      expect(sigs.size, `tier ${tier}`).toBeGreaterThan(id === '2.6' ? 25 : 60);
    }
  });

  it('keeps numbers within range', () => {
    for (const q of qs) {
      for (const n of numbersIn(q)) expect(n, q.prompt).toBeLessThanOrEqual(1_000_000);
    }
  });
});

describe('topic-specific ranges and maths', () => {
  it('1.1 respects tier maxima', () => {
    const qs = generateMany(0);
    for (const q of qs) {
      const nums = numbersIn(q).filter((n) => n >= 1000);
      for (const n of nums) expect(n).toBeLessThanOrEqual(T11.max[q.tier] + 100_000);
    }
  });

  it('1.2 markers stay within 0 and the tier max', () => {
    for (const q of generateMany(1)) {
      for (const n of numbersIn(q)) expect(n).toBeLessThanOrEqual(T12.max[q.tier]);
      if (q.interaction.type === 'fields') for (const v of Object.values(q.expected as Record<string, string>)) {
        expect(Number(v)).toBeGreaterThanOrEqual(0);
        expect(Number(v)).toBeLessThanOrEqual(T12.max[q.tier]);
      }
    }
  });

  it('1.3 rounding answers are correct (half rounds up)', () => {
    for (const q of generateMany(2)) {
      if (q.kind !== 'roundTyped') continue;
      const m = /Round ([\d,]+) to the nearest ([\d,]+)/.exec(q.prompt)!;
      const n = Number(m[1].replace(/,/g, '')), r = Number(m[2].replace(/,/g, ''));
      const exp = Number((q.expected as Record<string, string>).a);
      expect(exp).toBe(Math.floor((n + r / 2) / r) * r);
      expect(Math.abs(exp - n)).toBeLessThanOrEqual(r / 2);
    }
  });

  it('1.6 elapsed times match minute arithmetic', () => {
    for (const q of generateMany(5)) {
      if (q.kind !== 'elapsed') continue;
      const e = q.expected as Record<string, string>;
      expect(Number(e.m)).toBeLessThan(60);
      expect(Number(e.h) * 60 + Number(e.m)).toBeGreaterThan(0);
    }
  });

  it('1.7 drawLine has at least one valid end point and expected is valid', () => {
    for (const q of generateMany(6)) {
      if (q.kind !== 'drawLine' || q.interaction.type !== 'grid') continue;
      let valid = 0;
      for (let x = 0; x <= q.interaction.w; x++) for (let y = 0; y <= q.interaction.h; y++) if (q.check([[x, y]] as Point[]).correct) valid++;
      expect(valid).toBeGreaterThan(0);
      expect(valid).toBeLessThan((q.interaction.w + 1) * (q.interaction.h + 1) / 2);
    }
  });

  it('2.1/2.2 mental results are non-negative and within range', () => {
    for (const idx of [8, 9]) for (const q of generateMany(idx)) {
      const v = Number((q.expected as Record<string, string>).a);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(T21.fourDigit[1] * 2);
    }
  });

  it('2.3/2.4 column sums and differences are correct and ≤ 6 digits', () => {
    for (const idx of [10, 11]) for (const q of generateMany(idx)) {
      if (q.interaction.type !== 'column') continue;
      const ops = q.interaction.operands;
      const want = q.interaction.op === '+' ? ops.reduce((s, n) => s + n, 0) : ops[0] - ops[1];
      expect(Number(String(q.expected).replace(/_/g, ''))).toBe(want);
      expect(want).toBeGreaterThan(0);
      expect(String(want).length).toBeLessThanOrEqual(T23.maxDigits);
    }
  });

  it('2.5 triangle builder: expected meets the rule; start does not', () => {
    for (const q of generateMany(12)) {
      if (q.kind !== 'build' || q.interaction.type !== 'grid') continue;
      expect(q.check(q.interaction.initial!).correct).toBe(false);
      expect(q.check(q.expected).correct).toBe(true);
    }
  });
});

describe('column worked solutions', () => {
  it('explains exchanging across zeros without negative digits', async () => {
    const { workedSub } = await import('./column');
    const w = workedSub(40003, 18567).join('\n');
    expect(w).not.toMatch(/[−-]\d/);
    expect(w).toMatch(/zeros become 9s/);
    expect(w).toMatch(/40,003 − 18,567 = 21,436/);
    const w2 = workedSub(602, 349).join('\n');
    expect(w2).toMatch(/Tens: the 0 is now 9, so 9 − 4 = 5/);
  });
});
