import { T26, type Tier } from '../config/difficulty';
import { makeQuestion, oneNumber, ptKey, samePoints } from '../engine/build';
import { parseNumber } from '../engine/answers';
import { symmetryAxes } from '../engine/geometry';
import type { Rng } from '../engine/rng';
import type { Answer, Drawing, GenContext, Point, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '2.6';

function regular(n: number, r = 4): Point[] {
  // flat bottom for even, point at top for odd
  const start = n % 2 === 1 ? Math.PI / 2 : Math.PI / 2 + Math.PI / n;
  return Array.from({ length: n }, (_, i) => {
    const t = start + (2 * Math.PI * i) / n;
    return [round(r * Math.cos(t)), round(r * Math.sin(t))] as Point;
  });
}
const round = (x: number) => Math.round(x * 1e9) / 1e9;

export const SYM_SHAPES: { name: string; pts: Point[]; lines: number; tier: Tier }[] = [
  { name: 'square', pts: [[0, 0], [4, 0], [4, 4], [0, 4]], lines: 4, tier: 1 },
  { name: 'rectangle', pts: [[0, 0], [6, 0], [6, 3], [0, 3]], lines: 2, tier: 1 },
  { name: 'isosceles triangle', pts: [[0, 0], [4, 0], [2, 5]], lines: 1, tier: 1 },
  { name: 'equilateral triangle', pts: regular(3), lines: 3, tier: 1 },
  { name: 'scalene triangle', pts: [[0, 0], [6, 0], [1, 4]], lines: 0, tier: 2 },
  { name: 'right-angled isosceles triangle', pts: [[0, 0], [4, 0], [0, 4]], lines: 1, tier: 2 },
  { name: 'regular pentagon', pts: regular(5), lines: 5, tier: 2 },
  { name: 'regular hexagon', pts: regular(6), lines: 6, tier: 2 },
  { name: 'rhombus', pts: [[3, 0], [6, 4], [3, 8], [0, 4]], lines: 2, tier: 2 },
  { name: 'kite', pts: [[3, 0], [6, 5], [3, 7], [0, 5]], lines: 1, tier: 2 },
  { name: 'parallelogram', pts: [[0, 0], [5, 0], [7, 3], [2, 3]], lines: 0, tier: 3 },
  { name: 'isosceles trapezium', pts: [[0, 0], [6, 0], [4, 3], [2, 3]], lines: 1, tier: 3 },
  { name: 'right-angled trapezium', pts: [[0, 0], [5, 0], [3, 3], [0, 3]], lines: 0, tier: 3 },
  { name: 'regular octagon', pts: regular(8), lines: 8, tier: 3 },
  { name: 'right-angled triangle', pts: [[0, 0], [5, 0], [0, 3]], lines: 0, tier: 3 },
];

function shapesFor(tier: Tier) {
  return SYM_SHAPES.filter((s) => s.tier <= tier);
}

function genCount(rng: Rng, tier: Tier): Question {
  const s = rng.pick(shapesFor(tier));
  const ans = symmetryAxes(s.pts).length;
  const f = oneNumber(ans, { fb: { high: 'Too many — check each fold. Do both halves match exactly?', low: 'There are more ways to fold it so the halves match.' } });
  return makeQuestion({
    topicId: ID, kind: 'count', tier,
    story: 'Lumi wants a lantern window that matches on both sides.',
    prompt: `How many lines of symmetry does this ${s.name} have?`,
    ...f,
    interaction: { ...f.interaction, visual: { kind: 'shape', pts: s.pts } },
    hint: 'Imagine folding the shape. Each fold where both halves match exactly is a line of symmetry.',
    worked: [`${/^[aeiou]/.test(s.name) ? 'An' : 'A'} ${s.name} has ${ans} line${ans === 1 ? '' : 's'} of symmetry.`, s.name === 'rectangle' ? 'Careful: the diagonals of a rectangle are NOT lines of symmetry.' : s.name === 'parallelogram' ? 'A parallelogram has no lines of symmetry (fold it and the halves don’t match).' : ''].filter(Boolean),
    answerText: String(ans),
    sig: [s.name],
  });
}

/** Candidate fold lines through the centre of a shape; returns which are true axes. */
function candidateLines(pts: Point[], rng: Rng) {
  const axes = symmetryAxes(pts);
  const n = pts.length;
  const cx = pts.reduce((t, p) => t + p[0], 0) / n, cy = pts.reduce((t, p) => t + p[1], 0) / n;
  const angleOf = (d: Point) => ((Math.atan2(d[1], d[0]) * 180) / Math.PI + 180) % 180;
  const trueAngles = axes.map((a) => angleOf(a.d));
  const cands: { angle: number; ok: boolean }[] = trueAngles.map((a) => ({ angle: a, ok: true }));
  const distractors = rng.shuffle([0, 45, 90, 135, 30, 60, 120, 150]);
  // diagonals of the shape (vertex to opposite vertex through the centre) are good distractors
  for (const p of pts) distractors.unshift(angleOf([p[0] - cx, p[1] - cy]));
  for (const a of distractors) {
    if (cands.length >= Math.max(4, trueAngles.length + 1) || cands.length >= 6) break;
    if (cands.some((c) => Math.abs(c.angle - a) < 8 || Math.abs(Math.abs(c.angle - a) - 180) < 8)) continue;
    cands.push({ angle: a, ok: false });
  }
  const R = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) * 1.25;
  const shuffled = rng.shuffle(cands);
  return shuffled.map((c, i) => {
    const t = (c.angle * Math.PI) / 180;
    const dx = Math.cos(t) * R, dy = Math.sin(t) * R;
    return { id: `L${i}`, a: [round(cx - dx), round(cy - dy)] as Point, b: [round(cx + dx), round(cy + dy)] as Point, ok: c.ok };
  });
}

