/** Game rules that read/modify the save data: unlocking (story order), scoring, history. */
import { PLAN } from '../config/difficulty';
import { newJobState, recordResult, noteShown, type MissEntry } from '../engine/planner';
import type { Question } from '../engine/types';
import type { MissRecord, NightRun, SaveData, TopicStats } from '../storage/save';
import { now } from './clock';
import { NIGHTS } from './nights';
import { TOPIC_LIST } from '../topics';

export const COINS = { firstTry: 2, secondTry: 1, recapFix: 2, rescue: 10, rescueReplay: 5 };

export const isFinished = (d: SaveData, n: number) => !!d.nights[n]?.finished;
export const allFinished = (d: SaveData) => NIGHTS.every((x) => isFinished(d, x.n));

export function isUnlocked(d: SaveData, n: number): boolean {
  return n === 1 || d.flags.allUnlocked || isFinished(d, n - 1) || isFinished(d, n);
}

/** The next night to play (first unfinished), or null when all six are done. */
export function nextNight(d: SaveData): number | null {
  for (const x of NIGHTS) if (!isFinished(d, x.n)) return x.n;
  return null;
}

export type StartCheck = { ok: true; replay: boolean; resume: boolean } | { ok: false; reason: 'locked' };

export function canStart(d: SaveData, n: number): StartCheck {
  if (d.current && d.current.night === n) return { ok: true, replay: d.current.replay, resume: true };
  if (isFinished(d, n)) return { ok: true, replay: true, resume: false };
  if (!isUnlocked(d, n)) return { ok: false, reason: 'locked' };
  return { ok: true, replay: false, resume: false };
}

export function startNight(d: SaveData, n: number): NightRun {
  if (d.current && d.current.night === n) return d.current;
  const def = NIGHTS[n - 1];
  const run: NightRun = {
    night: n,
    replay: isFinished(d, n),
    startedAt: new Date(now()).toISOString(),
    jobs: Object.fromEntries(def.jobs.map((j) => [j, { ...newJobState(), done: false }])),
    misses: [],
    recap: null,
    stage: 'day',
    coins: 0,
    firstTry: 0,
    answered: 0,
  };
  d.current = run;
  return run;
}

export function abandonNight(d: SaveData) {
  d.current = null;
}

export function topicStats(d: SaveData, id: string): TopicStats {
  if (!d.topics[id]) d.topics[id] = { attempts: 0, firstTry: 0, eventual: 0, recapTries: 0, recapFixed: 0, missed: [] };
  return d.topics[id];
}

/** Called once per question when it is shown (MC count, review spread). */
export function noteQuestionShown(d: SaveData, jobId: string, q: Question) {
  const run = d.current;
  if (!run || !run.jobs[jobId]) return;
  run.jobs[jobId] = { ...noteShown(run.jobs[jobId], q), done: run.jobs[jobId].done };
}

export interface AnswerOutcome {
  firstTry: boolean; // correct on the first attempt
  eventual: boolean; // correct within two attempts
}

/** Record a finished job question. Returns coins earned. */
export function recordJobAnswer(d: SaveData, jobId: string, q: Question, o: AnswerOutcome): number {
  const run = d.current;
  const st = topicStats(d, q.topicId);
  st.attempts++;
  if (o.firstTry) st.firstTry++;
  if (o.eventual) st.eventual++;
  let coins = o.firstTry ? COINS.firstTry : o.eventual ? COINS.secondTry : 0;
  if (!o.firstTry) {
    const miss: MissRecord = {
      topicId: q.topicId, kind: q.kind, tier: q.tier, prompt: q.prompt, story: q.story, answer: q.answerText,
      at: new Date(now()).toISOString(), night: run?.night ?? 0,
    };
    // only questions that needed the worked solution go to the campfire recap;
    // ones fixed on the second try are still noted in the topic history (used to weight reviews)
    if (!o.eventual) run?.misses.push(miss);
    st.missed.push({ ...miss, fixed: o.eventual });
    if (st.missed.length > 12) st.missed.splice(0, st.missed.length - 12);
  }
  if (run && run.jobs[jobId]) {
    const job = run.jobs[jobId];
    run.jobs[jobId] = { ...recordResult(job, o.firstTry), done: job.done };
    run.answered++;
    if (o.firstTry) run.firstTry++;
    run.coins += coins;
  }
  d.coins += coins;
  d.coinsEarnedTotal += coins;
  return coins;
}

