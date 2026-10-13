/** Renders the non-interactive pictures (grids, clocks, shapes, place-value charts). */
import { h, s, svgRoot } from './dom';
import type { Colour, Drawing, Point, Visual } from '../engine/types';
import { PLACE_SHORT } from '../engine/format';

export const U = 40; // grid unit in SVG user units

export interface GridFrame {
  svg: SVGSVGElement;
  w: number;
  h: number;
  padL: number;
  padT: number;
  toPx(p: Point): [number, number];
  layer: SVGGElement; // drawings
  top: SVGGElement; // interactive overlay
}

const COLOURS: Record<Colour, string> = {
  fence: 'var(--fence)',
  path: 'var(--path)',
  mirror: 'var(--mirror)',
  shape: 'var(--shape)',
  answer: 'var(--answer)',
  soft: 'var(--soft)',
  gold: 'var(--gold)',
};

export function gridFrame(w: number, hh: number, axes: boolean, label = 'grid'): GridFrame {
  const padL = axes ? 40 : 14, padB = axes ? 36 : 14, padT = 18, padR = 18;
  const W = padL + w * U + padR, H = padT + hh * U + padB;
  const svg = svgRoot(`0 0 ${W} ${H}`, { class: 'grid-svg', role: 'img', 'aria-label': label });
  const toPx = (p: Point): [number, number] => [padL + p[0] * U, padT + (hh - p[1]) * U];
  const bg = s('g', { class: 'grid-bg' });
  bg.appendChild(s('rect', { x: padL, y: padT, width: w * U, height: hh * U, class: 'grid-paper', rx: 4 }));
  for (let x = 0; x <= w; x++) {
    const [px] = toPx([x, 0]);
    bg.appendChild(s('line', { x1: px, y1: padT, x2: px, y2: padT + hh * U, class: x === 0 && axes ? 'grid-axis' : 'grid-line' }));
    if (axes) bg.appendChild(s('text', { x: px, y: padT + hh * U + 26, class: 'grid-num', 'text-anchor': 'middle' }, String(x)));
  }
  for (let y = 0; y <= hh; y++) {
    const [, py] = toPx([0, y]);
    bg.appendChild(s('line', { x1: padL, y1: py, x2: padL + w * U, y2: py, class: y === 0 && axes ? 'grid-axis' : 'grid-line' }));
    if (axes && y > 0) bg.appendChild(s('text', { x: padL - 12, y: py + 6, class: 'grid-num', 'text-anchor': 'end' }, String(y)));
  }
  svg.appendChild(bg);
  const layer = s('g', { class: 'grid-drawings' });
  const top = s('g', { class: 'grid-top' });
  svg.append(layer, top);
  return { svg, w, h: hh, padL, padT, toPx, layer, top };
}

export function icon(kind: string, x: number, y: number, size = 16): SVGGElement {
  const g = s('g', { class: `icon icon-${kind}`, transform: `translate(${x} ${y})` });
  const r = size;
  switch (kind) {
    case 'crate':
      g.append(s('rect', { x: -r * 0.8, y: -r * 0.8, width: r * 1.6, height: r * 1.6, rx: 2, fill: '#a86b3c', stroke: '#5b3519', 'stroke-width': 2 }),
        s('path', { d: `M${-r * 0.8} ${-r * 0.8} L${r * 0.8} ${r * 0.8} M${r * 0.8} ${-r * 0.8} L${-r * 0.8} ${r * 0.8}`, stroke: '#5b3519', 'stroke-width': 2 }));
      break;
    case 'tent':
      g.append(s('path', { d: `M0 ${-r} L${r} ${r * 0.8} L${-r} ${r * 0.8} Z`, fill: '#e07a3f', stroke: '#7a3412', 'stroke-width': 2 }),
        s('path', { d: `M0 ${-r * 0.2} L${r * 0.3} ${r * 0.8} L${-r * 0.3} ${r * 0.8} Z`, fill: '#5b2a10' }));
      break;
    case 'lantern':
      g.append(s('circle', { r: r * 1.1, fill: 'var(--lantern-glow)', opacity: 0.45 }),
        s('rect', { x: -r * 0.45, y: -r * 0.6, width: r * 0.9, height: r * 1.2, rx: 3, fill: 'var(--lantern)', stroke: '#6b4a12', 'stroke-width': 2 }),
        s('rect', { x: -r * 0.25, y: -r * 0.85, width: r * 0.5, height: r * 0.25, fill: '#6b4a12' }));
      break;
    case 'star':
      g.append(s('path', { d: starPath(r, r * 0.45), fill: 'var(--gold)', stroke: '#8a6400', 'stroke-width': 1.5 }));
      break;
    case 'flag':
      g.append(s('line', { x1: -r * 0.5, y1: r, x2: -r * 0.5, y2: -r, stroke: '#ddd', 'stroke-width': 3 }),
        s('path', { d: `M${-r * 0.5} ${-r} L${r} ${-r * 0.55} L${-r * 0.5} ${-r * 0.1} Z`, fill: '#e2475b' }));
      break;
    default:
      g.append(s('circle', { r: r * 0.45, fill: 'var(--point)', stroke: '#fff', 'stroke-width': 2 }));
  }
  return g;
}

