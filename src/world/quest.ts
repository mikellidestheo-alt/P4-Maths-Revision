/**
 * What the quest marker points at, worked out from the save data (pure, unit-tested).
 * Order each night: Task 1 → Task 2 → Task 3 → (Campfire, only if something needs fixing) → friend.
 * The friend only appears at the end of the path once everything before it is done.
 */
import type { SaveData } from '../storage/save';
import { NIGHTS, friendOf, jobDef } from '../game/nights';
import { nextNight } from '../game/progress';
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
    const done = run ? run.jobs[jobId]?.done || run.jobs[jobId]?.index >= 10 : false;
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

/** How many of tonight's steps are done (for "Task 2 of 3" and the path lanterns). */
export function stepsDone(d: SaveData, n: number): number {
  const run = d.current;
  if (!run || run.night !== n) return 0;
  return NIGHTS[n - 1].jobs.filter((j) => run.jobs[j]?.done).length;
}
