import { T12, type Tier } from '../config/difficulty';
import { makeQuestion, manyNumbers, oneNumber } from '../engine/build';
import { fmt } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { GenContext, Question, Token, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.2';

/** A start value that makes the counting cross a "bigger" boundary. */
function startNear(rng: Rng, tier: Tier, step: number, up: boolean, steps: number): number {
  const max = T12.max[tier];
  for (let tries = 0; tries < 500; tries++) {
    // boundary is a multiple of 10×step (or 100×step) so the counting crosses it
    const big = step * (rng.chance(0.5) ? 10 : 100);
    const boundaryMax = Math.floor(max / big);
    if (boundaryMax < 1) continue;
    const boundary = rng.int(1, boundaryMax) * big;
    const k = rng.int(1, steps - 1);
    // small random part below the step size keeps numbers interesting (e.g. 4,350 → 4,450)
    const extra = step >= 100 && rng.chance(0.5) ? rng.int(1, step / 10 - 1) * 10 : step === 1000 && rng.chance(0.3) ? rng.int(1, 9) * 100 : 0;
    const start = up ? boundary - k * step + extra : boundary + k * step + extra;
    const end = up ? start + steps * step : start - steps * step;
    if (start >= 0 && end >= 0 && start <= max && end <= max) return start;
  }
  return up ? step : steps * step;
}

function genMarkers(rng: Rng, tier: Tier): Question {
  const step = rng.pick(T12.steps[tier]);
  const up = rng.chance(tier === 1 ? 0.7 : 0.5);
  const n = T12.markers;
  const start = startNear(rng, tier, step, up, n - 1);
  const seq = Array.from({ length: n }, (_, i) => (up ? start + i * step : start - i * step));
  const blanksN = tier === 1 ? 2 : 3;
  // never blank the first two, so the step can be seen
  const blankIdx = rng.shuffle([2, 3, 4, 5]).slice(0, blanksN).sort((a, b) => a - b);
  const tokens: Token[] = [];
  const expected: Record<string, number> = {};
  const names: Record<string, string> = {};
  seq.forEach((v, i) => {
    if (blankIdx.includes(i)) {
      const id = `m${i}`;
      tokens.push({ kind: 'number', id, label: `marker ${i + 1}` });
      expected[id] = v;
      names[id] = `marker ${i + 1}`;
    } else tokens.push(fmt(v));
  });
  const f = manyNumbers(expected, tokens, { names, layout: 'markers', wrongMsg: 'The trail markers don’t follow the pattern yet.' });
  return makeQuestion({
    topicId: ID, kind: 'markers', tier,
    story: 'Some trail markers have fallen off their posts.',
    prompt: `The markers count ${up ? 'on' : 'back'} in ${fmt(step)}s. Fill in the missing ones.`,
    ...f,
    hint: `Each marker is ${fmt(step)} ${up ? 'more' : 'less'} than the one before. Take care when you cross a ${step === 10 ? 'hundred' : step === 100 ? 'thousand' : 'ten thousand'}!`,
    worked: [`Count ${up ? 'on' : 'back'} in ${fmt(step)}s:`, seq.map(fmt).join(', ')],
    answerText: blankIdx.map((i) => fmt(seq[i])).join(', '),
    sig: [start, step, up, blankIdx],
  });
}

function genStepsAfter(rng: Rng, tier: Tier): Question {
  const step = rng.pick(T12.steps[tier]);
  const up = rng.chance(0.55);
  const k = rng.int(2, tier === 1 ? 4 : 6);
  const start = startNear(rng, tier, step, up, k + 1);
  const end = up ? start + k * step : start - k * step;
  const f = oneNumber(end, {
    fb: { high: 'You went a bit too far along the trail.', low: 'You haven’t gone far enough along the trail.' },
    extraCheck: (x) => (x === (up ? start - k * step : start + k * step) ? { correct: false, feedback: `Careful — that’s counting ${up ? 'back' : 'on'}. This time count ${up ? 'on' : 'back'}.` } : null),
  });
  return makeQuestion({
    topicId: ID, kind: 'stepsAfter', tier,
    story: 'Wren walks along the trail, stopping at every marker.',
    prompt: `Start at ${fmt(start)}. Count ${up ? 'on' : 'back'} ${k} steps of ${fmt(step)}. Where do you finish?`,
    ...f,
    hint: `Say each marker out loud: ${fmt(start)}, ${fmt(up ? start + step : start - step)}, …`,
    worked: [Array.from({ length: k + 1 }, (_, i) => fmt(up ? start + i * step : start - i * step)).join(' → ')],
    answerText: fmt(end),
    sig: [start, step, up, k],
  });
}

function genStepSize(rng: Rng, tier: Tier): Question {
  const step = rng.pick(T12.steps[tier]);
  const up = rng.chance(0.5);
  const start = startNear(rng, tier, step, up, 4);
  const seq = Array.from({ length: 4 }, (_, i) => (up ? start + i * step : start - i * step));
  const f = oneNumber(step, {
    before: [`It goes ${up ? 'up' : 'down'} by`],
    after: ['each time.'],
    fb: { high: 'That’s a bigger jump than the markers make.', low: 'That’s a smaller jump than the markers make.' },
  });
  return makeQuestion({
    topicId: ID, kind: 'stepSize', tier,
    story: 'The trail markers follow a secret counting rule.',
    prompt: `${seq.map(fmt).join(', ')} … How big is each step?`,
    ...f,
    hint: 'Find the difference between two markers next to each other.',
    worked: [`${fmt(Math.max(seq[0], seq[1]))} − ${fmt(Math.min(seq[0], seq[1]))} = ${fmt(step)}`, `It goes ${up ? 'up' : 'down'} by ${fmt(step)} each time.`],
    answerText: fmt(step),
    sig: [start, step, up],
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  markers: genMarkers,
  stepsAfter: genStepsAfter,
  stepSize: genStepSize,
};

export const topic12: TopicModule = {
  id: ID,
  title: 'Counting in 10s, 100s and 1,000s',
  job: 'Fix the trail markers',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { markers: [5, 5, 4], stepsAfter: [3, 3, 4], stepSize: [2, 2, 2] }, tier);
    return GENS[kind](rng, tier);
  },
};
