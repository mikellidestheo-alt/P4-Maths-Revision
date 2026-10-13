import { T14, type Tier } from '../config/difficulty';
import { judgeNumber, makeQuestion, num, numberFallback, oneNumber } from '../engine/build';
import { parseNumber } from '../engine/answers';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, CheckResult, GenContext, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.4';

interface Pair { base: number; factor: 10 | 100; big: number; times: boolean }

function genPair(rng: Rng, tier: Tier): Pair {
  for (;;) {
    const factor = rng.pick(T14.factors[tier]) as 10 | 100;
    const [lo, hi] = T14.base[tier];
    const base = rng.int(lo, hi);
    const big = base * factor;
    if (big <= T14.maxResult) return { base, factor, big, times: rng.chance(0.55) };
  }
}

function placesMsg(x: number, expected: number, factor: number, times: boolean): CheckResult | null {
  for (const k of [10, 100, 1000]) {
    if (x === expected * k || x * k === expected) return { correct: false, feedback: `Nearly! ${factor === 10 ? '×10 or ÷10 moves the digits one place' : '×100 or ÷100 moves the digits two places'}.` };
  }
  if (times && x < expected) return { correct: false, feedback: 'Multiplying by 10 or 100 makes a number bigger.' };
  if (!times && x > expected) return { correct: false, feedback: 'Dividing by 10 or 100 makes a number smaller.' };
  return null;
}

function workedFor(p: Pair) {
  const places = p.factor === 10 ? 'one place' : 'two places';
  return p.times
    ? [`${fmt(p.base)} × ${p.factor}: every digit moves ${places} to the left.`, `${fmt(p.base)} × ${p.factor} = ${fmt(p.big)}`]
    : [`${fmt(p.big)} ÷ ${p.factor}: every digit moves ${places} to the right.`, `${fmt(p.big)} ÷ ${p.factor} = ${fmt(p.base)}`];
}

function genSlide(rng: Rng, tier: Tier): Question {
  const p = genPair(rng, tier);
  const start = p.times ? p.base : p.big;
  const ans = p.times ? p.big : p.base;
  const columns = Math.max(5, String(p.big).length + 1);
  return makeQuestion({
    topicId: ID, kind: 'slide', tier,
    story: p.times ? `The camp recipe needs to make ${p.factor} times as much.` : `Share the supplies equally between ${p.factor} tents.`,
    prompt: `Slide the digits to work out ${fmt(start)} ${p.times ? '×' : '÷'} ${p.factor}.`,
    interaction: { type: 'slide', start, columns },
    expected: String(ans),
    check(a: Answer) {
      const x = parseNumber(String(a), true);
      if (x === null) return { correct: false, feedback: 'Use the arrows to slide the digits.' };
      if (x === ans) return { correct: true };
      return placesMsg(x, ans, p.factor, p.times) ?? { correct: false, feedback: 'Not quite — check which way and how far to slide.' };
    },
    hint: `${p.times ? 'Multiplying moves digits to the left' : 'Dividing moves digits to the right'}: ${p.factor === 10 ? 'one place' : 'two places'}.`,
    worked: workedFor(p),
    answerText: fmt(ans),
    sig: [start, p.factor, p.times],
    fallback: numberFallback(String(ans), 'Type the answer instead'),
    wrongExample: String(ans * 10),
  });
}

function genTyped(rng: Rng, tier: Tier): Question {
  if (T14.allowDecimals && tier >= 2 && rng.chance(0.3)) {
    // e.g. 4.5 × 10 = 45   or   45 ÷ 10 = 4.5
    const tenths = rng.int(11, 99);
    const times = rng.chance(0.5);
    const a = times ? tenths / 10 : tenths;
    const ans = times ? tenths : tenths / 10;
    const f = oneNumber(ans, { decimal: true, before: [`${a} ${times ? '×' : '÷'} 10 =`] });
    return makeQuestion({
      topicId: ID, kind: 'typed', tier,
      story: 'Weigh the food bags for the camp kitchen.',
      prompt: 'Work it out.',
      ...f,
      hint: times ? '×10 moves every digit one place to the left.' : '÷10 moves every digit one place to the right.',
      worked: [`${a} ${times ? '×' : '÷'} 10 = ${ans}`],
      answerText: String(ans),
      sig: ['dec', tenths, times],
    });
  }
  const p = genPair(rng, tier);
  const ans = p.times ? p.big : p.base;
  const f = oneNumber(ans, {
    before: [p.times ? `${fmt(p.base)} × ${p.factor} =` : `${fmt(p.big)} ÷ ${p.factor} =`],
    extraCheck: (x) => placesMsg(x, ans, p.factor, p.times),
  });
  return makeQuestion({
    topicId: ID, kind: 'typed', tier,
    story: p.times ? 'Make enough pancakes for the whole camp.' : 'Pack the berries into equal baskets.',
    prompt: 'Work it out.',
    ...f,
    hint: `${p.times ? 'Multiplying moves digits to the left' : 'Dividing moves digits to the right'}: ${p.factor === 10 ? 'one place' : 'two places'}.`,
    worked: workedFor(p),
    answerText: fmt(ans),
    sig: [p.base, p.factor, p.times],
  });
}

