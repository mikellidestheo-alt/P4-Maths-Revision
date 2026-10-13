import { T15, type Tier } from '../config/difficulty';
import { makeQuestion, manyNumbers, oneNumber } from '../engine/build';
import { ordinal, parseNumber } from '../engine/answers';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Question, Token, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.5';

interface Seq { terms: number[]; step: number; up: boolean }

export function genSeq(rng: Rng, tier: Tier, len: number): Seq {
  for (;;) {
    const step = rng.pick(T15.steps[tier]);
    const up = !rng.chance(T15.decreasingChance[tier]);
    const offset = T15.offsetStart[tier] && rng.chance(0.5) ? rng.int(1, step - 1) : 0;
    const maxK = Math.max(2, Math.floor(Math.min(T15.maxTerm, step * (tier === 1 ? 12 : 40)) / step) - len);
    const k = rng.int(up ? 0 : len, maxK + (up ? 0 : len));
    const start = k * step + offset;
    const terms = Array.from({ length: len }, (_, i) => (up ? start + i * step : start - i * step));
    if (terms.every((t) => t >= 0 && t <= T15.maxTerm) && (up ? terms[0] > 0 || offset === 0 : true) && terms.some((t) => t > 0)) {
      return { terms, step, up };
    }
  }
}

function genNext(rng: Rng, tier: Tier): Question {
  const s = genSeq(rng, tier, 6);
  const tokens: Token[] = s.terms.slice(0, 4).map(fmt);
  tokens.push({ kind: 'number', id: 'n4', label: 'next number' }, { kind: 'number', id: 'n5', label: 'number after that' });
  const f = manyNumbers({ n4: s.terms[4], n5: s.terms[5] }, tokens, {
    layout: 'markers',
    names: { n4: 'the first box', n5: 'the second box' },
    wrongMsg: 'The gate stones don’t glow — the pattern isn’t right yet.',
  });
  return makeQuestion({
    topicId: ID, kind: 'next', tier,
    story: 'The stone gate opens when the pattern is finished.',
    prompt: 'What are the next two numbers?',
    ...f,
    hint: 'Find the gap between the numbers. Is it going up or down?',
    worked: [`The pattern ${s.up ? 'adds' : 'takes away'} ${fmt(s.step)} each time.`, s.terms.map(fmt).join(', ')],
    answerText: `${fmt(s.terms[4])}, ${fmt(s.terms[5])}`,
    sig: s.terms,
  });
}

function genMissing(rng: Rng, tier: Tier): Question {
  const s = genSeq(rng, tier, 6);
  const blanks = rng.shuffle([1, 2, 3, 4]).slice(0, tier === 1 ? 1 : 2).sort();
  const tokens: Token[] = [];
  const exp: Record<string, number> = {};
  const names: Record<string, string> = {};
  s.terms.forEach((t, i) => {
    if (blanks.includes(i)) {
      tokens.push({ kind: 'number', id: `m${i}`, label: `stone ${i + 1}` });
      exp[`m${i}`] = t;
      names[`m${i}`] = `stone ${i + 1}`;
    } else tokens.push(fmt(t));
  });
  const f = manyNumbers(exp, tokens, { layout: 'markers', names, wrongMsg: 'A stone is in the wrong place.' });
  return makeQuestion({
    topicId: ID, kind: 'missing', tier,
    story: 'Some stones in the patterned path are missing.',
    prompt: 'Fill in the missing numbers.',
    ...f,
    hint: 'Look at two numbers next to each other to find the step.',
    worked: [`The step is: ${s.up ? 'add' : 'take away'} ${fmt(s.step)}.`, s.terms.map(fmt).join(', ')],
    answerText: blanks.map((i) => fmt(s.terms[i])).join(', '),
    sig: [s.terms, blanks],
  });
}

function genRule(rng: Rng, tier: Tier): Question {
  const s = genSeq(rng, tier, 5);
  const op = s.up ? 'add' : 'sub';
  const tokens: Token[] = [
    'The rule is:',
    { kind: 'toggle', id: 'op', label: 'add or take away', options: [{ value: 'add', label: 'add' }, { value: 'sub', label: 'take away' }] },
    { kind: 'number', id: 'a', label: 'how much' },
    'each time.',
  ];
  return makeQuestion({
    topicId: ID, kind: 'rule', tier,
    story: 'Carve the pattern rule onto the gate.',
    prompt: `${s.terms.map(fmt).join(', ')} …`,
    interaction: { type: 'fields', tokens },
    expected: { op, a: String(s.step) },
    check(a: Answer) {
      const r = a as Record<string, string>;
      if (r.op !== 'add' && r.op !== 'sub') return { correct: false, feedback: 'Choose “add” or “take away”.' };
      const n = parseNumber(r.a ?? '');
      if (n === null) return { correct: false, feedback: 'Type how much it changes by.' };
      if (r.op !== op && n === s.step) return { correct: false, feedback: `Right size of step! But are the numbers getting bigger or smaller?` };
      if (r.op === op && n === s.step) return { correct: true };
      return { correct: false, feedback: 'Find the difference between two numbers next to each other.' };
    },
    hint: 'Are the numbers getting bigger or smaller? By how much?',
    worked: [`${fmt(s.terms[0])} → ${fmt(s.terms[1])}: ${s.up ? 'add' : 'take away'} ${fmt(s.step)}`, `The rule is: ${s.up ? 'add' : 'take away'} ${fmt(s.step)} each time.`],
    answerText: `${s.up ? 'add' : 'take away'} ${fmt(s.step)}`,
    sig: s.terms,
    wrongExample: { op: op === 'add' ? 'sub' : 'add', a: String(s.step) },
  });
}

