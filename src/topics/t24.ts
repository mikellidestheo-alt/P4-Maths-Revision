import { T23, type Tier } from '../config/difficulty';
import { makeQuestion, numberFallback, oneNumber } from '../engine/build';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';
import { checkSubColumns, exchanges, nDigits, rowExpected, workedSub } from './column';

const ID = '2.4';

const withDigits = (rng: Rng, d: number) => rng.int(10 ** (d - 1), 10 ** d - 1);

export function subPairColumn(rng: Rng, tier: Tier): [number, number] {
  const [dmin, dmax] = T23.digits[tier];
  for (;;) {
    const d = rng.int(dmin, dmax);
    let a = withDigits(rng, d);
    const zeros = tier === 3 && rng.chance(T23.zerosChance);
    if (zeros) {
      const s = String(a).split('');
      const pos = rng.shuffle(Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, rng.int(1, Math.min(3, d - 2)));
      for (const p of pos) s[p] = '0';
      a = Number(s.join(''));
    }
    const b = withDigits(rng, rng.int(Math.max(2, d - 1), d));
    if (b >= a) continue;
    const ex = exchanges(a, b);
    if (tier === 1 && ex < 1) continue;
    if (tier >= 2 && ex < 2) continue;
    if (zeros && !String(a).slice(1, -1).includes('0')) continue;
    if (nDigits(a) > T23.maxDigits) continue;
    return [a, b];
  }
}

function genColumn(rng: Rng, tier: Tier, kind = 'column'): Question {
  const [a, b] = subPairColumn(rng, tier);
  const width = nDigits(a);
  return makeQuestion({
    topicId: ID, kind, tier,
    story: 'Work out what’s left in the camp stores.',
    prompt: `Use the column method: ${fmt(a)} − ${fmt(b)}`,
    interaction: { type: 'column', op: '-', operands: [a, b] },
    expected: rowExpected(a - b, width),
    check: (ans: Answer) => checkSubColumns(a, b, ans),
    hint: 'Start with the ones. If the top digit is smaller, exchange 1 from the next column to the left (it becomes 10 more).',
    worked: workedSub(a, b),
    answerText: fmt(a - b),
    sig: [a, b],
    fallback: numberFallback(String(a - b), 'Type the answer instead'),
    wrongExample: rowExpected(a - b + 10 <= a ? a - b + 10 : a - b - 1, width),
  });
}

const STORIES = [
  (a: string, b: string) => ({ s: `The store had ${a} sticks. The campers used ${b}.`, q: 'How many sticks are left? Use the column method.' }),
  (a: string, b: string) => ({ s: `The trail is ${a} metres long. Wren has walked ${b} metres.`, q: 'How far is left to walk? Use the column method.' }),
  (a: string, b: string) => ({ s: `There were ${a} acorns in the big tub. The squirrels took ${b}.`, q: 'How many acorns are left? Use the column method.' }),
];

function genStory(rng: Rng, tier: Tier): Question {
  const pick = rng.pick(STORIES);
  const q = genColumn(rng, tier, 'story');
  const [a, b] = (q.interaction as { operands: number[] }).operands;
  const st = pick(fmt(a), fmt(b));
  q.story = st.s;
  q.prompt = st.q;
  return q;
}

function genInverse(rng: Rng, tier: Tier): Question {
  const [a, b] = subPairColumn(rng, tier === 3 ? 2 : tier);
  const c = a - b;
  const f = oneNumber(a, { before: [`${fmt(c)} + ${fmt(b)} =`], fb: { high: 'Too big.', low: 'Too small.' } });
  return makeQuestion({
    topicId: ID, kind: 'inverse', tier,
    story: `Juniper worked out ${fmt(a)} − ${fmt(b)} = ${fmt(c)}.`,
    prompt: 'Check with the inverse: work out the addition. Do you get back to the first number?',
    ...f,
    hint: 'Addition undoes subtraction. Use the jotter for the column method if it helps.',
    worked: [`${fmt(c)} + ${fmt(b)} = ${fmt(a)}`, `It matches ${fmt(a)}, so Juniper was right.`],
    answerText: fmt(a),
    sig: [a, b],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  column: (r, t) => genColumn(r, t),
  story: genStory,
  inverse: genInverse,
};

export const topic24: TopicModule = {
  id: ID,
  title: 'Written subtraction',
  job: 'Balance the stock book',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { column: [6, 5, 4], story: [3, 3, 3], inverse: [0, 1, 3] }, tier);
    return GENS[kind](rng, tier);
  },
};
