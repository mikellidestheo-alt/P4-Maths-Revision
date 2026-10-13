import { T25, type Tier } from '../config/difficulty';
import { coordsFallback, fmtPt, makeQuestion, oneNumber } from '../engine/build';
import { inGrid, isRightTriangle, triangleSides } from '../engine/geometry';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Point, Question, TopicModule, Visual } from '../engine/types';
import { pickKind } from './common';

const ID = '2.5';
type Rule = 'right' | 'isosceles' | 'scalene' | 'rightIsosceles';
const RULE_TEXT: Record<Rule, string> = {
  right: 'a right-angled triangle',
  isosceles: 'an isosceles triangle',
  scalene: 'a scalene triangle',
  rightIsosceles: 'a right-angled isosceles triangle',
};

function meets(rule: Rule, t: Point[]): boolean {
  const [a, b, c] = t;
  const s = triangleSides(a, b, c);
  if (s === 'none') return false;
  switch (rule) {
    case 'right': return isRightTriangle(a, b, c);
    case 'isosceles': return s === 'isosceles' || s === 'equilateral';
    case 'scalene': return s === 'scalene';
    case 'rightIsosceles': return isRightTriangle(a, b, c) && s === 'isosceles';
  }
}

function genBuild(rng: Rng, tier: Tier): Question {
  const n = T25.gridSize;
  const rules: Rule[] = tier === 1 ? ['right', 'isosceles'] : tier === 2 ? ['right', 'isosceles', 'scalene'] : ['rightIsosceles', 'scalene', 'isosceles', 'right'];
  const rule = rng.pick(rules);
  // starting triangle that does NOT meet the rule
  let start: Point[];
  for (;;) {
    start = [[rng.int(0, 3), rng.int(0, 3)], [rng.int(4, n), rng.int(0, 3)], [rng.int(1, n - 1), rng.int(5, n)]];
    if (triangleSides(start[0], start[1], start[2]) !== 'none' && !meets(rule, start)) break;
  }
  // a canonical answer: move corner C (or B for scalene) to make it work
  let expected: Point[] | null = null;
  for (let tries = 0; tries < 2000 && !expected; tries++) {
    const c: Point = [rng.int(0, n), rng.int(0, n)];
    const cand = [start[0], start[1], c];
    if (meets(rule, cand)) expected = cand;
  }
  if (!expected) return genBuild(rng, tier);
  const exp = expected;
  return makeQuestion({
    topicId: ID, kind: 'build', tier,
    story: 'Pitch a tent! The tent ropes make a triangle.',
    prompt: `Drag the corners to make ${RULE_TEXT[rule]}.`,
    interaction: { type: 'grid', w: n, h: n, axes: true, mode: 'triangle', initial: start, drawings: [] },
    expected: exp,
    check(a: Answer) {
      const t = a as Point[];
      if (!Array.isArray(t) || t.length !== 3 || !t.every((p) => inGrid(p, n, n))) return { correct: false, feedback: 'Use all three corners on the grid.' };
      const s = triangleSides(t[0], t[1], t[2]);
      if (s === 'none') return { correct: false, feedback: 'The tent has gone flat! The three corners can’t be in a straight line.' };
      if (meets(rule, t)) return { correct: true };
      const right = isRightTriangle(t[0], t[1], t[2]);
      switch (rule) {
        case 'right': return { correct: false, feedback: 'The tent needs one square corner — a right angle.' };
        case 'isosceles': return { correct: false, feedback: 'The tent is lopsided. An isosceles triangle has two sides the same length.' };
        case 'scalene': return { correct: false, feedback: `That has ${s === 'equilateral' ? 'all' : 'two'} sides the same. A scalene triangle has all sides different.` };
        case 'rightIsosceles': return { correct: false, feedback: right ? 'It has a right angle! Now make the two sides next to it the same length.' : s === 'isosceles' ? 'Two sides match! Now it needs a right angle too.' : 'It needs a right angle AND two equal sides.' };
      }
    },
    hint: rule === 'right' ? 'Make one side go straight across and another go straight up from the same corner.'
      : rule === 'isosceles' ? 'Put the top corner exactly in the middle, above the bottom side.'
      : rule === 'scalene' ? 'Make all three sides different lengths — try a wonky shape!'
      : 'Go straight across and straight up from one corner by the same number of squares.',
    worked: [`One way: corners at ${exp.map(fmtPt).join(', ')}.`, rule === 'scalene' ? 'All three sides are different lengths.' : rule === 'isosceles' ? 'Two sides are the same length.' : 'There is a right angle.'],
    answerText: `${RULE_TEXT[rule]}, e.g. ${exp.map(fmtPt).join(' ')}`,
    sig: [start, rule],
    fallback: coordsFallback(exp, 'Type the corners instead', ['A:', 'B:', 'C:']),
    wrongExample: start,
  });
}