function genMissing(rng: Rng, tier: Tier): Question {
  const p = genPair(rng, tier);
  // which number is missing: the base, the factor, or (for ÷) the big number
  const form = rng.pick(tier === 1 ? ['baseTimes', 'factorTimes'] : ['baseTimes', 'factorTimes', 'factorDiv', 'bigDiv']);
  let ans: number, text: string;
  const box = num('a', 'missing number');
  let toks;
  switch (form) {
    case 'baseTimes':
      ans = p.base; toks = [box, `× ${p.factor} = ${fmt(p.big)}`]; text = `${fmt(p.base)} × ${p.factor} = ${fmt(p.big)}`; break;
    case 'factorTimes':
      ans = p.factor; toks = [`${fmt(p.base)} ×`, box, `= ${fmt(p.big)}`]; text = `${fmt(p.base)} × ${p.factor} = ${fmt(p.big)}`; break;
    case 'factorDiv':
      ans = p.factor; toks = [`${fmt(p.big)} ÷`, box, `= ${fmt(p.base)}`]; text = `${fmt(p.big)} ÷ ${p.factor} = ${fmt(p.base)}`; break;
    default:
      ans = p.big; toks = [box, `÷ ${p.factor} = ${fmt(p.base)}`]; text = `${fmt(p.big)} ÷ ${p.factor} = ${fmt(p.base)}`;
  }
  // A base that ends in 0 can make the factor ambiguous (e.g. 30 × ? = 3,000 → 100, fine; but 300 × ? = 3,000 → 10).
  // Factor questions are always uniquely solvable because base × f = big has exactly one solution f.
  const interaction = { type: 'fields' as const, tokens: toks };
  return makeQuestion({
    topicId: ID, kind: 'missing', tier,
    story: 'A smudge of soot covered one number in the recipe book.',
    prompt: 'Find the missing number.',
    interaction,
    expected: { a: String(ans) },
    check(a: Answer) {
      return judgeNumber((a as Record<string, string>).a, ans, { high: 'Too big — try that in the number sentence.', low: 'Too small — try that in the number sentence.' });
    },
    hint: form.startsWith('factor') ? 'How many places did the digits move? One place = 10, two places = 100.' : form === 'bigDiv' ? 'Undo it: multiply instead of dividing.' : 'Undo it: divide instead of multiplying.',
    worked: [text],
    answerText: fmt(ans),
    sig: [form, p.base, p.factor],
    wrongExample: { a: String(ans + 1) },
  });
}

function genStory(rng: Rng, tier: Tier): Question {
  const p = genPair(rng, tier);
  const contexts = p.times
    ? [
        { s: `Each bag holds ${p.factor} marshmallows.`, q: `How many marshmallows are in ${fmt(p.base)} bags?` },
        { s: `A box of matches holds ${p.factor} matches.`, q: `How many matches in ${fmt(p.base)} boxes?` },
        { s: `Each log pile has ${fmt(p.base)} logs.`, q: `How many logs in ${p.factor} piles?` },
      ]
    : [
        { s: `${fmt(p.big)} acorns are shared equally into ${p.factor} tins.`, q: 'How many acorns go in each tin?' },
        { s: `${fmt(p.big)} pinecones are packed in bags of ${p.factor}.`, q: 'How many bags are needed?' },
      ];
  const c = rng.pick(contexts);
  const ans = p.times ? p.big : p.base;
  const f = oneNumber(ans, { extraCheck: (x) => placesMsg(x, ans, p.factor, p.times) });
  return makeQuestion({
    topicId: ID, kind: 'story', tier,
    story: c.s,
    prompt: c.q,
    ...f,
    hint: p.times ? `This is a × ${p.factor} question.` : `This is a ÷ ${p.factor} question.`,
    worked: workedFor(p),
    answerText: fmt(ans),
    sig: [c.s, p.base, p.factor],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  slide: genSlide,
  typed: genTyped,
  missing: genMissing,
  story: genStory,
};

export const topic14: TopicModule = {
  id: ID,
  title: 'Multiply and divide by 10 or 100',
  job: 'Cook in the camp kitchen',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { slide: [4, 3, 2], typed: [3, 3, 2], missing: [1, 2, 4], story: [2, 2, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};
