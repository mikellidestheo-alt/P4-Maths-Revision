import { describe, expect, it } from 'vitest';
import { fmt, toWords, time12, time24, duration } from './format';
import { parseNumber, parseTime, parse12, parse24, parseClockFace } from './answers';
import { makeRng } from './rng';
import { symmetryAxes } from './geometry';
import { SYM_SHAPES } from '../topics/t26';
import { newJobState, nextQuestion, noteShown, recordResult, recapQuestion, tierFor, type JobDef } from './planner';
import { TOPIC_LIST, UNIT1, UNIT2 } from '../topics';

describe('format', () => {
  it('formats numbers UK style', () => {
    expect(fmt(305820)).toBe('305,820');
    expect(fmt(1000000)).toBe('1,000,000');
    expect(fmt(999)).toBe('999');
  });
  it('writes numbers in words', () => {
    expect(toWords(342106)).toBe('three hundred and forty-two thousand, one hundred and six');
    expect(toWords(2005)).toBe('two thousand and five');
    expect(toWords(40017)).toBe('forty thousand and seventeen');
    expect(toWords(1_000_000)).toBe('one million');
    expect(toWords(700_000)).toBe('seven hundred thousand');
    expect(toWords(110)).toBe('one hundred and ten');
    expect(toWords(90_300)).toBe('ninety thousand, three hundred');
  });
  it('formats times', () => {
    expect(time24(19 * 60 + 5)).toBe('19:05');
    expect(time12(19 * 60 + 5)).toBe('7:05 pm');
    expect(time12(0)).toBe('12:00 am');
    expect(time12(12 * 60)).toBe('12:00 pm');
    expect(duration(135)).toBe('2 hours 15 minutes');
    expect(duration(60)).toBe('1 hour');
  });
});

describe('answer parsing', () => {
  it('accepts sensible number formats', () => {
    expect(parseNumber('1,000')).toBe(1000);
    expect(parseNumber(' 01000 ')).toBe(1000);
    expect(parseNumber('1 000')).toBe(1000);
    expect(parseNumber('12a')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('4.5')).toBeNull();
    expect(parseNumber('4.5', true)).toBe(4.5);
  });
  it('parses times', () => {
    expect(parseTime('7:30')).toEqual({ h: 7, m: 30 });
    expect(parseTime('07:30')).toEqual({ h: 7, m: 30 });
    expect(parseTime('7.30')).toEqual({ h: 7, m: 30 });
    expect(parseTime('0730')).toEqual({ h: 7, m: 30 });
    expect(parseTime('7:60')).toBeNull();
    expect(parse24('19:35')).toBe(19 * 60 + 35);
    expect(parse12('7:35', 'pm')).toBe(19 * 60 + 35);
    expect(parse12('12:10', 'am')).toBe(10);
    expect(parse12('12:10', 'pm')).toBe(12 * 60 + 10);
    expect(parse12('13:10', 'pm')).toBeNull();
    expect(parseClockFace('12:05')).toBe(5);
  });
});

describe('rng', () => {
  it('is reproducible', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(a.int(0, 1000)).toBe(b.int(0, 1000));
  });
  it('int stays in range', () => {
    const r = makeRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});

describe('geometry', () => {
  it('finds the right number of lines of symmetry', () => {
    for (const s of SYM_SHAPES) expect(symmetryAxes(s.pts).length, s.name).toBe(s.lines);
  });
});

function jobFor(id: string): JobDef {
  if (id === 'R1') return { id, title: 'Unit 1 review', job: '', topics: UNIT1, review: true };
  if (id === 'F') return { id, title: 'Final', job: '', topics: [...UNIT1, ...UNIT2], review: true };
  const t = TOPIC_LIST.find((x) => x.id === id)!;
  return { id, title: t.title, job: t.job, topics: [id], review: false };
}

describe('planner', () => {
  it('ramps tiers 1 → 3 with no adaptivity', () => {
    let s = newJobState();
    const tiers: number[] = [];
    for (let i = 0; i < 10; i++) {
      tiers.push(tierFor(s, 0));
      s = recordResult(s, i % 2 === 0); // alternating → no streaks
    }
    expect(tiers).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
  });

  it('eases after 2 wrong and hardens after 3 right', () => {
    let s = newJobState();
    s = recordResult(s, true); s = recordResult(s, true); s = recordResult(s, true);
    expect(s.offset).toBe(1);
    expect(tierFor(s, 0)).toBe(2);
    s = recordResult(s, false); s = recordResult(s, false);
    expect(s.offset).toBe(0);
    s = recordResult(s, false); s = recordResult(s, false);
    expect(s.offset).toBe(-1);
  });

  it('builds full sessions with no repeats and ≤10% multiple choice', () => {
    let totalQ = 0, totalChoice = 0;
    for (let seed = 0; seed < 40; seed++) {
      const rng = makeRng(seed);
      const seen = new Set<string>();
      for (const id of [...TOPIC_LIST.map((t) => t.id), 'R1', 'F']) {
        const job = jobFor(id);
        let s = newJobState();
        const sigs: string[] = [];
        for (let i = 0; i < 10; i++) {
          const q = nextQuestion(rng, job, s, { nudge: 0, weights: {}, seen });
          s = noteShown(s, q);
          sigs.push(q.signature);
          totalQ++;
          if (q.isChoice) totalChoice++;
          s = recordResult(s, rng.chance(0.75));
        }
        expect(new Set(sigs).size).toBe(10);
        expect(s.choiceCount).toBeLessThanOrEqual(job.review ? 1 : 2);
        if (job.review) for (const c of Object.values(s.topicCounts)) expect(c).toBeLessThanOrEqual(2);
      }
    }
    expect(totalChoice / totalQ).toBeLessThan(0.1);
  });

  it('recap questions keep the same skill and never get harder', () => {
    const rng = makeRng(5);
    for (const t of TOPIC_LIST) for (const kind of t.kinds) for (const tier of [1, 2, 3] as const) {
      const q = recapQuestion(rng, { topicId: t.id, kind, tier }, new Set());
      expect(q.kind).toBe(kind);
      expect(q.tier).toBeLessThanOrEqual(tier);
    }
  });
});
