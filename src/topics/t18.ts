import { T18, type Tier } from '../config/difficulty';
import { coordsFallback, fmtPt, makeQuestion, num } from '../engine/build';
import { parseNumber } from '../engine/answers';
import { add, eq, inGrid } from '../engine/geometry';
import type { Rng } from '../engine/rng';
import type { Answer, CheckResult, GenContext, Point, Question, Token, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.8';
const ICONS = ['crate', 'tent', 'lantern', 'star', 'flag'] as const;
const ICON_NAMES: Record<string, string> = { crate: 'supply crate', tent: 'tent', lantern: 'lantern', star: 'star', flag: 'flag' };

function pt(rng: Rng, n: number, min = 0): Point {
  for (;;) {
    const p: Point = [rng.int(min, n), rng.int(min, n)];
    if (p[0] !== p[1] || rng.chance(0.15)) return p;
  }
}

function pointCheck(target: Point, got: Point | undefined): CheckResult {
  if (!got) return { correct: false, feedback: 'Choose a point.' };
  if (eq(got, target)) return { correct: true };
  if (got[0] === target[1] && got[1] === target[0]) return { correct: false, feedback: 'The numbers are swapped! Go along the corridor first (across), then up the stairs.' };
  if (got[0] === target[0]) return { correct: false, feedback: 'Across is right! Now check how far up.' };
  if (got[1] === target[1]) return { correct: false, feedback: 'Up is right! Now check how far across.' };
  return { correct: false, feedback: 'Not there. Start at 0, go across first, then up.' };
}

const xyFields = (labelX = 'across', labelY = 'up'): Token[] => ['(', num('x', labelX), ',', num('y', labelY), ')'];
const readXY = (a: Answer): Point | undefined => {
  const r = a as Record<string, string>;
  const x = parseNumber(r.x ?? ''), y = parseNumber(r.y ?? '');
  return x === null || y === null ? undefined : [x, y];
};

function genPlot(rng: Rng, tier: Tier): Question {
  const n = T18.gridSize[tier];
  const P = pt(rng, n, tier === 1 ? 1 : 0);
  const icon = rng.pick(ICONS);
  return makeQuestion({
    topicId: ID, kind: 'plot', tier,
    story: `A ${ICON_NAMES[icon]} is being dropped onto the camp map.`,
    prompt: `Tap the point ${fmtPt(P)} to place the ${ICON_NAMES[icon]}.`,
    interaction: { type: 'grid', w: n, h: n, axes: true, mode: 'point', drawings: [] },
    expected: [P],
    check: (a) => pointCheck(P, (a as Point[])[0]),
    hint: 'Along the corridor, then up the stairs: the first number is across, the second is up.',
    worked: [`Start at (0, 0). Go ${P[0]} across, then ${P[1]} up.`],
    answerText: fmtPt(P),
    sig: [P, n],
    wrongExample: [P[0] === P[1] ? [P[0] === 0 ? 1 : P[0] - 1, P[1]] : [P[1], P[0]]],
  });
}

function genRead(rng: Rng, tier: Tier): Question {
  const n = T18.gridSize[tier];
  const P = pt(rng, n, tier === 1 ? 1 : 0);
  const icon = rng.pick(ICONS);
  return makeQuestion({
    topicId: ID, kind: 'read', tier,
    story: `Juniper spotted a ${ICON_NAMES[icon]} on the map.`,
    prompt: `What are the coordinates of the ${ICON_NAMES[icon]}?`,
    interaction: { type: 'fields', tokens: xyFields(), visual: { kind: 'grid', w: n, h: n, axes: true, drawings: [{ kind: 'point', p: P, icon }] } },
    expected: { x: String(P[0]), y: String(P[1]) },
    check: (a) => {
      const g = readXY(a);
      return g ? pointCheck(P, g) : { correct: false, feedback: 'Fill in both numbers.' };
    },
    hint: 'Read across the bottom first, then up the side.',
    worked: [`The ${ICON_NAMES[icon]} is ${P[0]} across and ${P[1]} up, so it is at ${fmtPt(P)}.`],
    answerText: fmtPt(P),
    sig: [P, n],
    wrongExample: { x: String(P[1] === P[0] ? P[0] + 1 : P[1]), y: String(P[0]) },
  });
}

function genVertex(rng: Rng, tier: Tier): Question {
  const n = T18.gridSize[tier];
  for (;;) {
    const w = rng.int(2, Math.min(6, n - 1)), h = rng.int(2, Math.min(6, n - 1));
    const square = tier === 3 && rng.chance(0.5);
    const hh = square ? w : h;
    const x0 = rng.int(0, n - w), y0 = rng.int(0, n - hh);
    if (y0 + hh > n) continue;
    const corners: Point[] = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + hh], [x0, y0 + hh]];
    const missing = rng.int(0, 3);
    const D = corners[missing];
    const shown = corners.filter((_, i) => i !== missing);
    const labels = ['A', 'B', 'C'];
    const drawings = shown.map((p, i) => ({ kind: 'point' as const, p, label: labels[i], icon: 'dot' as const }));
    const typed = tier === 1 || (tier === 2 && rng.chance(0.6));
    const base = {
      topicId: ID, kind: 'vertex', tier,
      story: `Three corners of the ${square ? 'square' : 'rectangular'} camp garden are marked.`,
      hint: 'The missing corner lines up with one corner going across and another going up.',
      worked: [`It must line up across with one corner and up with another.`, `The fourth corner is ${fmtPt(D)}.`],
      answerText: fmtPt(D),
      sig: [corners, missing, typed],
    };
    if (typed) {
      return makeQuestion({
        ...base,
        prompt: `What are the coordinates of the fourth corner of the ${square ? 'square' : 'rectangle'}?`,
        interaction: { type: 'fields', tokens: xyFields(), visual: { kind: 'grid', w: n, h: n, axes: true, drawings } },
        expected: { x: String(D[0]), y: String(D[1]) },
        check: (a) => {
          const g = readXY(a);
          return g ? pointCheck(D, g) : { correct: false, feedback: 'Fill in both numbers.' };
        },
        wrongExample: { x: String(D[0] + 1), y: String(D[1]) },
      });
    }
    return makeQuestion({
      ...base,
      prompt: `Tap where the fourth corner of the ${square ? 'square' : 'rectangle'} goes.`,
      interaction: { type: 'grid', w: n, h: n, axes: true, mode: 'point', drawings },
      expected: [D],
      check: (a) => pointCheck(D, (a as Point[])[0]),
      fallback: coordsFallback([D], 'Type the coordinates instead'),
      wrongExample: [inGrid(add(D, [1, 1]), n, n) ? add(D, [1, 1]) : add(D, [-1, -1])],
    });
  }
}

