import { T17, type Tier } from '../config/difficulty';
import { coordsFallback, fmtPt, makeQuestion, oneNumber } from '../engine/build';
import { add, cross, dot, eq, inGrid, isConvex, isParallelDir, isPerpDir, onLine, parallelSidePairs, rightAngles, rot90, scale, sub } from '../engine/geometry';
import type { Rng } from '../engine/rng';
import type { Answer, Drawing, GenContext, Point, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.7';

function randPt(rng: Rng, n: number, margin = 0): Point {
  return [rng.int(margin, n - margin), rng.int(margin, n - margin)];
}

/** A segment with direction d (scaled k times) fully inside an n×n grid. */
function placeSegment(rng: Rng, n: number, d: Point, k: number): [Point, Point] {
  for (;;) {
    const a = randPt(rng, n);
    const b = add(a, scale(d, k));
    if (inGrid(b, n, n)) return [a, b];
  }
}

function findWrong(n: number, P: Point, ok: (q: Point) => boolean): Point {
  for (let x = 0; x <= n; x++) for (let y = 0; y <= n; y++) {
    const q: Point = [x, y];
    if (!eq(q, P) && !ok(q)) return q;
  }
  return P;
}

function genDrawLine(rng: Rng, tier: Tier): Question {
  const n = T17.gridSize[tier];
  const want = rng.chance(0.5) ? 'parallel' : 'perpendicular';
  for (;;) {
    const d = rng.pick(T17.directions[tier]) as Point;
    const k = Math.abs(d[0]) + Math.abs(d[1]) > 2 ? rng.int(1, 2) : rng.int(2, 4);
    const [A, B] = placeSegment(rng, n, d, k);
    const P = randPt(rng, n);
    if (onLine(P, A, d)) continue;
    const dir = want === 'parallel' ? d : rot90(d);
    // valid end points: P + m·dir for m ≠ 0 inside the grid
    const valid: Point[] = [];
    for (let m = -n; m <= n; m++) {
      if (m === 0) continue;
      const q = add(P, scale(dir, m));
      if (inGrid(q, n, n)) valid.push(q);
    }
    if (valid.length === 0) continue;
    // prefer a fence of sensible length for the canonical answer
    const Q = valid.slice().sort((x, y) => Math.abs(Math.abs(sub(x, P)[0]) + Math.abs(sub(x, P)[1]) - 3) - Math.abs(Math.abs(sub(y, P)[0]) + Math.abs(sub(y, P)[1]) - 3))[0];
    const drawings: Drawing[] = [
      { kind: 'segment', a: A, b: B, colour: 'fence', label: 'red fence' },
      { kind: 'point', p: P, icon: 'lantern', label: 'lantern' },
    ];
    const check = (ans: Answer) => {
      const pts = ans as Point[];
      const q = pts?.[pts.length - 1];
      if (!q) return { correct: false, feedback: 'Tap a dot to finish your fence.' };
      if (!inGrid(q, n, n)) return { correct: false, feedback: 'That point is off the map.' };
      if (eq(q, P)) return { correct: false, feedback: 'Your fence needs to be longer than that!' };
      const v = sub(q, P);
      if (want === 'parallel') {
        if (isParallelDir(v, d)) return { correct: true };
        if (isPerpDir(v, d)) return { correct: false, feedback: 'Your fence meets the red fence at a right angle — that’s perpendicular. Parallel fences go the same way and never meet.' };
        return { correct: false, feedback: 'The fences would bump into each other! Parallel fences point the same way, always the same distance apart.' };
      }
      if (isPerpDir(v, d)) return { correct: true };
      if (isParallelDir(v, d)) return { correct: false, feedback: 'Those fences go the same way — that’s parallel. Perpendicular fences cross at a right angle.' };
      return { correct: false, feedback: 'The corner isn’t square. Perpendicular fences make a right angle, like the corner of a book.' };
    };
    const across = d[0], up = d[1];
    return makeQuestion({
      topicId: ID, kind: 'drawLine', tier,
      story: want === 'parallel' ? 'Build a new fence that runs alongside the red fence.' : 'Build a path that crosses the red fence at a right angle.',
      prompt: `Start at the lantern. Draw a line ${want} to the red fence: tap where it should end.`,
      interaction: { type: 'grid', w: n, h: n, axes: true, mode: 'segment', fixed: P, drawings },
      expected: [Q],
      check,
      hint: want === 'parallel'
        ? `The red fence goes ${Math.abs(across)} across and ${Math.abs(up)} ${up >= 0 ? 'up' : 'down'} for each step. Make yours go the same way.`
        : 'Turn the red fence a quarter turn (a right angle) — that’s the way your line should go.',
      worked: [
        want === 'parallel' ? 'Parallel lines go in the same direction and never meet.' : 'Perpendicular lines meet at a right angle.',
        `One answer: from the lantern ${fmtPt(P)} to ${fmtPt(Q)}.`,
      ],
      answerText: `a line from ${fmtPt(P)} to ${fmtPt(Q)} (or any point along that direction)`,
      sig: [A, B, P, want],
      fallback: coordsFallback([Q], 'Type the end point instead', ['End point:']),
      wrongExample: [findWrong(n, P, (q) => check([q]).correct)],
    });
  }
}

const POOL: Point[] = [[1, 0], [0, 1], [1, 1], [1, -1], [1, 2], [2, 1], [1, -2], [2, -1], [1, 3], [3, -1]];

function genIdentify(rng: Rng, tier: Tier): Question {
  const n = 10;
  const pool = tier === 1 ? POOL.slice(0, 2) : tier === 2 ? POOL.slice(0, 4) : POOL;
  const d1 = rng.pick(pool);
  const rel = rng.pick(['parallel', 'perpendicular', 'neither'] as const);
  let d2: Point;
  if (rel === 'parallel') d2 = d1;
  else if (rel === 'perpendicular') d2 = rot90(d1);
  else {
    const others = POOL.filter((d) => !isParallelDir(d, d1) && !isPerpDir(d, d1));
    d2 = rng.pick(others);
  }
  let segs: [Point, Point][];
  for (;;) {
    const k1 = Math.abs(d1[0]) + Math.abs(d1[1]) > 2 ? 2 : 3;
    const k2 = Math.abs(d2[0]) + Math.abs(d2[1]) > 2 ? 2 : 3;
    const s1 = placeSegment(rng, n, d1, k1), s2 = placeSegment(rng, n, d2, k2);
    // keep them apart (and not on the same line)
    if (rel === 'parallel' && onLine(s2[0], s1[0], d1)) continue;
    const mid1 = [(s1[0][0] + s1[1][0]) / 2, (s1[0][1] + s1[1][1]) / 2], mid2 = [(s2[0][0] + s2[1][0]) / 2, (s2[0][1] + s2[1][1]) / 2];
    if (Math.hypot(mid1[0] - mid2[0], mid1[1] - mid2[1]) < 3) continue;
    segs = [s1, s2];
    break;
  }
  return makeQuestion({
    topicId: ID, kind: 'identify', tier,
    story: 'Two new paths have been laid in the forest.',
    prompt: 'Are the two paths parallel, perpendicular or neither?',
    interaction: {
      type: 'choice',
      visual: { kind: 'grid', w: n, h: n, axes: false, drawings: [
        { kind: 'segment', a: segs[0][0], b: segs[0][1], colour: 'path', label: 'path A' },
        { kind: 'segment', a: segs[1][0], b: segs[1][1], colour: 'fence', label: 'path B' },
      ] },
      options: [
        { id: 'parallel', label: 'Parallel' },
        { id: 'perpendicular', label: 'Perpendicular' },
        { id: 'neither', label: 'Neither' },
      ],
    },
    expected: rel,
    check(a: Answer) {
      if (a === rel) return { correct: true };
      return { correct: false, feedback: 'Imagine making the paths longer. Would they never meet (parallel), meet at a right angle (perpendicular), or meet at another angle?' };
    },
    hint: 'Count the squares each path goes across and up.',
    worked: [rel === 'parallel' ? 'The paths go the same way, so they are parallel.' : rel === 'perpendicular' ? 'The paths would meet at a right angle, so they are perpendicular.' : 'The paths would meet, but not at a right angle — neither.'],
    answerText: rel,
    sig: [segs, rel],
    isChoice: true,
    wrongExample: rel === 'parallel' ? 'neither' : 'parallel',
  });
}

/** Five lines in five slots, labelled a–e. */
function genTapPairs(rng: Rng, tier: Tier): Question {
  const pool = tier === 1 ? POOL.slice(0, 4) : POOL.slice(0, tier === 2 ? 6 : 10);
  const task = rng.chance(0.5) ? 'parallel' : 'perp';
  let dirs: Point[] = [];
  let answer: string[] = [];
  for (;;) {
    if (task === 'parallel') {
      // 4 distinct direction classes, one used twice
      const classes = rng.shuffle(pool).filter((d, i, arr) => arr.findIndex((e) => isParallelDir(e, d)) === i).slice(0, 4);
      if (classes.length < 4) continue;
      dirs = rng.shuffle([...classes, classes[0]]);
      const idx = dirs.map((d, i) => (isParallelDir(d, classes[0]) ? i : -1)).filter((i) => i >= 0);
      answer = idx.map((i) => 'abcde'[i]);
    } else {
      const ref = rng.pick(pool.slice(0, Math.max(2, pool.length)));
      const perp = rot90(ref);
      const others = rng.shuffle(pool.filter((d) => !isPerpDir(d, ref))).slice(0, 3);
      if (others.length < 3) continue;
      const rest = rng.shuffle([perp, ...others]);
      dirs = [ref, ...rest];
      answer = dirs.map((d, i) => (i > 0 && isPerpDir(d, ref) ? 'abcde'[i] : '')).filter(Boolean);
      if (answer.length !== 1) continue;
    }
    break;
  }
  // slots: 3 across top, 2 across bottom in a 12×8 box
  const slots: Point[] = [[2, 6], [6, 6], [10, 6], [4, 2], [8, 2]];
  const lines = dirs.map((d, i) => {
    const L = Math.hypot(d[0], d[1]);
    const half: Point = [(d[0] / L) * 1.6, (d[1] / L) * 1.6];
    const c = slots[i];
    return { id: 'abcde'[i], a: [c[0] - half[0], c[1] - half[1]] as Point, b: [c[0] + half[0], c[1] + half[1]] as Point, label: 'abcde'[i] };
  });
  const want = new Set(answer);
  return makeQuestion({
    topicId: ID, kind: 'tapPairs', tier,
    story: task === 'parallel' ? 'Two of these planks are parallel — they’ll make good shelf supports.' : 'Find the plank that will make a square corner with plank a.',
    prompt: task === 'parallel' ? 'Tap the two lines that are parallel.' : 'Tap the line that is perpendicular to line a.',
    interaction: { type: 'lineSelect', visual: { kind: 'lines', w: 12, h: 8, lines }, lines: lines.map(({ id, a, b }) => ({ id, a, b })) },
    expected: answer,
    check(a: Answer) {
      const got = new Set(a as string[]);
      if (got.size === want.size && [...want].every((x) => got.has(x))) return { correct: true };
      if (task === 'parallel' && got.size !== 2) return { correct: false, feedback: 'Choose exactly two lines.' };
      if (task === 'perp' && got.size !== 1) return { correct: false, feedback: 'Choose just one line.' };
      return { correct: false, feedback: task === 'parallel' ? 'Those two point in different directions. Parallel lines slope exactly the same way.' : 'That one doesn’t make a right angle with line a.' };
    },
    hint: task === 'parallel' ? 'Look for two lines that slope exactly the same way.' : 'Turn line a a quarter turn. Which line matches?',
    worked: [task === 'parallel' ? `Lines ${answer.join(' and ')} go the same direction, so they are parallel.` : `Line ${answer[0]} meets line a at a right angle (if you made them longer).`],
    answerText: `line${answer.length > 1 ? 's' : ''} ${answer.join(' and ')}`,
    sig: [dirs, task],
    wrongExample: task === 'parallel' ? ['a', 'b', 'c'] : ['a'],
  });
}

const SHAPES: { name: string; pts: Point[] }[] = [
  { name: 'rectangle', pts: [[0, 0], [5, 0], [5, 3], [0, 3]] },
  { name: 'square', pts: [[0, 0], [4, 0], [4, 4], [0, 4]] },
  { name: 'right trapezium', pts: [[0, 0], [5, 0], [3, 3], [0, 3]] },
  { name: 'parallelogram', pts: [[0, 0], [4, 0], [6, 3], [2, 3]] },
  { name: 'trapezium', pts: [[0, 0], [6, 0], [4, 3], [2, 3]] },
  { name: 'kite', pts: [[3, 0], [5, 4], [3, 6], [1, 4]] },
  { name: 'right-angled triangle', pts: [[0, 0], [5, 0], [0, 4]] },
  { name: 'quadrilateral', pts: [[0, 0], [5, 0], [6, 4], [1, 3]] },
  { name: 'tilted square', pts: [[2, 0], [5, 2], [3, 5], [0, 3]] },
  { name: 'tilted rectangle', pts: [[0, 2], [2, 0], [6, 4], [4, 6]] },
];

function genCount(rng: Rng, tier: Tier): Question {
  const pool = tier === 1 ? SHAPES.slice(0, 3) : tier === 2 ? SHAPES.slice(0, 7) : SHAPES;
  const s = rng.pick(pool);
  const askParallel = rng.chance(0.5) && s.pts.length === 4;
  const ans = askParallel ? parallelSidePairs(s.pts) : rightAngles(s.pts);
  // shift into the grid
  const off: Point = [rng.int(1, 2), rng.int(1, 2)];
  const pts = s.pts.map((p) => add(p, off));
  const f = oneNumber(ans, {
    fb: askParallel
      ? { high: 'Too many! A pair means two sides that never meet.', low: 'Look again — some sides go the same way.' }
      : { high: 'Too many. A right angle is a square corner.', low: 'Look again for square corners.' },
  });
  return makeQuestion({
    topicId: ID, kind: 'count', tier,
    story: 'Juniper drew the plan for a new fenced garden.',
    prompt: askParallel ? 'How many pairs of parallel sides does this shape have?' : 'How many right angles does this shape have? (Where do two sides meet perpendicularly?)',
    ...f,
    interaction: { ...f.interaction, visual: { kind: 'grid', w: 9, h: 8, axes: false, drawings: [{ kind: 'polygon', pts, colour: 'shape' }] } },
    hint: askParallel ? 'Check opposite sides. Do they go the same way?' : 'Check each corner. Is it a square corner like the corner of a page?',
    worked: [`This shape (a ${s.name}) has ${ans} ${askParallel ? (ans === 1 ? 'pair of parallel sides' : 'pairs of parallel sides') : ans === 1 ? 'right angle' : 'right angles'}.`],
    answerText: String(ans),
    sig: [s.name, askParallel, off],
  });
}

function genComplete(rng: Rng, tier: Tier): Question {
  const n = 10;
  for (;;) {
    const B = randPt(rng, n, 1);
    const u: Point = [rng.int(2, 5), tier === 3 ? rng.int(-1, 1) : 0];
    const v: Point = tier === 1 ? [0, rng.int(2, 4)] : [rng.int(-2, 2), rng.int(2, 4)];
    if (cross(u, v) === 0) continue;
    const A = add(B, v), C = add(B, u), D = add(add(B, u), v);
    const pts = [A, B, C, D];
    if (!pts.every((p) => inGrid(p, n, n)) || !isConvex([A, B, C, D])) continue;
    const isRect = dot(u, v) === 0;
    return makeQuestion({
      topicId: ID, kind: 'complete', tier,
      story: 'Three fence posts are in. Where does the last post go?',
      prompt: `Tap where post D goes so that ABCD has two pairs of parallel sides${isRect ? ' (a rectangle)' : ''}.`,
      interaction: { type: 'grid', w: n, h: n, axes: true, mode: 'point', drawings: [
        { kind: 'segment', a: A, b: B, colour: 'fence' },
        { kind: 'segment', a: B, b: C, colour: 'fence' },
        { kind: 'point', p: A, label: 'A', icon: 'dot' },
        { kind: 'point', p: B, label: 'B', icon: 'dot' },
        { kind: 'point', p: C, label: 'C', icon: 'dot' },
      ] },
      expected: [D],
      check(a: Answer) {
        const q = (a as Point[])[0];
        if (!q) return { correct: false, feedback: 'Tap a dot for post D.' };
        if (eq(q, D)) return { correct: true };
        return { correct: false, feedback: 'Side CD should be parallel to BA, and AD parallel to BC.' };
      },
      hint: `From C, go the same way as from B to A.`,
      worked: [`From B to A is ${v[0] === 0 ? '' : v[0] > 0 ? v[0] + ' right, ' : -v[0] + ' left, '}${v[1]} up.`, `Do the same from C: D is at ${fmtPt(D)}.`],
      answerText: fmtPt(D),
      sig: [A, B, C],
      fallback: coordsFallback([D], 'Type the coordinates instead', ['D:']),
      wrongExample: [add(D, [1, 0])].map((p) => (inGrid(p, n, n) ? p : add(D, [-1, 0]))),
    });
  }
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  drawLine: genDrawLine,
  identify: genIdentify,
  tapPairs: genTapPairs,
  count: genCount,
  complete: genComplete,
};

export const topic17: TopicModule = {
  id: ID,
  title: 'Parallel and perpendicular lines',
  job: 'Build fences and paths',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { drawLine: [4, 4, 4], identify: [2, 2, 1], tapPairs: [2, 2, 2], count: [2, 2, 2], complete: [0, 1, 2] }, tier, ['identify']);
    return GENS[kind](rng, tier);
  },
};