/** Triangles described by side lengths (drawn roughly to shape). */
function sideSet(kind: 'equilateral' | 'isosceles' | 'scalene', rng: Rng): number[] {
  for (;;) {
    const a = rng.int(3, 12);
    let s: number[];
    if (kind === 'equilateral') s = [a, a, a];
    else if (kind === 'isosceles') { const b = rng.int(2, 2 * a - 1); if (b === a) continue; s = rng.shuffle([a, a, b]); }
    else { const b = rng.int(3, 12), c = rng.int(3, 12); if (a === b || b === c || a === c) continue; s = [a, b, c]; }
    const [x, y, z] = s.slice().sort((p, q) => p - q);
    if (x + y > z) return s;
  }
}

/** Coordinates for a triangle with given side lengths (a = base). */
function layout(s: number[]): Point[] {
  const [a, b, c] = s; // base a from (0,0) to (a,0); side b from (a,0); side c from (0,0)
  const x = (c * c - b * b + a * a) / (2 * a);
  const y = Math.sqrt(Math.max(0.01, c * c - x * x));
  return [[0, 0], [a, 0], [x, y]];
}

function triVisual(s: number[], labels = true): Visual {
  const pts = layout(s);
  // side order in visual: AB (base) = s[0], BC = s[1], CA = s[2]
  const ticks = s.map((v) => s.filter((w) => w === v).length > 1 ? (s.indexOf(v) === s.lastIndexOf(v) ? 0 : 1) : 0);
  return { kind: 'shape', pts, sideLabels: labels ? s.map((v) => `${v} cm`) : undefined, ticks: labels ? undefined : ticks };
}

function genClassify(rng: Rng, tier: Tier): Question {
  const kind = rng.pick(['equilateral', 'isosceles', 'scalene'] as const);
  const s = sideSet(kind, rng);
  return makeQuestion({
    topicId: ID, kind: 'classify', tier,
    story: 'Lumi measured the sides of a tent.',
    prompt: 'What type of triangle is it?',
    interaction: {
      type: 'choice', visual: triVisual(s),
      options: [{ id: 'equilateral', label: 'Equilateral' }, { id: 'isosceles', label: 'Isosceles' }, { id: 'scalene', label: 'Scalene' }],
    },
    expected: kind,
    check: (a) => (a === kind ? { correct: true } : { correct: false, feedback: 'Look at the side lengths. How many are the same?' }),
    hint: 'Equilateral: all 3 sides the same. Isosceles: 2 the same. Scalene: none the same.',
    worked: [`The sides are ${s.join(' cm, ')} cm.`, kind === 'equilateral' ? 'All three are equal → equilateral.' : kind === 'isosceles' ? 'Two are equal → isosceles.' : 'All different → scalene.'],
    answerText: kind,
    sig: [s],
    isChoice: true,
    wrongExample: kind === 'scalene' ? 'isosceles' : 'scalene',
  });
}

