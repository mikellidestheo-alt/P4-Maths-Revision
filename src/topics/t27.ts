import { T27, type Tier } from '../config/difficulty';
import { coordsFallback, fmtPt, makeQuestion, num, ptKey, samePoints } from '../engine/build';
import { parseNumber } from '../engine/answers';
import { inGrid, reflect } from '../engine/geometry';
import type { Rng } from '../engine/rng';
import type { Answer, GenContext, Point, Question, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '2.7';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Small shape templates (vertices in order). */
const TEMPLATES: Point[][] = [
  [[0, 0], [2, 0], [0, 2]],
  [[0, 0], [3, 0], [0, 2]],
  [[0, 0], [2, 0], [1, 3]],
  [[0, 0], [1, 2], [3, 1]],
  [[0, 0], [2, 0], [2, 2], [0, 2]],
  [[0, 0], [3, 0], [3, 2], [0, 2]],
  [[0, 0], [3, 0], [2, 2], [1, 2]],
  [[0, 0], [2, 0], [3, 2], [0, 2]],
  [[0, 0], [2, 0], [2, 1], [1, 3], [0, 1]],
  [[0, 1], [2, 0], [3, 2], [2, 3], [0, 3]],
];

function transform(t: Point[], rng: Rng): Point[] {
  const fx = rng.chance(0.5), fy = rng.chance(0.5), swap = rng.chance(0.5);
  const pts = t.map(([x, y]) => {
    let p: Point = swap ? [y, x] : [x, y];
    p = [fx ? -p[0] : p[0], fy ? -p[1] : p[1]];
    return p;
  });
  const mx = Math.min(...pts.map((p) => p[0])), my = Math.min(...pts.map((p) => p[1]));
  return pts.map((p) => [p[0] - mx, p[1] - my] as Point);
}

interface Setup { n: number; axis: 'x' | 'y'; k: number; shape: Point[]; image: Point[] }

function setup(rng: Rng, tier: Tier): Setup {
  const n = T27.gridSize[tier];
  const [vmin, vmax] = T27.vertices[tier];
  const pool = TEMPLATES.filter((t) => t.length >= vmin && t.length <= vmax);
  for (;;) {
    const shape0 = transform(rng.pick(pool), rng);
    const axis = rng.chance(0.5) ? 'x' : 'y';
    const k = rng.int(3, n - 3);
    const w = Math.max(...shape0.map((p) => p[0])), h = Math.max(...shape0.map((p) => p[1]));
    const gap = tier === 1 ? 1 : tier === 2 ? rng.int(1, 2) : rng.int(2, 3);
    const side = rng.chance(0.5) ? -1 : 1;
    let off: Point;
    if (axis === 'x') {
      const x0 = side < 0 ? k - gap - w : k + gap;
      off = [x0, rng.int(0, n - h)];
    } else {
      const y0 = side < 0 ? k - gap - h : k + gap;
      off = [rng.int(0, n - w), y0];
    }
    const shape = shape0.map((p) => [p[0] + off[0], p[1] + off[1]] as Point);
    const image = shape.map((p) => reflect(p, axis, k));
    if (shape.every((p) => inGrid(p, n, n)) && image.every((p) => inGrid(p, n, n))) return { n, axis, k, shape, image };
  }
}

function genReflectShape(rng: Rng, tier: Tier): Question {
  const { n, axis, k, shape, image } = setup(rng, tier);
  const labels = LETTERS.slice(0, shape.length);
  const lineName = axis === 'x' ? `x = ${k}` : `y = ${k}`;
  const imageKeys = new Set(image.map(ptKey));
  return makeQuestion({
    topicId: ID, kind: 'reflectShape', tier,
    story: 'Fix the broken bridge with the magic mirror.',
    prompt: `Reflect the shape in the mirror line${tier === 3 ? ` (${lineName})` : ''}. Tap where each corner lands.`,
    interaction: {
      type: 'grid', w: n, h: n, axes: true, mode: 'points', count: shape.length,
      drawings: [{ kind: 'mirror', axis, at: k }, { kind: 'polygon', pts: shape, colour: 'shape', vertexLabels: labels }],
    },
    expected: image,
    check(a: Answer) {
      const got = a as Point[];
      if (samePoints(got, image)) return { correct: true };
      if (got.length < image.length) return { correct: false, feedback: `Place all ${image.length} corners.` };
      const translated = shape.map((p) => (axis === 'x' ? [p[0] + 2 * (k - (Math.min(...shape.map((q) => q[0])) + Math.max(...shape.map((q) => q[0]))) / 2), p[1]] : [p[0], p[1] + 2 * (k - (Math.min(...shape.map((q) => q[1])) + Math.max(...shape.map((q) => q[1]))) / 2)]) as Point);
      if (samePoints(got, translated)) return { correct: false, feedback: 'You slid the shape across, but a reflection flips it — like a mirror! The corners nearest the mirror stay nearest.' };
      const bad = got.find((p) => !imageKeys.has(ptKey(p)));
      return { correct: false, feedback: bad ? `The bridge is wobbly — the corner at ${fmtPt(bad)} isn’t right. Each corner should be the same distance from the mirror on the other side.` : 'Check each corner again.' };
    },
    hint: `Count how many squares each corner is from the mirror line. The reflected corner is the same number of squares away on the other side.`,
    worked: shape.map((p, i) => `${labels[i]} ${fmtPt(p)} is ${Math.abs((axis === 'x' ? p[0] : p[1]) - k)} square${Math.abs((axis === 'x' ? p[0] : p[1]) - k) === 1 ? '' : 's'} from the mirror → ${labels[i]}′ ${fmtPt(image[i])}`),
    answerText: image.map((p, i) => `${labels[i]}′${fmtPt(p)}`).join(' '),
    sig: [shape, axis, k],
    fallback: coordsFallback(image, 'Type the new coordinates instead', labels.map((l) => `${l}′:`)),
    wrongExample: shape,
  });
}

function genReflectPoint(rng: Rng, tier: Tier): Question {
  const n = T27.gridSize[tier];
  for (;;) {
    const axis = rng.chance(0.5) ? 'x' : 'y';
    const k = rng.int(2, n - 2);
    const P: Point = [rng.int(0, n), rng.int(0, n)];
    const d = axis === 'x' ? P[0] - k : P[1] - k;
    if (d === 0) continue;
    const R = reflect(P, axis, k);
    if (!inGrid(R, n, n)) continue;
    const showGrid = tier < 3;
    return makeQuestion({
      topicId: ID, kind: 'reflectPoint', tier,
      story: 'A glowing pebble is reflected in the cave pool.',
      prompt: `Point A is at ${fmtPt(P)}. The mirror line is ${axis === 'x' ? `x = ${k}` : `y = ${k}`}. Where is the reflection of A?`,
      interaction: {
        type: 'fields', tokens: ['(', num('x', 'across'), ',', num('y', 'up'), ')'],
        visual: showGrid ? { kind: 'grid', w: n, h: n, axes: true, drawings: [{ kind: 'mirror', axis, at: k }, { kind: 'point', p: P, label: 'A', icon: 'star' }] } : undefined,
      },
      expected: { x: String(R[0]), y: String(R[1]) },
      check(a: Answer) {
        const r = a as Record<string, string>;
        const x = parseNumber(r.x ?? ''), y = parseNumber(r.y ?? '');
        if (x === null || y === null) return { correct: false, feedback: 'Fill in both numbers.' };
        if (x === R[0] && y === R[1]) return { correct: true };
        if (x === P[0] && y === P[1]) return { correct: false, feedback: 'That’s where A already is! The reflection is on the other side of the mirror.' };
        if (axis === 'x' && y !== P[1]) return { correct: false, feedback: 'The mirror line goes up and down, so the reflection stays at the same height: the second number doesn’t change.' };
        if (axis === 'y' && x !== P[0]) return { correct: false, feedback: 'The mirror line goes across, so the reflection stays at the same across number.' };
        return { correct: false, feedback: `A is ${Math.abs(d)} square${Math.abs(d) === 1 ? '' : 's'} from the mirror. Go the same distance on the other side.` };
      },
      hint: axis === 'x' ? `x = ${k} is a line going up and down through ${k} on the across axis.` : `y = ${k} is a line going across through ${k} on the up axis.`,
      worked: [`A is ${Math.abs(d)} from the mirror line.`, `Go ${Math.abs(d)} past the line on the other side: ${fmtPt(R)}.`],
      answerText: fmtPt(R),
      sig: [P, axis, k],
      wrongExample: { x: String(P[0]), y: String(P[1]) },
    });
  }
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  reflectShape: genReflectShape,
  reflectPoint: genReflectPoint,
};

export const topic27: TopicModule = {
  id: ID,
  title: 'Reflection',
  job: 'Fix the bridge in the mirror cave',
  unit: 2,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { reflectShape: [7, 6, 6], reflectPoint: [1, 3, 4] }, tier);
    return GENS[kind](rng, tier);
  },
};