function genTapLines(rng: Rng, tier: Tier): Question {
  const pool = shapesFor(tier).filter((s) => s.lines <= 6);
  const s = rng.pick(pool);
  const lines = candidateLines(s.pts, rng);
  const want = lines.filter((l) => l.ok).map((l) => l.id);
  const count = want.length;
  return makeQuestion({
    topicId: ID, kind: 'tapLines', tier,
    story: 'Which fold lines make the two halves of the lantern match?',
    prompt: `Tap every line of symmetry on the ${s.name}. Tap again to undo. ${count === 0 ? '' : ''}`.trim(),
    interaction: { type: 'lineSelect', visual: { kind: 'shape', pts: s.pts, lines: lines.map((l) => ({ a: l.a, b: l.b, dashed: true })) }, lines: lines.map(({ id, a, b }) => ({ id, a, b })) },
    expected: want,
    check(a: Answer) {
      const got = a as string[];
      if (got.some((x) => x.startsWith('count:'))) {
        const n = Number(got[0].slice(6));
        return n === count ? { correct: true } : { correct: false, feedback: 'Count again: how many ways can you fold it so both halves match exactly?' };
      }
      const set = new Set(got);
      if (set.size === want.length && want.every((x) => set.has(x))) return { correct: true };
      const extra = got.filter((x) => !want.includes(x));
      if (extra.length) return { correct: false, feedback: s.name === 'rectangle' ? 'Careful! If you fold a rectangle along its diagonal, the halves don’t match.' : 'One of your lines doesn’t work: fold along it and the halves wouldn’t match.' };
      return { correct: false, feedback: count === 0 ? 'This shape has no lines of symmetry — don’t tap any.' : 'You’ve missed a line of symmetry.' };
    },
    hint: 'Imagine folding along each dotted line. Would one half land exactly on top of the other?',
    worked: [`The ${s.name} has ${count} line${count === 1 ? '' : 's'} of symmetry${count ? ' (shown in gold)' : ''}.`],
    answerText: `${count} line${count === 1 ? '' : 's'}`,
    sig: [s.name, lines.map((l) => l.id + l.ok)],
    fallback: {
      label: 'Type the number of lines instead',
      interaction: { type: 'fields', tokens: [{ kind: 'number', id: 'a', label: 'number of lines of symmetry' }, 'lines of symmetry'] },
      expected: { a: String(count) },
      toMain: (a) => {
        const n = parseNumber(a.a ?? '');
        return n === null ? null : [`count:${n}`];
      },
    },
    wrongExample: count === 0 ? [lines[0].id] : [],
  });
}