function genSort(rng: Rng, tier: Tier): Question {
  const byAngle = tier >= 2 && rng.chance(0.4);
  type Item = { id: string; label: string; visual: Visual; bin: string };
  let items: Item[];
  let bins: { id: string; label: string }[];
  if (byAngle) {
    bins = [{ id: 'right', label: 'Right-angled' }, { id: 'notright', label: 'Not right-angled' }];
    const tris: { pts: Point[]; right: boolean }[] = [
      { pts: [[0, 0], [4, 0], [0, 3]], right: true },
      { pts: [[0, 0], [5, 0], [5, 2]], right: true },
      { pts: [[0, 0], [4, 0], [2, 4]], right: false },
      { pts: [[0, 0], [5, 0], [1, 3]], right: false },
      { pts: [[0, 0], [3, 0], [0, 4]], right: true },
      { pts: [[0, 0], [6, 0], [4, 2]], right: false },
      { pts: [[0, 0], [4, 0], [6, 3]], right: false },
      { pts: [[0, 0], [3, 3], [6, 0]], right: true },
    ];
    const chosen = rng.shuffle(tris).slice(0, 4);
    if (!chosen.some((t) => t.right)) chosen[0] = tris[0];
    if (chosen.every((t) => t.right)) chosen[3] = tris[2];
    items = chosen.map((t, i) => {
      const ra = t.pts.findIndex((_, k) => {
        const p = t.pts[k], q = t.pts[(k + 1) % 3], r = t.pts[(k + 2) % 3];
        return (q[0] - p[0]) * (r[0] - p[0]) + (q[1] - p[1]) * (r[1] - p[1]) === 0;
      });
      return { id: `t${i}`, label: `Tent ${i + 1}`, visual: { kind: 'shape', pts: t.pts, rightAngles: ra >= 0 ? [ra] : [] }, bin: t.right ? 'right' : 'notright' };
    });
  } else {
    bins = [{ id: 'equilateral', label: 'Equilateral' }, { id: 'isosceles', label: 'Isosceles' }, { id: 'scalene', label: 'Scalene' }];
    type K = 'equilateral' | 'isosceles' | 'scalene';
    const kinds = rng.shuffle<K>(['equilateral', 'isosceles', 'scalene', rng.pick<K>(['isosceles', 'scalene'])]);
    items = kinds.map((k, i) => ({ id: `t${i}`, label: `Tent ${i + 1}`, visual: triVisual(sideSet(k, rng)), bin: k }));
  }
  const expected: Record<string, string> = {};
  for (const it of items) expected[it.id] = it.bin;
  return makeQuestion({
    topicId: ID, kind: 'sort', tier,
    story: 'Sort the tents into the right camp areas.',
    prompt: 'Put each tent in the right group.',
    interaction: { type: 'bins', items: items.map(({ id, label, visual }) => ({ id, label, visual })), bins },
    expected,
    check(a: Answer) {
      const r = a as Record<string, string>;
      const missing = items.filter((it) => !r[it.id]);
      if (missing.length) return { correct: false, feedback: 'Put every tent in a group.' };
      const wrong = items.filter((it) => r[it.id] !== it.bin);
      if (!wrong.length) return { correct: true };
      return { correct: false, feedback: `${wrong[0].label} is in the wrong group. ${byAngle ? 'Look for the square corner mark.' : 'Count the equal sides.'}` };
    },
    hint: byAngle ? 'A right angle is marked with a little square.' : 'Equilateral: 3 equal sides. Isosceles: 2 equal. Scalene: none equal.',
    worked: items.map((it) => `${it.label}: ${bins.find((b) => b.id === it.bin)!.label}`),
    answerText: items.map((it) => `${it.label} → ${bins.find((b) => b.id === it.bin)!.label}`).join('; '),
    sig: [items.map((it) => [it.bin, JSON.stringify(it.visual)])],
    wrongExample: Object.fromEntries(items.map((it) => [it.id, bins.find((b) => b.id !== it.bin)!.id])),
  });
}

