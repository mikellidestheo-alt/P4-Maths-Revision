import { PLAN, type Tier } from '../config/difficulty';
import { TOPICS } from '../topics';
import type { Rng } from './rng';
import type { Question } from './types';

/** A "job" = one 10-question set: a single topic, or a mixed review. */
export interface JobDef {
  id: string; // topic id, or 'R1' / 'R2' / 'F'
  title: string;
  job: string;
  topics: string[];
  review: boolean;
}

export interface JobState {
  index: number; // questions completed
  offset: number; // adaptive tier offset (-1..+1)
  rightStreak: number;
  wrongStreak: number;
  choiceCount: number;
  topicCounts: Record<string, number>;
  firstTry: boolean[];
}

export const newJobState = (): JobState => ({ index: 0, offset: 0, rightStreak: 0, wrongStreak: 0, choiceCount: 0, topicCounts: {}, firstTry: [] });

export const QUESTIONS_PER_JOB = 10;

export function plannedTiers(nudge: number): Tier[] {
  return nudge > 0 ? PLAN.tiersHarder : nudge < 0 ? PLAN.tiersEasier : PLAN.tiers;
}

export const clampTier = (t: number): Tier => (t < 1 ? 1 : t > 3 ? 3 : t) as Tier;

/** Tier for the next question, given the plan and the adaptive offset. */
export function tierFor(state: JobState, nudge: number): Tier {
  const plan = plannedTiers(nudge);
  return clampTier(plan[Math.min(state.index, plan.length - 1)] + state.offset);
}

/** Update adaptivity after a question: 2 wrong in a row → easier, 3 right in a row → harder. */
export function recordResult(state: JobState, firstTryCorrect: boolean): JobState {
  const s = { ...state, firstTry: [...state.firstTry, firstTryCorrect], index: state.index + 1 };
  if (firstTryCorrect) {
    s.rightStreak++;
    s.wrongStreak = 0;
    if (s.rightStreak >= PLAN.rightStreakToHarden) {
      s.offset = Math.min(1, s.offset + 1);
      s.rightStreak = 0;
    }
  } else {
    s.wrongStreak++;
    s.rightStreak = 0;
    if (s.wrongStreak >= PLAN.wrongStreakToEase) {
      s.offset = Math.max(-1, s.offset - 1);
      s.wrongStreak = 0;
    }
  }
  return s;
}

/**
 * Choose which topic a review question comes from.
 * weights: higher = weaker topic. Max 2 questions per topic per review.
 */
export function pickReviewTopic(rng: Rng, job: JobDef, state: JobState, weights: Record<string, number>): string {
  const avail = job.topics.filter((t) => (state.topicCounts[t] ?? 0) < 2);
  const pool = avail.length ? avail : job.topics;
  return rng.weighted(pool, pool.map((t) => weights[t] ?? 1));
}

/** Generate the next question for a job. `seen` holds signatures used this session (mutated). */
export function nextQuestion(rng: Rng, job: JobDef, state: JobState, opts: { nudge: number; weights: Record<string, number>; seen: Set<string> }): Question {
  const tier = tierFor(state, opts.nudge);
  const cap = job.review ? 1 : PLAN.maxChoicePerJob;
  let last: Question | null = null;
  for (let tries = 0; tries < 60; tries++) {
    const topicId = job.review ? pickReviewTopic(rng, job, state, opts.weights) : job.topics[0];
    const q = TOPICS[topicId].generate(rng, tier, { avoidChoice: state.choiceCount >= cap });
    last = q;
    if (opts.seen.has(q.signature)) continue;
    if (q.isChoice && state.choiceCount >= cap) continue;
    opts.seen.add(q.signature);
    return q;
  }
  return last!;
}

/** After a question is shown, note what it used (MC count, review topic count). */
export function noteShown(state: JobState, q: Question): JobState {
  return {
    ...state,
    choiceCount: state.choiceCount + (q.isChoice ? 1 : 0),
    topicCounts: { ...state.topicCounts, [q.topicId]: (state.topicCounts[q.topicId] ?? 0) + 1 },
  };
}

export interface MissEntry {
  topicId: string;
  kind: string;
  tier: Tier;
}

/** Recap: a fresh variant of a missed question — same skill, same or easier tier. */
export function recapQuestion(rng: Rng, miss: MissEntry, seen: Set<string>): Question {
  const tier = clampTier(miss.tier === 3 ? 2 : miss.tier);
  let last: Question | null = null;
  for (let tries = 0; tries < 40; tries++) {
    const q = TOPICS[miss.topicId].generate(rng, tier, { kind: miss.kind });
    last = q;
    if (!seen.has(q.signature)) {
      seen.add(q.signature);
      return q;
    }
  }
  return last!;
}
