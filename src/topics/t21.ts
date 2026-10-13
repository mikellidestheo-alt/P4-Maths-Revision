import { T21, type Tier } from '../config/difficulty';
import { makeQuestion, oneNumber } from '../engine/build';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '2.1';

/** Pairs a + b for mental addition by tier. */
export function addPair(rng: Rng, tier: Tier): { a: number; b: number; strategy: string } {
  for (;;) {
    if (tier === 1) {
      const a = rng.int(...T21.twoDigit), b = rng.int(...T21.twoDigit);
      if ((a % 10) + (b % 10) >= 10 && a + b < 200) return { a, b, strategy: `Partition: add the tens, then the ones. ${a} + ${b - (b % 10)} = ${a + b - (b % 10)}, then + ${b % 10}.` };
    } else if (tier === 2) {
      const a = rng.int(...T21.threeDigit);
      const b = rng.chance(0.6) ? rng.int(1, 9) * 10 : rng.int(1, 8) * 100;
      const bridges = b < 100 ? (a % 100) + b >= 100 : true;
      if (bridges && a + b <= 1999) return { a, b, strategy: b < 100 ? `Bridge through the hundred: ${fmt(a)} + ${100 - (a % 100)} = ${fmt(a + 100 - (a % 100))}, then add the rest.` : `Only the hundreds change: add ${b / 100} hundred${b === 100 ? '' : 's'}.` };
    } else {
      const a = rng.int(...T21.fourDigit);
      const round = rng.pick([100, 200, 300, 500, 1000, 2000, 3000]);
      const off = rng.pick(T21.nearRoundOffsets);
      const b = round + off;
      if (a + b <= 9999 && b > 0) return { a, b, strategy: `Compensate: add ${fmt(round)}, then ${off < 0 ? `take away ${-off}` : `add ${off}`}.` };
    }
  }
}

function genAdd(rng: Rng, tier: Tier): Question {
  const { a, b, strategy } = addPair(rng, tier);
  const ans = a + b;
  const f = oneNumber(ans, {
    before: [`${fmt(a)} + ${fmt(b)} =`],
    fb: { high: 'That’s too many — the pile would topple over!', low: 'Not enough — the fuel pile is a bit short.' },
    extraCheck: (x) => (x === ans - 10 || x === ans - 100 || x === ans - 1000 ? { correct: false, feedback: 'So close! Did you forget to carry when a column made 10 or more?' } : null),
  });
  return makeQuestion({
    topicId: ID, kind: 'add', tier,
    story: rng.pick(['Add up the firewood at the fire.', 'Count the berries in two baskets.', 'Add the pinecones together.']),
    prompt: 'Work it out in your head.',
    ...f,
    hint: strategy,
    worked: [strategy, `${fmt(a)} + ${fmt(b)} = ${fmt(ans)}`],
    answerText: fmt(ans),
    sig: [a, b],
  });
}

function genMissing(rng: Rng, tier: Tier): Question {
  let a: number, b: number, total: number, hint: string;
  if (tier === 1) {
    ({ a, b } = addPair(rng, 1));
    total = a + b;
    hint = `Count on from ${b} to ${total}.`;
  } else if (tier === 2) {
    total = 100;
    a = rng.int(11, 89);
    if (a % 10 === 0) a += rng.int(1, 9);
    b = total - a;
    hint = `Count on to the next ten, then to 100.`;
  } else {
    if (rng.chance(0.5)) {
      total = 1000;
      a = rng.int(11, 98) * 10 + (rng.chance(0.4) ? 5 : 0);
      b = total - a;
      hint = 'Count on to the next hundred, then to 1,000.';
    } else {
      ({ a, b } = addPair(rng, 3));
      total = a + b;
      hint = `Think: ${fmt(total)} − ${fmt(b)}. Take away ${fmt(Math.round(b / 100) * 100)} and adjust.`;
    }
  }
  const blankFirst = rng.chance(0.5);
  const f = oneNumber(a, {
    before: blankFirst ? [] : [`${fmt(b)} +`],
    after: blankFirst ? [`+ ${fmt(b)} = ${fmt(total)}`] : [`= ${fmt(total)}`],
    fb: { high: 'Too big — check: does it add up to the total?', low: 'Too small — check: does it add up to the total?' },
  });
  return makeQuestion({
    topicId: ID, kind: 'missing', tier,
    story: 'Some logs are hidden behind the tent.',
    prompt: 'What is the missing number?',
    ...f,
    hint,
    worked: [`${fmt(total)} − ${fmt(b)} = ${fmt(a)}`, `Check: ${fmt(a)} + ${fmt(b)} = ${fmt(total)}`],
    answerText: fmt(a),
    sig: [a, b, blankFirst],
  });
}

function genNearDouble(rng: Rng, tier: Tier): Question {
  const unit = tier === 1 ? 1 : tier === 2 ? 10 : 100;
  const n = rng.int(tier === 1 ? 13 : 12, tier === 1 ? 49 : 45) * unit;
  const m = n + unit * (rng.chance(0.5) ? 1 : -1);
  const ans = n + m;
  const f = oneNumber(ans, { before: [`${fmt(n)} + ${fmt(m)} =`], fb: { high: 'A bit too big.', low: 'A bit too small.' } });
  return makeQuestion({
    topicId: ID, kind: 'nearDouble', tier,
    story: 'Two friends gathered nearly the same number of acorns.',
    prompt: 'Use a double to help you.',
    ...f,
    hint: `Double ${fmt(n)} is ${fmt(2 * n)}. Then adjust by ${fmt(unit)}.`,
    worked: [`Double ${fmt(n)} = ${fmt(2 * n)}`, `${fmt(2 * n)} ${m > n ? '+' : '−'} ${fmt(unit)} = ${fmt(ans)}`],
    answerText: fmt(ans),
    sig: [n, m],
  });
}

function genStory(rng: Rng, tier: Tier): Question {
  const { a, b, strategy } = addPair(rng, tier);
  const c = rng.pick([
    { s: `Bramble has ${fmt(a)} pinecones and finds ${fmt(b)} more.`, q: 'How many pinecones now?' },
    { s: `The camp has ${fmt(a)} matches. ${fmt(b)} more arrive in a box.`, q: 'How many matches altogether?' },
    { s: `On Monday ${fmt(a)} fireflies glowed. On Tuesday ${fmt(b)} glowed.`, q: 'How many fireflies is that in total?' },
  ]);
  const f = oneNumber(a + b, { fb: { high: 'That’s too many.', low: 'That’s too few.' } });
  return makeQuestion({
    topicId: ID, kind: 'story', tier,
    story: c.s,
    prompt: c.q,
    ...f,
    hint: strategy,
    worked: [`${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`],
    answerText: fmt(a + b),
    sig: [c.s],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  add: genAdd,
  missing: genMissing,
  nearDouble: genNearDouble,
  story: genStory,
};

export const topic21: TopicModule = {
  id: ID,
  title: 'Adding in your head',
  job: 'Fireside supply sums',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { add: [5, 4, 4], missing: [1, 2, 3], nearDouble: [2, 2, 1], story: [2, 2, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};
