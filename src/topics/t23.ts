import { T23, type Tier } from '../config/difficulty';
import { makeQuestion, numberFallback, oneNumber } from '../engine/build';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';
import { carries, checkAddColumns, nDigits, rowExpected, workedAdd } from './column';

const ID = '2.3';

const withDigits = (rng: Rng, d: number) => rng.int(10 ** (d - 1), 10 ** d - 1);

export function addends(rng: Rng, tier: Tier): number[] {
  const [dmin, dmax] = T23.digits[tier];
  for (;;) {
    const count = tier === 3 && rng.chance(T23.threeAddendsChance) ? 3 : 2;
    const nums = Array.from({ length: count }, (_, i) => withDigits(rng, i === 0 ? rng.int(dmin, dmax) : rng.int(Math.max(2, dmin - 1), dmax)));
    const sum = nums.reduce((s, n) => s + n, 0);
    const minCarries = tier === 1 ? 1 : 2;
    if (nDigits(sum) <= T23.maxDigits && carries(nums) >= minCarries) return nums;
  }
}

function genColumn(rng: Rng, tier: Tier, story?: { s: string; q: string }): Question {
  const nums = addends(rng, tier);
  const sum = nums.reduce((s, n) => s + n, 0);
  const width = Math.max(...nums.map(nDigits)) + 1;
  return makeQuestion({
    topicId: ID, kind: story ? 'story' : 'column', tier,
    story: story?.s ?? 'Add up the camp stores in the stock book.',
    prompt: story?.q ?? `Use the column method: ${nums.map(fmt).join(' + ')}`,
    interaction: { type: 'column', op: '+', operands: nums },
    expected: rowExpected(sum, width),
    check: (a: Answer) => checkAddColumns(nums, a),
    hint: 'Start with the ones on the right. If a column makes 10 or more, write the ones digit and carry the 1 to the next column.',
    worked: workedAdd(nums),
    answerText: fmt(sum),
    sig: nums,
    fallback: numberFallback(String(sum), 'Type the answer instead'),
    wrongExample: rowExpected(sum + 10, width),
  });
}

function genInverse(rng: Rng, tier: Tier): Question {
  const nums = addends(rng, tier === 1 ? 1 : 2).slice(0, 2);
  const [a, b] = nums;
  const s = a + b;
  const f = oneNumber(a, {
    before: [`${fmt(s)} − ${fmt(b)} =`],
    fb: { high: 'Too big.', low: 'Too small.' },
  });
  return makeQuestion({
    topicId: ID, kind: 'inverse', tier,
    story: `Wren added ${fmt(a)} + ${fmt(b)} and got ${fmt(s)}.`,
    prompt: 'Check with the inverse: work out the subtraction. Do you get back to the first number?',
    ...f,
    hint: 'Subtraction undoes addition. Use the column method on the jotter if it helps.',
    worked: [`${fmt(s)} − ${fmt(b)} = ${fmt(a)}`, `Yes! It matches ${fmt(a)}, so Wren’s addition was right.`],
    answerText: fmt(a),
    sig: [a, b],
  });
}

const STORIES = [
  (a: string, b: string) => ({ s: `The stock book says ${a} sticks. A delivery brings ${b} more.`, q: 'How many sticks are there now? Use the column method.' }),
  (a: string, b: string) => ({ s: `Ember counted ${a} fireflies last week and ${b} this week.`, q: 'How many fireflies altogether? Use the column method.' }),
];

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  column: (r, t) => genColumn(r, t),
  story: (r, t) => {
    const pick = r.pick(STORIES);
    const q = genColumn(r, t, { s: '', q: '' });
    const ops = (q.interaction as { operands: number[] }).operands;
    const st = ops.length > 2
      ? { s: `Three deliveries of sticks arrived: ${fmt(ops[0])}, ${fmt(ops[1])} and ${fmt(ops[2])}.`, q: 'How many sticks altogether? Use the column method.' }
      : pick(fmt(ops[0]), fmt(ops[1]));
    q.story = st.s;
    q.prompt = st.q;
    return q;
  },
  inverse: genInverse,
};

export const topic23: TopicModule = {
  id: ID,
  title: 'Written addition',
  job: 'Count the camp stores',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { column: [6, 5, 4], story: [3, 3, 3], inverse: [0, 1, 3] }, tier);
    return GENS[kind](rng, tier);
  },
};