/** Record a Campfire recap question. Returns coins earned. */
export function recordRecapAnswer(d: SaveData, q: Question, o: AnswerOutcome): number {
  const st = topicStats(d, q.topicId);
  st.recapTries++;
  const run = d.current;
  let coins = 0;
  if (o.eventual) {
    st.recapFixed++;
    coins = COINS.recapFix;
    const m = [...st.missed].reverse().find((x) => x.kind === q.kind && !x.fixed);
    if (m) m.fixed = true;
    if (run?.recap) run.recap.fixed++;
  } else {
    st.missed.push({ topicId: q.topicId, kind: q.kind, tier: q.tier, prompt: q.prompt, story: q.story, answer: q.answerText, at: new Date(now()).toISOString(), night: run?.night ?? 0 });
    if (st.missed.length > 12) st.missed.splice(0, st.missed.length - 12);
  }
  if (run) run.coins += coins;
  d.coins += coins;
  d.coinsEarnedTotal += coins;
  return coins;
}

/** Once all of tonight's jobs are done, fix the Campfire recap list (may be empty). */
export function prepareRecap(run: NightRun) {
  const def = NIGHTS[run.night - 1];
  if (!run.recap && def.jobs.every((j) => run.jobs[j]?.done)) run.recap = { queue: buildRecapQueue(run), index: 0, fixed: 0 };
}

/** Up to PLAN.maxRecap distinct missed skills, most recent first. */
export function buildRecapQueue(run: NightRun): MissEntry[] {
  const seen = new Set<string>();
  const out: MissEntry[] = [];
  for (const m of [...run.misses].reverse()) {
    const key = `${m.topicId}|${m.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ topicId: m.topicId, kind: m.kind, tier: m.tier });
    if (out.length >= PLAN.maxRecap) break;
  }
  return out.reverse();
}

export function starsFor(firstTry: number, answered: number): 1 | 2 | 3 {
  const r = answered ? firstTry / answered : 0;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}

export interface NightSummary {
  night: number;
  stars: 1 | 2 | 3;
  coins: number;
  firstFinish: boolean;
  firstTry: number;
  answered: number;
  recapFixed: number;
  recapTotal: number;
}

export function finishNight(d: SaveData): NightSummary | null {
  const run = d.current;
  if (!run) return null;
  if (run.summary) return run.summary;
  const rec = d.nights[run.night] ?? { finished: false, bestStars: 0, plays: 0 };
  const firstFinish = !rec.finished;
  const stars = starsFor(run.firstTry, run.answered);
  const bonus = firstFinish ? COINS.rescue : COINS.rescueReplay;
  d.coins += bonus;
  d.coinsEarnedTotal += bonus;
  run.coins += bonus;
  d.nights[run.night] = {
    finished: true,
    firstFinishedAt: rec.firstFinishedAt ?? new Date(now()).toISOString(),
    bestStars: Math.max(rec.bestStars, stars),
    plays: rec.plays + 1,
  };
  const summary: NightSummary = {
    night: run.night, stars, coins: run.coins, firstFinish, firstTry: run.firstTry, answered: run.answered,
    recapFixed: run.recap?.fixed ?? 0, recapTotal: run.recap?.queue.length ?? 0,
  };
  run.stage = 'checkin';
  run.summary = summary;
  return summary;
}

/** End-of-night "was the maths…" answer: nudges the starting tiers of later nights (clamped to ±1). */
export function applyCheckin(d: SaveData, level: 'easy' | 'right' | 'hard' | null) {
  if (level === 'easy') d.nudge = Math.min(1, d.nudge + 1);
  if (level === 'hard') d.nudge = Math.max(-1, d.nudge - 1);
  d.current = null;
}

/** Review weighting: weaker topics come up more often. */
export function reviewWeights(d: SaveData): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of TOPIC_LIST) {
    const st = d.topics[t.id];
    if (!st || st.attempts === 0) {
      w[t.id] = 1.5;
      continue;
    }
    const rate = st.firstTry / st.attempts;
    const unfixed = st.missed.filter((m) => !m.fixed).length;
    w[t.id] = 1 + 4 * (1 - rate) + 0.5 * Math.min(4, unfixed);
  }
  return w;
}