function genMove(rng: Rng, tier: Tier): Question {
  const n = T18.gridSize[tier];
  for (;;) {
    const S = pt(rng, n);
    const dx = rng.int(1, 5) * (tier > 1 && rng.chance(0.4) ? -1 : 1);
    const dy = rng.int(1, 5) * (tier > 1 && rng.chance(0.4) ? -1 : 1);
    const E = add(S, [dx, dy]);
    if (!inGrid(E, n, n)) continue;
    const words = `${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'} and ${Math.abs(dy)} ${dy > 0 ? 'up' : 'down'}`;
    return makeQuestion({
      topicId: ID, kind: 'move', tier,
      story: 'Follow the treasure map instructions.',
      prompt: `Start at ${fmtPt(S)}. Move ${words}. Where are you now?`,
      interaction: { type: 'fields', tokens: xyFields(), visual: { kind: 'grid', w: n, h: n, axes: true, drawings: [{ kind: 'point', p: S, icon: 'flag', label: 'start' }] } },
      expected: { x: String(E[0]), y: String(E[1]) },
      check: (a) => {
        const g = readXY(a);
        if (!g) return { correct: false, feedback: 'Fill in both numbers.' };
        if (eq(g, E)) return { correct: true };
        if (eq(g, add(S, [-dx, -dy]))) return { correct: false, feedback: 'You went the opposite way! Right and up make numbers bigger.' };
        return pointCheck(E, g);
      },
      hint: `${dx > 0 ? 'Right adds to' : 'Left takes away from'} the first number. ${dy > 0 ? 'Up adds to' : 'Down takes away from'} the second.`,
      worked: [`Across: ${S[0]} ${dx > 0 ? '+' : '−'} ${Math.abs(dx)} = ${E[0]}`, `Up: ${S[1]} ${dy > 0 ? '+' : '−'} ${Math.abs(dy)} = ${E[1]}`, `You are at ${fmtPt(E)}.`],
      answerText: fmtPt(E),
      sig: [S, dx, dy],
      wrongExample: { x: String(E[0] + 1), y: String(E[1]) },
    });
  }
}

