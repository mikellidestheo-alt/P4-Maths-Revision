/**
 * What the quest marker points at, worked out from the save data (pure, unit-tested).
 * Order each night: Task 1 → Task 2 → Task 3 → (Campfire, only if something needs fixing) → friend.
 * The friend only appears at the end of the path once everything before it is done.
 * With Unlock All, tonight's tasks can be done in any order (the marker still shows the first one left).
 */
import type { SaveData } from '../storage/save';
import { NIGHTS, friendOf, jobDef } from '../game/nights';
import { nextNight } from '../game/progress';
import { QUESTIONS_PER_JOB } from '../engine/planner';
import { SPOT_DIST, along, type V2 } from './layout';

export type Objective =
  | { kind: 'job'; night: number; step: 1 | 2 | 3; jobId: string; dist: number; point: V2; label: string; started: boolean }
  | { kind: 'recap'; night: number; left: number; dist: number; point: V2; label: string }
  | { kind: 'friend'; night: number; dist: number; point: V2; label: string }
  | { kind: 'done' };

const STEP_DIST = [SPOT_DIST.task1, SPOT_DIST.task2, SPOT_DIST.task3];

export function objective(d: SaveData): Objective {
  const run = d.current;
  const n = run ? run.night : nextNight(d);
  if (!n) return { kind: 'done' };
  const def = NIGHTS[n - 1];
  for (let i = 0; i < def.jobs.length; i++) {
    const jobId = def.jobs[i];
    const done = run ? run.jobs[jobId]?.done || run.jobs[jobId]?.index >= QUESTIONS_PER_JOB : false;
    if (!done) {
      const step = (i + 1) as 1 | 2 | 3;
      return { kind: 'job', night: n, step, jobId, dist: STEP_DIST[i], point: along(n, STEP_DIST[i]), label: jobDef(jobId).job, started: !!run };
    }
  }
  const recap = run!.recap;
  if (recap && recap.index < recap.queue.length) {
    return { kind: 'recap', night: n, left: recap.queue.length - recap.index, dist: SPOT_DIST.fire, point: along(n, SPOT_DIST.fire), label: 'Light the campfire' };
  }
  const f = friendOf(n);
  return { kind: 'friend', night: n, dist: SPOT_DIST.friend, point: along(n, SPOT_DIST.friend), label: `Rescue ${f.name}` };
}

const jobDone = (d: SaveData, n: number, j: string) => {
  const run = d.current;
  return !!run && run.night === n && (run.jobs[j]?.done || run.jobs[j]?.index >= QUESTIONS_PER_JOB);
};

/** Tonight's finished tasks (any order). */
export function doneJobs(d: SaveData, n: number): string[] {
  return NIGHTS[n - 1].jobs.filter((j) => jobDone(d, n, j));
}

/**
 * Tasks that can be started now: just the marked one normally; every unfinished one with Unlock All.
 * Once the tasks are done (campfire / friend), none.
 */
export function openJobs(d: SaveData, o: Objective): string[] {
  if (o.kind !== 'job') return [];
  if (!d.flags.allUnlocked) return [o.jobId];
  return NIGHTS[o.night - 1].jobs.filter((j) => !jobDone(d, o.night, j));
}

/** Where a task's sign is (on the path, for walking up to it). */
export function jobPoint(n: number, jobId: string): V2 {
  return along(n, STEP_DIST[NIGHTS[n - 1].jobs.indexOf(jobId)]);
}
