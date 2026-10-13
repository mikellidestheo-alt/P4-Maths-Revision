import { T13, type Tier } from '../config/difficulty';
import { judgeNumber, makeQuestion, numberFallback, oneNumber } from '../engine/build';
import { fmt, PLACE_NAMES } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.3';

export const roundTo = (n: number, r: number) => Math.floor((n + r / 2) / r) * r;

function genToRound(rng: Rng, tier: Tier): { n: number; r: number } {
  const r = rng.pick(T13.roundTo[tier]);
  const max = Math.max(T13.numberMax[tier], r * 10);
  for (;;) {
    let n = rng.int(r + 1, max);
    if (rng.chance(T13.midpointChance)) n = Math.floor(n / r) * r + r / 2;
    if (n % r !== 0 && n <= max) return { n, r };
  }
}

function roundFeedback(n: number, r: number) {
  const lo = Math.floor(n / r) * r, hi = lo + r, mid = lo + r / 2;
  return (x: number) => {
    if (x === lo || x === hi) {
      return { correct: false, feedback: n === mid
        ? `${fmt(n)} is exactly halfway! When a number is halfway, we round up.`
        : `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}. Which one is it closer to? Halfway is ${fmt(mid)}.` };
    }
    if (x % r !== 0) return { correct: false, feedback: `A number rounded to the nearest ${fmt(r)} ends in ${'0'.repeat(Math.log10(r))}.` };
    return { correct: false, feedback: `Find the two multiples of ${fmt(r)} either side of ${fmt(n)} first.` };
  };
}

function workedRound(n: number, r: number) {
  const lo = Math.floor(n / r) * r, hi = lo + r, mid = lo + r / 2;
  const ans = roundTo(n, r);
  return [
    `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.`,
    `Halfway is ${fmt(mid)}. ${n === mid ? 'It is exactly halfway, so round up.' : n > mid ? `${fmt(n)} is past halfway, so round up.` : `${fmt(n)} is below halfway, so round down.`}`,
    `${fmt(n)} rounds to ${fmt(ans)}.`,
  ];
}

function genRoundLine(rng: Rng, tier: Tier): Question {
  const { n, r } = genToRound(rng, tier === 3 ? 2 : tier);
  const ans = roundTo(n, r);
  const lo = Math.max(0, Math.floor(n / r) * r - rng.int(0, 2) * r);
  const hi = lo + 5 * r;
  const start = ans === lo ? hi : lo;
  const fb = roundFeedback(n, r);
  return makeQuestion({
    topicId: ID, kind: 'roundLine', tier,
    story: 'Estimate the pile of logs so Wren knows roughly how many there are.',
    prompt: `Drag the lantern to ${fmt(n)} rounded to the nearest ${fmt(r)}.`,
    interaction: { type: 'numberLine', min: lo, max: hi, tick: r, flag: tier === 1 ? n : undefined, label: fmt(n), start },
    expected: String(ans),
    check(a: Answer) {
      const res = judgeNumber(String(a), ans);
      if (res.correct) return res;
      const x = Number(String(a).replace(/,/g, ''));
      return Number.isFinite(x) ? fb(x) : res;
    },
    hint: `Which multiple of ${fmt(r)} is nearest? If it’s exactly halfway, round up.`,
    worked: workedRound(n, r),
    answerText: fmt(ans),
    sig: [n, r],
    fallback: numberFallback(String(ans), 'Type the answer instead'),
    wrongExample: String(ans === lo ? lo + r : ans - r),
  });
}

function genRoundTyped(rng: Rng, tier: Tier): Question {
  const { n, r } = genToRound(rng, tier);
  const ans = roundTo(n, r);
  const fb = roundFeedback(n, r);
  const f = oneNumber(ans, { extraCheck: (x) => fb(x) });
  return makeQuestion({
    topicId: ID, kind: 'roundTyped', tier,
    story: 'The stockroom list needs rough numbers.',
    prompt: `Round ${fmt(n)} to the nearest ${fmt(r)}.`,
    ...f,
    hint: `Look at the ${PLACE_NAMES[Math.round(Math.log10(r)) - 1]} digit. 5 or more? Round up. Less than 5? Round down.`,
    worked: workedRound(n, r),
    answerText: fmt(ans),
    sig: [n, r],
  });
}

function genRoundRange(rng: Rng, tier: Tier): Question {
  const r = rng.pick(tier === 1 ? [10] : tier === 2 ? [10, 100] : [100, 1000]);
  const x = rng.int(2, tier === 1 ? 50 : 99) * r;
  const smallest = rng.chance(0.6);
  const ans = smallest ? x - r / 2 : x + r / 2 - 1;
  const f = oneNumber(ans, {
    extraCheck: (v) => {
      if (smallest && v === x - r / 2 - 1) return { correct: false, feedback: `${fmt(v)} would round down to ${fmt(x - r)}. Try one more.` };
      if (!smallest && v === x + r / 2) return { correct: false, feedback: `${fmt(v)} is halfway, so it rounds up to ${fmt(x + r)}. Try one less.` };
      return null;
    },
  });
  return makeQuestion({
    topicId: ID, kind: 'roundRange', tier,
    story: 'Juniper guessed the number of acorns and rounded it.',
    prompt: `A whole number rounds to ${fmt(x)} to the nearest ${fmt(r)}. What is the ${smallest ? 'smallest' : 'largest'} it could be?`,
    ...f,
    hint: `Think about the halfway points: ${fmt(x - r / 2)} and ${fmt(x + r / 2)}. Halfway numbers round up.`,
    worked: [
      `Numbers from ${fmt(x - r / 2)} up to ${fmt(x + r / 2 - 1)} round to ${fmt(x)}.`,
      `(${fmt(x + r / 2)} is halfway, so it rounds up to ${fmt(x + r)}.)`,
      `The ${smallest ? 'smallest' : 'largest'} is ${fmt(ans)}.`,
    ],
    answerText: fmt(ans),
    sig: [x, r, smallest],
  });
}

