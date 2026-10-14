import { describe, expect, it } from 'vitest';
import { besidePath, PROP_RADIUS, SPOT_DIST, CAMP_COLLIDERS, PATH_HALF_WIDTH, TREE_RADIUS, WALK_RADIUS, dist, fireSpot, friendSpot, inClearing, routeTo, taskSpot, treeLayout, type V2 } from './layout';
import { doneJobs, jobPoint, objective, openJobs } from './quest';
import { defaultSave } from '../storage/save';
import { startNight } from '../game/progress';
import { newJobState } from '../engine/planner';

const trees = treeLayout();
const props: V2[] = [];
for (let n = 1; n <= 6; n++) for (const d of [SPOT_DIST.task1, SPOT_DIST.task2, SPOT_DIST.task3, SPOT_DIST.fire]) props.push(besidePath(n, d));
const blocked = (p: V2, r = 0.6) =>
  trees.some((t) => dist(t, p) < TREE_RADIUS + r) || CAMP_COLLIDERS.some((c) => dist(c, p) < c.r + r) ||
  props.some((c) => dist(c, p) < PROP_RADIUS + r) || Math.hypot(p.x, p.z) > WALK_RADIUS;

describe('world layout', () => {
  it('has a proper forest', () => {
    expect(trees.length).toBeGreaterThan(300);
  });

  it('every task, campfire and friend spot is reachable open ground, inside the map', () => {
    for (let n = 1; n <= 6; n++) {
      for (const p of [taskSpot(n, 1), taskSpot(n, 2), taskSpot(n, 3), fireSpot(n), friendSpot(n)]) {
        expect(inClearing(p)).toBe(true);
        expect(blocked(p, 1.2), `night ${n} spot ${JSON.stringify(p)}`).toBe(false);
      }
    }
  });

  it('no tree stands on a path or in the camp', () => {
    for (const t of trees) expect(inClearing(t, 0.5)).toBe(false);
  });

  it('“walk to marker” routes never cross a tree or a camp prop (from camp, from any spot, from the forest edge)', () => {
    const starts: V2[] = [{ x: 0, z: 6 }, { x: 5, z: -9 }];
    for (let n = 1; n <= 6; n++) starts.push(taskSpot(n, 2), friendSpot(n), fireSpot(n));
    for (const s of starts) {
      for (let to = 1; to <= 6; to++) {
        for (const dTo of [24, 52, 74]) {
          const pts = [s, ...routeTo(s, to, dTo)];
          for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i], b = pts[i + 1];
            const L = dist(a, b);
            for (let k = 0; k <= Math.ceil(L / 0.25); k++) {
              const t = L ? k / Math.ceil(L / 0.25) : 0;
              const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
              expect(blocked(p), `route from ${JSON.stringify(s)} to night ${to} @${dTo}: blocked at ${JSON.stringify(p)}`).toBe(false);
            }
          }
          expect(dist(pts[pts.length - 1], routeTo(s, to, dTo).at(-1)!)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('paths are wide enough for the walker', () => {
    expect(PATH_HALF_WIDTH).toBeGreaterThan(3);
  });
});

describe('quest objective', () => {
  it('starts at night 1 task 1, then 2, then 3', () => {
    const d = defaultSave();
    let o = objective(d);
    expect(o).toMatchObject({ kind: 'job', night: 1, step: 1, jobId: '1.1', started: false });
    const run = startNight(d, 1);
    run.jobs['1.1'].done = true;
    expect(objective(d)).toMatchObject({ kind: 'job', step: 2, jobId: '1.2', started: true });
    run.jobs['1.2'].done = true;
    o = objective(d);
    expect(o).toMatchObject({ kind: 'job', step: 3, jobId: '1.3' });
  });

  it('after the jobs: campfire if anything needs fixing, otherwise straight to the friend', () => {
    const d = defaultSave();
    const run = startNight(d, 1);
    for (const j of ['1.1', '1.2', '1.3']) run.jobs[j] = { ...newJobState(), done: true };
    run.recap = { queue: [{ topicId: '1.1', kind: 'words', tier: 1 }], index: 0, fixed: 0 };
    expect(objective(d)).toMatchObject({ kind: 'recap', left: 1 });
    run.recap.index = 1;
    expect(objective(d)).toMatchObject({ kind: 'friend', night: 1, label: 'Rescue Bramble' });
  });

  it('moves on to the next night, and is done after night 6', () => {
    const d = defaultSave();
    d.nights[1] = { finished: true, bestStars: 3, plays: 1 };
    expect(objective(d)).toMatchObject({ kind: 'job', night: 2, step: 1 });
    for (let n = 1; n <= 6; n++) d.nights[n] = { finished: true, bestStars: 3, plays: 1 };
    expect(objective(d)).toEqual({ kind: 'done' });
  });
});

describe('task order with Unlock All', () => {
  it('normally only the marked task is open, in path order', () => {
    const d = defaultSave();
    expect(openJobs(d, objective(d))).toEqual(['1.1']);
    const run = startNight(d, 1);
    run.jobs['1.1'].done = true;
    expect(openJobs(d, objective(d))).toEqual(['1.2']);
  });

  it('with Unlock All every unfinished task tonight is open, in any order; the friend still waits for all three', () => {
    const d = defaultSave();
    d.flags.allUnlocked = true;
    expect(openJobs(d, objective(d))).toEqual(['1.1', '1.2', '1.3']);
    const run = startNight(d, 1);
    run.jobs['1.3'].done = true; // the last task first
    expect(doneJobs(d, 1)).toEqual(['1.3']);
    expect(objective(d)).toMatchObject({ kind: 'job', jobId: '1.1' }); // marker: first task left
    expect(openJobs(d, objective(d))).toEqual(['1.1', '1.2']);
    run.jobs['1.1'].done = true;
    expect(openJobs(d, objective(d))).toEqual(['1.2']);
    expect(objective(d).kind).toBe('job'); // no friend yet
    run.jobs['1.2'].done = true;
    expect(objective(d)).toMatchObject({ kind: 'friend', night: 1 });
    expect(openJobs(d, objective(d))).toEqual([]);
  });

  it('works on any night, and each task sign is at its own spot on the path', () => {
    const d = defaultSave();
    d.flags.allUnlocked = true;
    startNight(d, 5);
    expect(openJobs(d, objective(d))).toEqual(['2.4', '2.5', '2.6']);
    const pts = ['2.4', '2.5', '2.6'].map((j) => jobPoint(5, j));
    expect(dist(pts[0], pts[1])).toBeGreaterThan(8);
    expect(dist(pts[1], pts[2])).toBeGreaterThan(8);
  });
});
