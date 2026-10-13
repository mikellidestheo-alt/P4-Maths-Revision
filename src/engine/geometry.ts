import type { Point } from './types';

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
export const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
export const len2 = (a: Point, b: Point) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
export const eq = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
export const rot90 = (d: Point): Point => [-d[1], d[0]];
export const isParallelDir = (a: Point, b: Point) => cross(a, b) === 0 && !(a[0] === 0 && a[1] === 0) && !(b[0] === 0 && b[1] === 0);
export const isPerpDir = (a: Point, b: Point) => dot(a, b) === 0 && !(a[0] === 0 && a[1] === 0) && !(b[0] === 0 && b[1] === 0);
/** Is point p on the infinite line through a with direction d? */
export const onLine = (p: Point, a: Point, d: Point) => cross(sub(p, a), d) === 0;
export const inGrid = (p: Point, w: number, h: number) => p[0] >= 0 && p[1] >= 0 && p[0] <= w && p[1] <= h;

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Twice the signed area of a polygon */
export function area2(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s;
}

export function edges(pts: Point[]): Point[] {
  return pts.map((p, i) => sub(pts[(i + 1) % pts.length], p));
}

export function parallelSidePairs(pts: Point[]): number {
  const e = edges(pts);
  let n = 0;
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) if (cross(e[i], e[j]) === 0) n++;
  return n;
}

export function rightAngles(pts: Point[]): number {
  let n = 0;
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i + pts.length - 1) % pts.length], cur = pts[i], next = pts[(i + 1) % pts.length];
    if (dot(sub(prev, cur), sub(next, cur)) === 0) n++;
  }
  return n;
}

/** Simple (non self-intersecting) convex check for small polygons */
export function isConvex(pts: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const z = cross(sub(b, a), sub(c, b));
    if (z === 0) return false;
    if (sign === 0) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

export type TriangleSides = 'equilateral' | 'isosceles' | 'scalene';

export function triangleSides(a: Point, b: Point, c: Point): TriangleSides | 'none' {
  if (cross(sub(b, a), sub(c, a)) === 0) return 'none';
  const s = [len2(a, b), len2(b, c), len2(c, a)];
  if (s[0] === s[1] && s[1] === s[2]) return 'equilateral';
  if (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]) return 'isosceles';
  return 'scalene';
}

export function isRightTriangle(a: Point, b: Point, c: Point): boolean {
  if (cross(sub(b, a), sub(c, a)) === 0) return false;
  return dot(sub(b, a), sub(c, a)) === 0 || dot(sub(a, b), sub(c, b)) === 0 || dot(sub(a, c), sub(b, c)) === 0;
}

/** Reflect a point in a vertical line x = k (axis 'x') or horizontal line y = k (axis 'y'). */
export function reflect(p: Point, axis: 'x' | 'y', k: number): Point {
  return axis === 'x' ? [2 * k - p[0], p[1]] : [p[0], 2 * k - p[1]];
}

/**
 * Lines of symmetry of a polygon (float coordinates), found by testing candidate axes through the
 * centroid and each vertex / edge midpoint. Returns the axis directions (unit vectors, deduplicated).
 */
export function symmetryAxes(pts: Point[], eps = 1e-6): { p: Point; d: Point }[] {
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const c: Point = [cx, cy];
  const cands: Point[] = [];
  for (let i = 0; i < n; i++) {
    cands.push(pts[i]);
    const j = (i + 1) % n;
    cands.push([(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2]);
  }
  const axes: { p: Point; d: Point }[] = [];
  for (const q of cands) {
    let d: Point = [q[0] - cx, q[1] - cy];
    const L = Math.hypot(d[0], d[1]);
    if (L < eps) continue;
    d = [d[0] / L, d[1] / L];
    if (axes.some((a) => Math.abs(cross(a.d, d)) < 1e-6)) continue;
    const refl = (p: Point): Point => {
      const v: Point = [p[0] - cx, p[1] - cy];
      const t = dot(v, d);
      return [cx + 2 * t * d[0] - v[0], cy + 2 * t * d[1] - v[1]];
    };
    const ok = pts.every((p) => {
      const r = refl(p);
      return pts.some((s) => Math.abs(s[0] - r[0]) < 1e-6 && Math.abs(s[1] - r[1]) < 1e-6);
    });
    if (ok) axes.push({ p: c, d });
  }
  return axes;
}