/** Distinct numbers that look alike (same length, shared digits) to make ordering interesting. */
export function similarNumbers(rng: Rng, count: number, max: number): number[] {
  const len = String(max).length - (rng.chance(0.3) ? 1 : 0);
  const base = String(rng.int(10 ** (len - 1), Math.min(max, 10 ** len - 1)));
  const set = new Set<number>([Number(base)]);
  let guard = 0;
  while (set.size < count && guard++ < 1000) {
    const d = base.split('');
    const mode = rng.int(0, 2);
    if (mode === 0) {
      // swap two digits
      const i = rng.int(0, d.length - 1), j = rng.int(0, d.length - 1);
      [d[i], d[j]] = [d[j], d[i]];
    } else if (mode === 1) {
      d[rng.int(1, d.length - 1)] = String(rng.int(0, 9));
    } else {
      d[rng.int(0, d.length - 1)] = String(rng.int(1, 9));
    }
    if (d[0] === '0') continue;
    const v = Number(d.join(''));
    if (v <= max && v > 0) set.add(v);
  }
  return [...set];
}

function genOrder(rng: Rng, tier: Tier): Question {
  const [cmin, cmax] = T13.orderCount[tier];
  const count = rng.int(cmin, cmax);
  const values = similarNumbers(rng, count, T13.orderMax[tier]);
  const asc = rng.chance(0.6);
  const items = rng.shuffle(values.map((v, i) => ({ id: `n${i}`, label: fmt(v), v })));
  // make sure the starting order isn't already correct
  const sortedIds = items.slice().sort((a, b) => (asc ? a.v - b.v : b.v - a.v)).map((x) => x.id);
  if (items.map((x) => x.id).join() === sortedIds.join()) items.reverse();
  const byId = new Map(items.map((x) => [x.id, x.v]));
  return makeQuestion({
    topicId: ID, kind: 'order', tier,
    story: 'Sort the stockroom shelves so things are easy to find.',
    prompt: `Put the boxes in order, ${asc ? 'smallest to largest' : 'largest to smallest'}.`,
    interaction: { type: 'order', items: items.map(({ id, label }) => ({ id, label })), direction: asc ? 'asc' : 'desc' },
    expected: sortedIds,
    check(a: Answer) {
      const ids = a as string[];
      if (!Array.isArray(ids) || ids.length !== items.length) return { correct: false, feedback: 'Use every box once.' };
      for (let i = 0; i + 1 < ids.length; i++) {
        const x = byId.get(ids[i])!, y = byId.get(ids[i + 1])!;
        if (asc ? x > y : x < y) return { correct: false, feedback: `The shelf wobbles! Look at ${fmt(x)} and ${fmt(y)}. Which is ${asc ? 'smaller' : 'larger'}?` };
      }
      return { correct: true };
    },
    hint: 'Compare the digits from the left. The first column that is different decides.',
    worked: [`${asc ? 'Smallest to largest' : 'Largest to smallest'}:`, sortedIds.map((id) => fmt(byId.get(id)!)).join(asc ? ' < ' : ' > ')],
    answerText: sortedIds.map((id) => fmt(byId.get(id)!)).join(', '),
    sig: [values.slice().sort(), asc],
    wrongExample: sortedIds.slice().reverse(),
  });
}

function genCompare(rng: Rng, tier: Tier): Question {
  let left: string, right: string, lv: number, rv: number;
  if (rng.chance(0.2)) {
    // equal case written two ways
    const a = rng.int(1, 9) * 10_000, b = rng.int(1, 9) * 1_000, c = rng.int(0, 9) * 100;
    lv = rv = a + b + c;
    left = [a, b, c].filter((x) => x).map(fmt).join(' + ');
    right = fmt(rv);
  } else {
    const [x, y] = similarNumbers(rng, 2, T13.orderMax[tier]);
    lv = x; rv = y;
    left = fmt(x); right = fmt(y);
  }
  const ans = lv < rv ? 'lt' : lv > rv ? 'gt' : 'eq';
  const word = { lt: '<', gt: '>', eq: '=' } as const;
  return makeQuestion({
    topicId: ID, kind: 'compare', tier,
    story: 'Which shelf holds more?',
    prompt: `Choose the sign: ${left}  ?  ${right}`,
    interaction: { type: 'choice', options: [
      { id: 'lt', label: '<  (is less than)' },
      { id: 'gt', label: '>  (is greater than)' },
      { id: 'eq', label: '=  (is equal to)' },
    ] },
    expected: ans,
    check(a: Answer) {
      if (a === ans) return { correct: true };
      return { correct: false, feedback: 'Compare the digits from the left, column by column.' };
    },
    hint: 'The open mouth of < or > points to the bigger number.',
    worked: [`${left} ${word[ans]} ${right}`],
    answerText: word[ans],
    sig: [left, right],
    isChoice: true,
    wrongExample: ans === 'lt' ? 'gt' : 'lt',
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  roundLine: genRoundLine,
  roundTyped: genRoundTyped,
  roundRange: genRoundRange,
  order: genOrder,
  compare: genCompare,
};

export const topic13: TopicModule = {
  id: ID,
  title: 'Rounding and ordering',
  job: 'Sort the stockroom',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { roundLine: [3, 3, 1], roundTyped: [2, 3, 3], roundRange: [0, 0, 3], order: [3, 3, 3], compare: [1, 1, 0] }, tier, ['compare']);
    return GENS[kind](rng, tier);
  },
};