function genSideFact(rng: Rng, tier: Tier): Question {
  const form = rng.pick(tier === 1 ? ['eqPerim', 'eqSide'] : ['eqSide', 'isoThird', 'isoPerim']);
  let prompt: string, ans: number, worked: string[], hint: string;
  if (form === 'eqPerim') {
    const s = rng.int(3, 12);
    ans = 3 * s; prompt = `An equilateral tent has sides of ${s} m. What is the perimeter (the distance all the way round)?`;
    worked = [`All three sides are ${s} m.`, `${s} + ${s} + ${s} = ${ans} m`]; hint = 'Equilateral means all three sides are the same.';
  } else if (form === 'eqSide') {
    const s = rng.int(3, 15);
    ans = s; prompt = `An equilateral tent has a perimeter of ${3 * s} m. How long is each side?`;
    worked = [`3 equal sides make ${3 * s} m.`, `${3 * s} ÷ 3 = ${s} m`]; hint = 'Equilateral means 3 equal sides. Share the perimeter by 3.';
  } else if (form === 'isoThird') {
    let a = 0, b = 0;
    for (;;) { a = rng.int(4, 15); b = rng.int(2, 2 * a - 1); if (b !== a && b <= T25.sideMax) break; }
    ans = b; prompt = `An isosceles tent has two sides of ${a} m. Its perimeter is ${2 * a + b} m. How long is the third side?`;
    worked = [`${a} + ${a} = ${2 * a}`, `${2 * a + b} − ${2 * a} = ${b} m`]; hint = 'Add the two equal sides, then take that away from the perimeter.';
  } else {
    let a = 0, b = 0;
    for (;;) { a = rng.int(4, 15); b = rng.int(2, 2 * a - 1); if (b !== a) break; }
    ans = 2 * a + b; prompt = `An isosceles tent has sides of ${a} m, ${a} m and ${b} m. What is its perimeter?`;
    worked = [`${a} + ${a} + ${b} = ${ans} m`]; hint = 'Add all three sides.';
  }
  const f = oneNumber(ans, { after: ['m'], fb: { high: 'Too long — the rope would trail on the ground.', low: 'Too short — the rope won’t reach.' } });
  return makeQuestion({
    topicId: ID, kind: 'sideFact', tier,
    story: 'Measure the rope for the tent.',
    prompt,
    ...f,
    hint,
    worked,
    answerText: `${ans} m`,
    sig: [prompt],
  });
}

function genAngle(rng: Rng, tier: Tier): Question {
  const form = rng.pick(tier < 3 ? ['equi', 'right'] : ['two', 'right', 'iso', 'equi']);
  let prompt: string, ans: number, worked: string[];
  if (form === 'two') {
    const a = rng.int(3, 12) * 5, b = rng.int(3, 18) * 5;
    if (a + b >= 170) return genAngle(rng, tier);
    ans = 180 - a - b; prompt = `Two angles of a triangle are ${a}° and ${b}°. What is the third angle?`;
    worked = [`${a} + ${b} = ${a + b}`, `180 − ${a + b} = ${ans}°`];
  } else if (form === 'right') {
    const a = rng.int(2, 16) * 5;
    ans = 90 - a; prompt = `A right-angled triangle has an angle of ${a}°. What is the third angle?`;
    worked = ['A right angle is 90°.', `90 + ${a} = ${90 + a}`, `180 − ${90 + a} = ${ans}°`];
  } else if (form === 'iso') {
    const top = rng.int(2, 16) * 10;
    ans = (180 - top) / 2; prompt = `An isosceles triangle has a top angle of ${top}°. The two other angles are equal. What is each of them?`;
    worked = [`180 − ${top} = ${180 - top}`, `${180 - top} ÷ 2 = ${ans}°`];
  } else {
    ans = 60; prompt = 'All the angles of an equilateral triangle are the same. How big is each one?';
    worked = ['The angles add up to 180°.', '180 ÷ 3 = 60°'];
  }
  const f = oneNumber(ans, { after: ['°'], fb: { high: 'Too big — the angles would add up to more than 180°.', low: 'Too small — the angles would add up to less than 180°.' } });
  return makeQuestion({
    topicId: ID, kind: 'angle', tier,
    story: 'Lumi is checking the corners of the tent.',
    prompt,
    ...f,
    hint: 'The three angles inside a triangle always add up to 180°.',
    worked,
    answerText: `${ans}°`,
    sig: [prompt],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  build: genBuild,
  classify: genClassify,
  sort: genSort,
  sideFact: genSideFact,
  angle: genAngle,
};

export const topic25: TopicModule = {
  id: ID,
  title: 'Types of triangles',
  job: 'Pitch the tents',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const angleW = T25.includeAngleSum ? 3 : 0;
    const kind = pickKind(rng, ctx, { build: [4, 4, 3], classify: [2, 2, 1], sort: [2, 2, 2], sideFact: [2, 2, 2], angle: [0, 0, angleW] }, tier, ['classify']);
    if (kind === 'angle' && !T25.includeAngleSum) return GENS.sideFact(rng, tier);
    return GENS[kind](rng, tier);
  },
};