function genOddOne(rng: Rng, tier: Tier): Question {
  const m = rng.pick(tier === 1 ? [2, 5, 10] : tier === 2 ? [3, 4, 25, 50, 100] : [6, 7, 8, 9, 25, 1000]);
  const maxK = m <= 10 ? 12 : m === 1000 ? 40 : 30;
  const ks = rng.shuffle(Array.from({ length: maxK - 1 }, (_, i) => i + 2)).slice(0, 4);
  const multiples = ks.map((k) => k * m);
  let odd = 0;
  for (;;) {
    const near = rng.pick(multiples);
    const delta = m === 1000 ? rng.pick([100, 500, 10, 250]) : m >= 25 ? rng.pick([5, 10, 15, 20]).valueOf() % m || 5 : rng.int(1, m - 1);
    odd = near + (rng.chance(0.5) ? delta : -delta);
    if (odd > 0 && odd % m !== 0 && !multiples.includes(odd)) break;
  }
  const all = rng.shuffle([...multiples, odd]);
  const f = oneNumber(odd, {
    extraCheck: (x) => (all.includes(x) ? { correct: false, feedback: `${fmt(x)} is in the ${fmt(m)} times table pattern: ${fmt(x)} = ${x / m} × ${fmt(m)}.` } : { correct: false, feedback: 'Type one of the numbers on the stones.' }),
  });
  return makeQuestion({
    topicId: ID, kind: 'oddOne', tier,
    story: 'One stone doesn’t belong in the gate.',
    prompt: `${all.map(fmt).join(',  ')}. Which number is NOT a multiple of ${fmt(m)}? Type it.`,
    ...f,
    hint: m === 2 ? 'Multiples of 2 are even.' : m === 5 ? 'Multiples of 5 end in 0 or 5.' : m === 10 ? 'Multiples of 10 end in 0.' : m === 25 ? 'Multiples of 25 end in 00, 25, 50 or 75.' : m === 50 ? 'Multiples of 50 end in 00 or 50.' : m === 100 ? 'Multiples of 100 end in 00.' : m === 1000 ? 'Multiples of 1,000 end in 000.' : `Use your ${m} times table.`,
    worked: [...multiples.map((x) => `${fmt(x)} = ${x / m} × ${fmt(m)}`), `${fmt(odd)} is not a multiple of ${fmt(m)}.`],
    answerText: fmt(odd),
    sig: [m, all],
    wrongExample: { a: String(multiples[0]) },
  });
}

function genNth(rng: Rng, tier: Tier): Question {
  const step = rng.pick(tier === 1 ? [2, 5, 10] : tier === 2 ? [3, 4, 25, 50, 100] : [25, 50, 100, 1000, 6, 7, 8, 9]);
  const start = tier === 3 && rng.chance(0.4) ? rng.int(1, 9) : step;
  const n = rng.int(6, tier === 1 ? 10 : 12);
  const ans = start + (n - 1) * step;
  const shown = [0, 1, 2].map((i) => start + i * step);
  const f = oneNumber(ans, {
    extraCheck: (x) => (x === start + n * step ? { correct: false, feedback: `Careful — that’s the ${ordinal(n + 1)} number. Count again from the first.` } : null),
  });
  return makeQuestion({
    topicId: ID, kind: 'nth', tier,
    story: 'Lanterns line the path in a counting pattern.',
    prompt: `${shown.map(fmt).join(', ')} … What is the ${ordinal(n)} number?`,
    ...f,
    hint: 'Keep counting on. You could write the numbers on the jotter.',
    worked: [Array.from({ length: n }, (_, i) => fmt(start + i * step)).join(', '), `The ${ordinal(n)} number is ${fmt(ans)}.`],
    answerText: fmt(ans),
    sig: [start, step, n],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  next: genNext,
  missing: genMissing,
  rule: genRule,
  oddOne: genOddOne,
  nth: genNth,
};

export const topic15: TopicModule = {
  id: ID,
  title: 'Sequences and patterns',
  job: 'Open the stone gate',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { next: [4, 3, 2], missing: [2, 3, 3], rule: [2, 2, 2], oddOne: [1, 2, 2], nth: [1, 1, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};

