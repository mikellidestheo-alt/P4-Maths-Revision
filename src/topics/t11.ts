import { T11, type Tier } from '../config/difficulty';
import { makeQuestion, manyNumbers, numberFallback, oneNumber, br } from '../engine/build';
import { fmt, toWords, PLACE_NAMES } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Question, Token, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.1';

/** A number in the tier's range; tier 3 often has tricky zeros. */
export function genBig(rng: Rng, tier: Tier): number {
  if (tier === 3) {
    if (rng.chance(0.06)) return 1_000_000;
    let digits = String(rng.int(T11.min[3], 999_999)).split('');
    if (rng.chance(T11.trickyZeroChance)) {
      // put 2 or 3 zeros into positions 1..5 (never the first digit)
      const positions = rng.shuffle([1, 2, 3, 4, 5]).slice(0, rng.int(2, 3));
      for (const p of positions) digits[p] = '0';
    }
    return Number(digits.join(''));
  }
  return rng.int(T11.min[tier], T11.max[tier]);
}

function columnsFor(n: number, tier: Tier) {
  return Math.max(tier === 1 ? 5 : tier === 2 ? 6 : 7, String(n).length);
}

function placeOf(n: number, p: number) {
  return Math.floor(n / 10 ** p) % 10;
}

function genBuild(rng: Rng, tier: Tier): Question {
  const n = genBig(rng, tier);
  const cols = columnsFor(n, tier);
  const s = String(n);
  const expected = '_'.repeat(cols - s.length) + s;
  return makeQuestion({
    topicId: ID, kind: 'build', tier,
    story: 'A supply crate needs a new label. The old one is written in words.',
    prompt: `Build this number in the chart: “${toWords(n)}”.`,
    interaction: { type: 'placeValue', columns: cols },
    expected,
    check(a: Answer) {
      const raw = String(a).replace(/^[_0]+(?=.)/, '');
      if (raw === '' || raw === '_' ) return { correct: false, feedback: 'Drag some digit tiles into the chart.' };
      if (raw.includes('_')) return { correct: false, feedback: 'There’s a gap in the label! An empty column between digits needs a 0.' };
      const v = Number(raw);
      if (v === n) return { correct: true };
      for (let p = Math.max(raw.length, s.length) - 1; p >= 0; p--) {
        if (placeOf(v, p) !== placeOf(n, p)) return { correct: false, feedback: `The label doesn’t match yet. Check the ${PLACE_NAMES[p]} column.` };
      }
      return { correct: false, feedback: 'The label doesn’t match yet.' };
    },
    hint: 'Read it in two parts: the thousands part, then the rest. Fill any empty column with 0.',
    worked: [
      `“${toWords(n)}”`,
      n >= 1000 ? `Thousands part: ${fmt(Math.floor(n / 1000))} thousand. The rest: ${fmt(n % 1000)}.` : `It is ${fmt(n)}.`,
      `So the number is ${fmt(n)}.`,
    ],
    answerText: fmt(n),
    sig: n,
    fallback: numberFallback(String(n), 'Type the number instead'),
    wrongExample: '_'.repeat(cols - String(n === 1_000_000 ? 999_999 : n + 1).length) + String(n === 1_000_000 ? 999_999 : n + 1),
  });
}

function genWords(rng: Rng, tier: Tier): Question {
  const n = genBig(rng, tier);
  const f = oneNumber(n, { fb: { high: 'Too big — check each part of the label.', low: 'Too small — check each part of the label.' } });
  return makeQuestion({
    topicId: ID, kind: 'words', tier,
    story: 'Bramble’s map has a number written in words.',
    prompt: `Type it as a number: “${toWords(n)}”.`,
    ...f,
    hint: 'Write the thousands part first, then the hundreds, tens and ones. Use 0 for any empty place.',
    worked: [`“${toWords(n)}”`, n >= 1000 ? `= ${fmt(Math.floor(n / 1000))} thousand and ${fmt(n % 1000)}` : '', `= ${fmt(n)}`].filter(Boolean),
    answerText: fmt(n),
    sig: n,
  });
}