export function starPath(R: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    d += `${i === 0 ? 'M' : 'L'}${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)} `;
  }
  return d + 'Z';
}

export function drawOnGrid(f: GridFrame, d: Drawing, target: SVGGElement = f.layer) {
  switch (d.kind) {
    case 'segment': {
      const [x1, y1] = f.toPx(d.a), [x2, y2] = f.toPx(d.b);
      const col = COLOURS[d.colour ?? 'fence'];
      target.appendChild(s('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': d.dashed ? '10 8' : null, class: `seg seg-${d.colour ?? 'fence'}` }));
      if (d.colour === 'fence' || !d.colour) {
        target.append(s('circle', { cx: x1, cy: y1, r: 6, fill: col }), s('circle', { cx: x2, cy: y2, r: 6, fill: col }));
      }
      break;
    }
    case 'polygon': {
      const pts = d.pts.map((p) => f.toPx(p).join(',')).join(' ');
      target.appendChild(s('polygon', { points: pts, class: `poly poly-${d.colour ?? 'shape'}` }));
      if (d.vertexLabels) {
        const cx = d.pts.reduce((t, p) => t + p[0], 0) / d.pts.length, cy = d.pts.reduce((t, p) => t + p[1], 0) / d.pts.length;
        d.pts.forEach((p, i) => {
          const dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1;
          const [px, py] = f.toPx([p[0] + (dx / L) * 0.42, p[1] + (dy / L) * 0.42]);
          target.appendChild(s('text', { x: px, y: py + 6, class: 'vertex-label', 'text-anchor': 'middle' }, d.vertexLabels![i]));
        });
      }
      break;
    }
    case 'point': {
      const [x, y] = f.toPx(d.p);
      target.appendChild(icon(d.icon ?? 'dot', x, y, d.icon && d.icon !== 'dot' ? 15 : 14));
      if (d.label && (d.icon === 'dot' || !d.icon)) target.appendChild(s('text', { x: x + 12, y: y - 10, class: 'point-label' }, d.label));
      break;
    }
    case 'cells':
      for (const c of d.cells) {
        const [x, y] = f.toPx([c[0], c[1] + 1]);
        target.appendChild(s('rect', { x: x + 1, y: y + 1, width: U - 2, height: U - 2, rx: 3, fill: COLOURS[d.colour ?? 'gold'], class: 'cell-given' }));
      }
      break;
    case 'mirror': {
      const [x1, y1] = d.axis === 'x' ? f.toPx([d.at, 0]) : f.toPx([0, d.at]);
      const [x2, y2] = d.axis === 'x' ? f.toPx([d.at, f.h]) : f.toPx([f.w, d.at]);
      target.appendChild(s('line', { x1, y1, x2, y2, class: 'mirror-line' }));
      break;
    }
  }
}

export function renderVisual(v: Visual): Element {
  switch (v.kind) {
    case 'grid': {
      const f = gridFrame(v.w, v.h, v.axes, 'picture grid');
      for (const d of v.drawings) drawOnGrid(f, d);
      return wrap(f.svg, 'visual visual-grid');
    }
    case 'clock':
      return wrap(clockSvg(v.mins), 'visual visual-clock');
    case 'shape':
      return wrap(shapeSvg(v).svg, 'visual visual-shape');
    case 'placeValue':
      return placeValueTable(v.value, v.columns);
    case 'lines':
      return wrap(linesSvg(v).svg, 'visual visual-lines');
  }
}

const wrap = (el: Element, cls: string) => h('div', { class: cls }, el);

export function placeValueTable(value: number, columns: number) {
  const digits = String(value).padStart(columns, ' ').split('');
  return h('table', { class: 'pv-table visual', 'aria-label': 'place value chart' },
    h('tr', {}, ...digits.map((_, i) => h('th', {}, PLACE_SHORT[columns - 1 - i]))),
    h('tr', {}, ...digits.map((d) => h('td', {}, d.trim()))),
  );
}

/* ---------- clock ---------- */

export function clockFace(r = 100): SVGGElement {
  const g = s('g', { class: 'clock-face' });
  g.appendChild(s('circle', { r, class: 'clock-rim' }));
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const big = i % 5 === 0;
    const r1 = r * (big ? 0.84 : 0.9), r2 = r * 0.96;
    g.appendChild(s('line', { x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2, class: big ? 'tick-big' : 'tick' }));
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n * Math.PI) / 6;
    g.appendChild(s('text', { x: Math.sin(a) * r * 0.68, y: -Math.cos(a) * r * 0.68 + 8, class: 'clock-num', 'text-anchor': 'middle' }, String(n)));
  }
  return g;
}

