/**
 * The map, as plain numbers (no Three.js here, so it can be unit-tested).
 * x/z are the ground plane; the camp is at the origin. Each night has a straight forest path
 * leading out from camp; its three tasks, the campfire spot and the friend's spot lie along it.
 */
import { makeRng } from '../engine/rng';

export const MAP_RADIUS = 92;
export const WALK_RADIUS = 86;
export const CAMP_RADIUS = 15;
export const PATH_HALF_WIDTH = 4.2;
export const HUB_RADIUS = 10;

/** Distance from camp along the night's path. */
export const SPOT_DIST = { task1: 24, task2: 38, task3: 52, fire: 63, friend: 74 } as const;
export const PATH_END = 80;

export interface V2 { x: number; z: number }

/** Night n's path heads out at this angle (radians). Night 1 is straight ahead of the start view. */
export function pathAngle(n: number): number {
  return ((n - 1) * Math.PI) / 3;
}

export function dir(angle: number): V2 {
  return { x: Math.sin(angle), z: -Math.cos(angle) };
}

export function along(n: number, dist: number): V2 {
  const d = dir(pathAngle(n));
  return { x: d.x * dist, z: d.z * dist };
}

export function taskSpot(n: number, step: 1 | 2 | 3): V2 {
  return along(n, step === 1 ? SPOT_DIST.task1 : step === 2 ? SPOT_DIST.task2 : SPOT_DIST.task3);
}
export const fireSpot = (n: number) => along(n, SPOT_DIST.fire);

/** Props (task plinths, the night's campfire) stand this far to the side of the path centre. */
export const PROP_OFFSET = 2.6;
export const PROP_RADIUS = 1.1;
export function besidePath(n: number, d: number): V2 {
  const p = along(n, d), a = pathAngle(n);
  return { x: p.x + Math.cos(a) * PROP_OFFSET, z: p.z + Math.sin(a) * PROP_OFFSET };
}
export const friendSpot = (n: number) => along(n, SPOT_DIST.friend);

/** Where rescued friends wait at camp (around the fire). */
export function campSpot(i: number): V2 {
  const a = pathAngle(i + 1) + Math.PI / 6;
  return { x: Math.sin(a) * 7.5, z: -Math.cos(a) * 7.5 };
}

export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Projection of p onto night n's path: t = distance along, side = distance off the path. */
export function onPath(p: V2, n: number): { t: number; side: number } {
  const d = dir(pathAngle(n));
  const t = p.x * d.x + p.z * d.z;
  const side = Math.abs(p.x * d.z - p.z * d.x);
  return { t, side };
}

/** Is a point inside a cleared corridor (any night's path) or the camp clearing? */
export function inClearing(p: V2, margin = 0): boolean {
  if (Math.hypot(p.x, p.z) < CAMP_RADIUS + margin) return true;
  for (let n = 1; n <= 6; n++) {
    const { t, side } = onPath(p, n);
    if (t > 0 && t < PATH_END + 6 && side < PATH_HALF_WIDTH + margin) return true;
  }
  return false;
}

export interface Collider { x: number; z: number; r: number }

/** Fixed camp props that block walking. */
export const CAMP_COLLIDERS: Collider[] = [
  { x: 0, z: 0, r: 1.6 }, // campfire
  { x: -4.2, z: 3.4, r: 2.4 }, // tent
  { x: 3.6, z: 3.8, r: 0.7 }, // lantern post
];

/** Tree positions: dense forest everywhere except the camp and the six paths. Seeded, so always the same map. */
export function treeLayout(): { x: number; z: number; s: number; hue: number }[] {
  const rng = makeRng(20261017);
  const out: { x: number; z: number; s: number; hue: number }[] = [];
  const minGap = 3.1;
  for (let i = 0; i < 9000 && out.length < 520; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * (MAP_RADIUS - 2);
    const p = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    if (inClearing(p, 1.4)) continue;
    let ok = true;
    for (const q of out) if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < minGap * minGap) { ok = false; break; }
    if (!ok) continue;
    out.push({ ...p, s: 0.8 + rng.next() * 0.6, hue: rng.next() });
  }
  return out;
}

export const TREE_RADIUS = 0.9;

/**
 * Waypoints for "walk to the marker": along the player's path back towards camp, round the camp ring
 * to the right path, then out along it. Paths and the camp are kept free of trees, so this never gets stuck.
 */
export function routeTo(from: V2, toNight: number, toDist: number): V2[] {
  const target = along(toNight, toDist);
  // which path (if any) is the player on?
  let cur = 0, curT = 0, curSide = 0;
  for (let n = 1; n <= 6; n++) {
    const { t, side } = onPath(from, n);
    if (t > HUB_RADIUS - 2 && side < PATH_HALF_WIDTH + 2.5) { cur = n; curT = t; curSide = side; break; }
  }
  const pts: V2[] = [];
  // on the right path already: step onto its centre line (props stand at the sides), then walk along it
  if (cur === toNight) return curSide > 0.8 ? [along(cur, Math.max(HUB_RADIUS, Math.min(PATH_END, curT))), target] : [target];
  const fromR = Math.hypot(from.x, from.z);
  let startAngle: number;
  if (cur) {
    if (curSide > 0.8) pts.push(along(cur, Math.max(HUB_RADIUS, Math.min(PATH_END, curT))));
    pts.push(along(cur, HUB_RADIUS));
    startAngle = pathAngle(cur);
  } else if (fromR < CAMP_RADIUS + 1) {
    startAngle = Math.atan2(from.x, -from.z);
    if (fromR < HUB_RADIUS - 1) pts.push({ x: Math.sin(startAngle) * HUB_RADIUS, z: -Math.cos(startAngle) * HUB_RADIUS });
  } else {
    // in the trees: head for the nearest path first
    let best = 1, bestSide = Infinity;
    for (let n = 1; n <= 6; n++) {
      const { t, side } = onPath(from, n);
      if (t > 0 && side < bestSide) { best = n; bestSide = side; }
    }
    const t = Math.max(HUB_RADIUS, Math.min(PATH_END, onPath(from, best).t));
    if (best === toNight) return [along(best, t), target];
    pts.push(along(best, t), along(best, HUB_RADIUS));
    startAngle = pathAngle(best);
  }
  // walk round the hub ring in steps of at most 60°, the short way round
  const end = pathAngle(toNight);
  let delta = end - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 3) - 1e-9));
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (delta * i) / steps;
    pts.push({ x: Math.sin(a) * HUB_RADIUS, z: -Math.cos(a) * HUB_RADIUS });
  }
  pts.push(target);
  return pts;
}