function genComplete(rng: Rng, tier: Tier): Question {
  const S = T26.patternSize[tier];
  const both = tier === 3 && rng.chance(0.4);
  const vertical = rng.chance(0.5);
  const half = S / 2;
  // pick given cells in the left (or bottom) half; for "both", in the bottom-left quarter
  const region = both ? { x0: 0, y0: 0, x1: half, y1: half } : vertical ? { x0: 0, y0: 0, x1: half, y1: S } : { x0: 0, y0: 0, x1: S, y1: half };
  const target = both ? rng.int(2, 3) : tier === 1 ? rng.int(3, 4) : rng.int(4, 6);
  const given = new Map<string, Point>();
  while (given.size < target) {
    const p: Point = [rng.int(region.x0, region.x1 - 1), rng.int(region.y0, region.y1 - 1)];
    given.set(ptKey(p), p);
  }
  const g = [...given.values()];
  const mirrorX = (p: Point): Point => [S - 1 - p[0], p[1]];
  const mirrorY = (p: Point): Point => [p[0], S - 1 - p[1]];
  let expected: Point[];
  if (both) expected = [...g.map(mirrorX), ...g.map(mirrorY), ...g.map((p) => mirrorX(mirrorY(p)))];
  else expected = g.map(vertical ? mirrorX : mirrorY);
  const drawings: Drawing[] = [{ kind: 'cells', cells: g, colour: 'gold' }];
  if (both || vertical) drawings.push({ kind: 'mirror', axis: 'x', at: half });
  if (both || !vertical) drawings.push({ kind: 'mirror', axis: 'y', at: half });
  const givenKeys = new Set(g.map(ptKey));
  return makeQuestion({
    topicId: ID, kind: 'complete', tier,
    story: 'Finish the stained-glass lantern so it is symmetrical.',
    prompt: both ? 'Shade squares so the pattern is symmetrical about BOTH mirror lines.' : 'Shade squares so the pattern is symmetrical about the mirror line.',
    interaction: {
      type: 'grid', w: S, h: S, axes: false, mode: 'cells', drawings,
      cellBounds: { x0: 0, y0: 0, x1: S, y1: S },
    },
    expected,
    check(a: Answer) {
      const got = (a as Point[]).filter((p) => !givenKeys.has(ptKey(p)));
      if (samePoints(got, expected)) return { correct: true };
      if (got.length === 0) return { correct: false, feedback: 'Tap squares on the other side of the mirror line to shade them.' };
      const exp = new Set(expected.map(ptKey));
      const extra = got.filter((p) => !exp.has(ptKey(p)));
      if (extra.length) return { correct: false, feedback: 'One shaded square has no partner. Each square should be the same distance from the mirror line on the other side.' };
      return { correct: false, feedback: `Nearly! ${expected.length - got.length} more square${expected.length - got.length === 1 ? '' : 's'} to shade.` };
    },
    hint: 'For each gold square, count how far it is from the mirror line. Shade the square the same distance away on the other side.',
    worked: ['Each square is reflected to the same distance on the other side of the mirror line.', 'The answer squares are shown in gold.'],
    answerText: `${expected.length} squares reflected in the mirror line${both ? 's' : ''}`,
    sig: [g, vertical, both],
    wrongExample: expected.slice(1),
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  count: genCount,
  tapLines: genTapLines,
  complete: genComplete,
};

export const topic26: TopicModule = {
  id: ID,
  title: 'Symmetry in shapes',
  job: 'Make mirror lanterns',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { count: [3, 3, 3], tapLines: [3, 3, 3], complete: [4, 4, 4] }, tier);
    return GENS[kind](rng, tier);
  },
};
