import { T21, type Tier } from '../config/difficulty';
import { makeQuestion, oneNumber } from '../engine/build';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { CheckResult, GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '2.2';

/** The classic "take the smaller digit from the larger" mistake, column by column. */
export function smallerFromLarger(a: number, b: number): number {
  const sa = String(a), sb = String(b).padStart(sa.length, '0');
  return Number(sa.split('').map((d, i) => Math.abs(Number(d) - Number(sb[i]))).join(''));
}

export function subPair(rng: Rng, tier: Tier): { a: number; b: number; strategy: string } {
  for (;;) {
    if (tier === 1) {
      const a = rng.int(T21.twoDigit[0] + 10, 99), b = rng.int(...T21.twoDigit);
      if (a > b && a % 10 < b % 10) return { a, b, strategy: `Take away the tens, then the ones: ${a} − ${b - (b % 10)} = ${a - b + (b % 10)}, then − ${b % 10}.` };
    } else if (tier === 2) {
      const a = rng.int(...T21.threeDigit);
      const b = rng.chance(0.6) ? rng.int(1, 9) * 10 : rng.int(1, 8) * 100;
      const bridges = b < 100 ? a % 100 < b : true;
      if (bridges && a > b) return { a, b, strategy: b < 100 ? `Bridge back through the hundred: ${fmt(a)} − ${a % 100} = ${fmt(a - (a % 100))}, then take away the rest.` : `Only the hundreds change: take away ${b / 100} hundred${b === 100 ? '' : 's'}.` };
    } else {
      const a = rng.int(...T21.fourDigit);
      const round = rng.pick([100, 200, 300, 500, 1000, 2000]);
      const off = rng.pick(T21.nearRoundOffsets);
      const b = round + off;
      if (a > b + 100) return { a, b, strategy: `Compensate: take away ${fmt(round)}, then ${off < 0 ? `add ${-off} back` : `take away ${off} more`}.` };
    }
  }
}

function subCheck(a: number, b: number) {
  return (x: number): CheckResult | null => {
    if (x === smallerFromLarger(a, b) && x !== a - b) return { correct: false, feedback: 'Careful! When the top digit is smaller, you need to bridge through the next ten or hundred.' };
    if (x === a + b) return { correct: false, feedback: 'That’s adding! This time take away.' };
    return null;
  };
}

function genSub(rng: Rng, tier: Tier): Question {
  const { a, b, strategy } = subPair(rng, tier);
  const ans = a - b;
  const f = oneNumber(ans, {
    before: [`${fmt(a)} − ${fmt(b)} =`],
    fb: { high: 'That leaves too many.', low: 'That leaves too few.' },
    extraCheck: subCheck(a, b),
  });
  return makeQuestion({
    topicId: ID, kind: 'sub', tier,
    story: rng.pick(['Some logs were burned on the fire.', 'Some berries were eaten at supper.', 'Some lanterns were packed away.']),
    prompt: 'Work it out in your head.',
    ...f,
    hint: strategy,
    worked: [strategy, `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}`],
    answerText: fmt(ans),
    sig: [a, b],
  });
}

function genMissing(rng: Rng, tier: Tier): Question {
  let a: number, b: number;
  const form = tier === 1 ? rng.pick(['part', 'whole']) : rng.pick(['part', 'whole', 'from']);
  if (form === 'from') {
    a = tier === 2 ? 100 : 1000;
    b = tier === 2 ? rng.int(11, 89) : rng.int(101, 899);
    if (b % 10 === 0) b += 5;
  } else ({ a, b } = subPair(rng, tier));
  const c = a - b;
  // forms:  a − __ = c  (part) · __ − b = c (whole) · 1,000 − __ = c (from)
  let before: string[], after: string[], ans: number, hint: string;
  if (form === 'whole') {
    before = []; after = [`− ${fmt(b)} = ${fmt(c)}`]; ans = a; hint = `Undo it: ${fmt(c)} + ${fmt(b)}.`;
  } else {
    before = [`${fmt(a)} −`]; after = [`= ${fmt(c)}`]; ans = b; hint = `Count on from ${fmt(c)} to ${fmt(a)}.`;
  }
  const f = oneNumber(ans, { before, after, fb: { high: 'Too big — try it in the number sentence.', low: 'Too small — try it in the number sentence.' } });
  return makeQuestion({
    topicId: ID, kind: 'missing', tier,
    story: 'Rain smudged a number in the camp diary.',
    prompt: 'What is the missing number?',
    ...f,
    hint,
    worked: form === 'whole' ? [`${fmt(c)} + ${fmt(b)} = ${fmt(a)}`] : [`${fmt(a)} − ${fmt(c)} = ${fmt(b)}`],
    answerText: fmt(ans),
    sig: [a, b, form],
  });
}

function genDifference(rng: Rng, tier: Tier): Question {
  let a: number, b: number;
  if (tier === 1) {
    b = rng.int(21, 79); a = b + rng.int(5, 19);
    if (Math.floor(a / 10) === Math.floor(b / 10)) a += 10;
  } else {
    // close numbers either side of a boundary: count on is easiest
    const boundary = tier === 2 ? rng.int(2, 9) * 100 : rng.int(2, 9) * 1000;
    b = boundary - rng.int(2, tier === 2 ? 30 : 45);
    a = boundary + rng.int(1, tier === 2 ? 40 : 60);
  }
  const f = oneNumber(a - b, { extraCheck: subCheck(a, b) });
  return makeQuestion({
    topicId: ID, kind: 'difference', tier,
    story: 'Two campers counted their footsteps on the trail.',
    prompt: `What is the difference between ${fmt(a)} and ${fmt(b)}?`,
    ...f,
    hint: `The numbers are close together — count on from ${fmt(b)} to ${fmt(a)}.`,
    worked: [`${fmt(b)} → ${fmt(Math.ceil(b / (tier === 1 ? 10 : tier === 2 ? 100 : 1000)) * (tier === 1 ? 10 : tier === 2 ? 100 : 1000))} → ${fmt(a)}`, `${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`],
    answerText: fmt(a - b),
    sig: [a, b],
  });
}

function genStory(rng: Rng, tier: Tier): Question {
  const { a, b, strategy } = subPair(rng, tier);
  const c = rng.pick([
    { s: `There were ${fmt(a)} marshmallows. The campers toasted ${fmt(b)}.`, q: 'How many are left?' },
    { s: `The trail is ${fmt(a)} steps long. Wren has walked ${fmt(b)} steps.`, q: 'How many steps to go?' },
    { s: `Juniper’s map has ${fmt(a)} trees. ${fmt(b)} are pine trees.`, q: 'How many are not pine trees?' },
  ]);
  const f = oneNumber(a - b, { extraCheck: subCheck(a, b) });
  return makeQuestion({
    topicId: ID, kind: 'story', tier,
    story: c.s,
    prompt: c.q,
    ...f,
    hint: strategy,
    worked: [`${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`],
    answerText: fmt(a - b),
    sig: [c.s],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  sub: genSub,
  missing: genMissing,
  difference: genDifference,
  story: genStory,
};

export const topic22: TopicModule = {
  id: ID,
  title: 'Subtracting in your head',
  job: 'Share out the supplies',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { sub: [5, 4, 4], missing: [1, 2, 3], difference: [2, 2, 2], story: [2, 2, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};