function genDescribe(rng: Rng, tier: Tier): Question {
  const n = T18.gridSize[tier];
  for (;;) {
    const S = pt(rng, n), E = pt(rng, n);
    const dx = E[0] - S[0], dy = E[1] - S[1];
    if (dx === 0 || dy === 0) continue;
    if (tier === 1 && (dx < 0 || dy < 0)) continue;
    const tokens: Token[] = [
      num('h', 'squares across'),
      { kind: 'toggle', id: 'hd', label: 'right or left', options: [{ value: 'right', label: 'right' }, { value: 'left', label: 'left' }] },
      'and',
      num('v', 'squares up or down'),
      { kind: 'toggle', id: 'vd', label: 'up or down', options: [{ value: 'up', label: 'up' }, { value: 'down', label: 'down' }] },
    ];
    const exp = { h: String(Math.abs(dx)), hd: dx > 0 ? 'right' : 'left', v: String(Math.abs(dy)), vd: dy > 0 ? 'up' : 'down' };
    return makeQuestion({
      topicId: ID, kind: 'describe', tier,
      story: 'Tell Juniper how to walk from the tent to the crate.',
      prompt: `The tent is at ${fmtPt(S)}. The crate is at ${fmtPt(E)}. Describe the move.`,
      interaction: { type: 'fields', tokens, visual: { kind: 'grid', w: n, h: n, axes: true, drawings: [{ kind: 'point', p: S, icon: 'tent' }, { kind: 'point', p: E, icon: 'crate' }] } },
      expected: exp,
      check: (a) => {
        const r = a as Record<string, string>;
        const h = parseNumber(r.h ?? ''), v = parseNumber(r.v ?? '');
        if (h === null || v === null || !r.hd || !r.vd) return { correct: false, feedback: 'Fill in both numbers and choose both directions.' };
        const gx = r.hd === 'right' ? h : -h, gy = r.vd === 'up' ? v : -v;
        if (gx === dx && gy === dy) return { correct: true };
        if (Math.abs(gx) === Math.abs(dx) && Math.abs(gy) === Math.abs(dy)) return { correct: false, feedback: 'The distances are right! Check the directions.' };
        if (gx === dx) return { correct: false, feedback: 'Across is right. Check up or down.' };
        if (gy === dy) return { correct: false, feedback: 'Up/down is right. Check across.' };
        return { correct: false, feedback: 'Compare the first numbers for across, and the second numbers for up or down.' };
      },
      hint: `Across: from ${S[0]} to ${E[0]}. Up or down: from ${S[1]} to ${E[1]}.`,
      worked: [`Across: ${S[0]} → ${E[0]} is ${Math.abs(dx)} ${exp.hd}.`, `Up/down: ${S[1]} → ${E[1]} is ${Math.abs(dy)} ${exp.vd}.`],
      answerText: `${Math.abs(dx)} ${exp.hd}, ${Math.abs(dy)} ${exp.vd}`,
      sig: [S, E],
      wrongExample: { ...exp, hd: exp.hd === 'right' ? 'left' : 'right' },
    });
  }
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  plot: genPlot,
  read: genRead,
  vertex: genVertex,
  move: genMove,
  describe: genDescribe,
};

export const topic18: TopicModule = {
  id: ID,
  title: 'Position with coordinates',
  job: 'Read the treasure map',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { plot: [4, 3, 2], read: [3, 2, 2], vertex: [1, 2, 3], move: [2, 2, 2], describe: [0, 1, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};