function genDigitValue(rng: Rng, tier: Tier): Question {
  // need a digit that appears exactly once and is not zero
  let n = 0, p = 0, d = 0;
  for (let tries = 0; tries < 200; tries++) {
    n = genBig(rng, tier === 3 ? 2 : tier);
    if (tier === 3) n = rng.int(100_000, 999_999);
    const s = String(n);
    const candidates: number[] = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== '0' && s.split(ch).length === 2) candidates.push(s.length - 1 - i);
    }
    const minPlace = tier === 1 ? 0 : 1;
    const ok = candidates.filter((c) => c >= minPlace);
    if (ok.length) {
      p = rng.pick(ok);
      d = placeOf(n, p);
      break;
    }
  }
  const value = d * 10 ** p;
  const f = oneNumber(value, {
    extraCheck: (x) => {
      if (x === d && p > 0) return { correct: false, feedback: `${d} is the digit. What is it worth in its column?` };
      for (let q = 0; q <= 6; q++) if (x === d * 10 ** q) return { correct: false, feedback: `Nearly! Check which column the ${d} is in.` };
      return null;
    },
  });
  return makeQuestion({
    topicId: ID, kind: 'digitValue', tier,
    story: 'Count the coins in the camp money jar.',
    prompt: `What is the ${d} worth in ${fmt(n)}?`,
    ...f,
    interaction: { ...f.interaction, visual: { kind: 'placeValue', value: n, columns: Math.max(String(n).length, 5) } },
    hint: 'Find the column the digit sits in: ones, tens, hundreds, thousands…',
    worked: [`In ${fmt(n)} the ${d} is in the ${PLACE_NAMES[p]} column.`, `So it is worth ${fmt(value)}.`],
    answerText: fmt(value),
    sig: [n, p],
  });
}

function genPartition(rng: Rng, tier: Tier): Question {
  let n = 0, parts: number[] = [];
  for (let tries = 0; tries < 200; tries++) {
    n = tier === 3 ? genBig(rng, 3) : genBig(rng, tier);
    if (n === 1_000_000) continue;
    parts = [];
    const s = String(n);
    for (let i = 0; i < s.length; i++) if (s[i] !== '0') parts.push(Number(s[i]) * 10 ** (s.length - 1 - i));
    if (parts.length >= 3) break;
  }
  const blanksCount = tier === 1 ? 1 : 2;
  const blankIdx = rng.shuffle(parts.map((_, i) => i)).slice(0, blanksCount).sort((a, b) => a - b);
  const tokens: Token[] = [`${fmt(n)} =`, br];
  const expected: Record<string, number> = {};
  const names: Record<string, string> = {};
  parts.forEach((v, i) => {
    if (i > 0) tokens.push('+');
    if (blankIdx.includes(i)) {
      const id = `p${i}`;
      tokens.push({ kind: 'number', id, label: `part ${i + 1}` });
      expected[id] = v;
      names[id] = `the ${PLACE_NAMES[String(v).length - 1]} part`;
    } else tokens.push(fmt(v));
  });
  const f = manyNumbers(expected, tokens, { names, wrongMsg: 'The pieces don’t add up to the crate label yet.' });
  return makeQuestion({
    topicId: ID, kind: 'partition', tier,
    story: 'Split a big delivery into smaller crates.',
    prompt: 'Split the number by place value. Fill in the missing parts.',
    ...f,
    hint: 'Each part is one digit followed by zeros — one part for each column.',
    worked: [`${fmt(n)} = ${parts.map(fmt).join(' + ')}`],
    answerText: parts.filter((_, i) => blankIdx.includes(i)).map(fmt).join(' and '),
    sig: [n, blankIdx],
  });
}

function genMore(rng: Rng, tier: Tier): Question {
  const step = rng.pick(T11.moreLessSteps[tier]);
  const more = rng.chance(0.55);
  let n = 0;
  for (let tries = 0; tries < 200; tries++) {
    n = genBig(rng, tier);
    if (n === 1_000_000 && more) continue;
    const p = Math.round(Math.log10(step));
    if (rng.chance(0.6)) {
      // make it cross a boundary: digit at the step's place is 9 (more) or 0 (less)
      const d = placeOf(n, p);
      n += ((more ? 9 : 0) - d) * step;
    }
    const r = more ? n + step : n - step;
    if (n >= 0 && r >= 0 && r <= 1_000_000 && n <= 1_000_000 && n >= step) break;
  }
  const r = more ? n + step : n - step;
  const f = oneNumber(r, { fb: { high: 'Too many — count again.', low: 'Too few — count again.' } });
  return makeQuestion({
    topicId: ID, kind: 'more', tier,
    story: more ? 'More crates have arrived at camp.' : 'Some crates were carried to the tents.',
    prompt: `What is ${fmt(step)} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
    ...f,
    hint: `Look at the ${PLACE_NAMES[Math.round(Math.log10(step))]} column. If it goes ${more ? 'past 9' : 'below 0'}, the next column changes too.`,
    worked: [`${fmt(n)} ${more ? '+' : '−'} ${fmt(step)} = ${fmt(r)}`],
    answerText: fmt(r),
    sig: [n, step, more],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  build: genBuild,
  words: genWords,
  digitValue: genDigitValue,
  partition: genPartition,
  more: genMore,
};

export const topic11: TopicModule = {
  id: ID,
  title: 'Numbers to one million',
  job: 'Label the supply crates',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, {
      build: [3, 3, 3],
      words: [2, 2, 2],
      digitValue: [2, 2, 1],
      partition: [2, 2, 2],
      more: [1, 2, 3],
    }, tier);
    return GENS[kind](rng, tier);
  },
};