export function handPath(len: number, width: number) {
  return `M ${-width / 2} 8 L ${-width / 4} ${-len} L ${width / 4} ${-len} L ${width / 2} 8 Z`;
}

export function clockSvg(mins: number): SVGSVGElement {
  const m = ((mins % 720) + 720) % 720;
  const svg = svgRoot('-110 -110 220 220', { class: 'clock-svg', role: 'img', 'aria-label': 'clock' });
  svg.appendChild(clockFace());
  svg.appendChild(s('path', { d: handPath(52, 10), class: 'hand hand-hour', transform: `rotate(${(m / 60) * 30})` }));
  svg.appendChild(s('path', { d: handPath(80, 6), class: 'hand hand-minute', transform: `rotate(${(m % 60) * 6})` }));
  svg.appendChild(s('circle', { r: 6, class: 'clock-pin' }));
  return svg;
}

/* ---------- shapes ---------- */

export interface ShapeFrame {
  svg: SVGSVGElement;
  map(p: Point): [number, number];
}

export function shapeSvg(v: Extract<Visual, { kind: 'shape' }>, box = { w: 280, h: 220 }): ShapeFrame {
  const all = [...v.pts, ...(v.lines ?? []).flatMap((l) => [l.a, l.b])];
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const pad = 34;
  const k = Math.min((box.w - 2 * pad) / Math.max(1e-6, maxX - minX), (box.h - 2 * pad) / Math.max(1e-6, maxY - minY));
  const ox = (box.w - (maxX - minX) * k) / 2, oy = (box.h - (maxY - minY) * k) / 2;
  const map = (p: Point): [number, number] => [ox + (p[0] - minX) * k, box.h - (oy + (p[1] - minY) * k)];
  const svg = svgRoot(`0 0 ${box.w} ${box.h}`, { class: 'shape-svg', role: 'img', 'aria-label': 'shape' });
  const pts = v.pts.map(map);
  svg.appendChild(s('polygon', { points: pts.map((p) => p.join(',')).join(' '), class: 'poly poly-shape' }));
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  v.sideLabels?.forEach((lab, i) => {
    if (!lab) return;
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1;
    svg.appendChild(s('text', { x: mx + (dx / L) * 18, y: my + (dy / L) * 18 + 5, class: 'side-label', 'text-anchor': 'middle' }, lab));
  });
  v.ticks?.forEach((t, i) => {
    if (!t) return;
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    svg.appendChild(s('line', { x1: mx - nx * 7, y1: my - ny * 7, x2: mx + nx * 7, y2: my + ny * 7, class: 'tick-mark' }));
  });
  v.rightAngles?.forEach((i) => {
    const p = pts[i], a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const u = norm([a[0] - p[0], a[1] - p[1]]), w = norm([b[0] - p[0], b[1] - p[1]]);
    const q = 14;
    svg.appendChild(s('path', { d: `M ${p[0] + u[0] * q} ${p[1] + u[1] * q} L ${p[0] + (u[0] + w[0]) * q} ${p[1] + (u[1] + w[1]) * q} L ${p[0] + w[0] * q} ${p[1] + w[1] * q}`, class: 'right-angle' }));
  });
  for (const l of v.lines ?? []) {
    const [x1, y1] = map(l.a), [x2, y2] = map(l.b);
    svg.appendChild(s('line', { x1, y1, x2, y2, class: l.dashed ? 'fold-line' : 'plain-line' }));
  }
  return { svg, map };
}

const norm = (v: [number, number]): [number, number] => {
  const L = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / L, v[1] / L];
};

export function linesSvg(v: Extract<Visual, { kind: 'lines' }>): ShapeFrame {
  const k = 30;
  const map = (p: Point): [number, number] => [p[0] * k, (v.h - p[1]) * k];
  const svg = svgRoot(`0 0 ${v.w * k} ${v.h * k}`, { class: 'lines-svg', role: 'img', 'aria-label': 'lines' });
  svg.appendChild(s('rect', { x: 0, y: 0, width: v.w * k, height: v.h * k, rx: 10, class: 'lines-bg' }));
  for (const l of v.lines) {
    const [x1, y1] = map(l.a), [x2, y2] = map(l.b);
    svg.appendChild(s('line', { x1, y1, x2, y2, class: 'plank', 'data-plank': l.id }));
    const [lx, ly] = map([l.a[0] - 0.35, l.a[1] + 0.35]);
    svg.appendChild(s('text', { x: lx, y: ly, class: 'plank-label', 'text-anchor': 'middle' }, l.label));
  }
  return { svg, map };
}
