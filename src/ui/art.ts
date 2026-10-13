/** Original blocky, low-poly art drawn with SVG. No external assets. */
import { s, svgRoot } from './dom';
import { makeRng } from '../engine/rng';
import { starPath } from './visuals';
import type { Spook } from '../config/game';

type G = SVGGElement;

/* ---------------- trees, tent, fire ---------------- */

export function pine(x: number, y: number, k = 1, shade = 0): G {
  const cols = ['#1d3b3a', '#173130', '#122826', '#0e1f22'];
  const c = cols[Math.min(3, shade)];
  const g = s('g', { transform: `translate(${x} ${y}) scale(${k})`, class: 'pine' });
  g.append(
    s('rect', { x: -6, y: -20, width: 12, height: 22, fill: '#3b2618' }),
    s('polygon', { points: '-46,-18 46,-18 0,-70', fill: c }),
    s('polygon', { points: '-38,-50 38,-50 0,-100', fill: c }),
    s('polygon', { points: '-28,-80 28,-80 0,-124', fill: c }),
    s('polygon', { points: '0,-124 28,-80 12,-80', fill: '#ffffff', opacity: 0.05 }),
  );
  return g;
}

export function tent(x: number, y: number, k = 1): G {
  return s('g', { transform: `translate(${x} ${y}) scale(${k})`, class: 'tent' },
    s('polygon', { points: '-80,0 80,0 0,-110', fill: '#d9692f' }),
    s('polygon', { points: '0,-110 80,0 40,0', fill: '#b5521f' }),
    s('polygon', { points: '-22,0 22,0 0,-56', fill: '#4a2412' }),
    s('polygon', { points: '-6,0 6,0 0,-56', fill: '#ffcf6b', opacity: 0.35, class: 'tent-glow' }),
    s('line', { x1: 0, y1: -110, x2: 0, y2: -124, stroke: '#7a3a14', 'stroke-width': 4 }),
  );
}

export function campfire(x: number, y: number, k = 1): G {
  return s('g', { transform: `translate(${x} ${y}) scale(${k})`, class: 'campfire' },
    s('ellipse', { cx: 0, cy: -20, rx: 90, ry: 60, fill: 'url(#fireGlow)', class: 'fire-glow' }),
    s('rect', { x: -38, y: -8, width: 76, height: 12, rx: 5, fill: '#6b3d1e', transform: 'rotate(-12)' }),
    s('rect', { x: -38, y: -8, width: 76, height: 12, rx: 5, fill: '#5a3218', transform: 'rotate(12)' }),
    s('polygon', { points: '-24,-6 24,-6 0,-62', fill: '#ff8a2a', class: 'flame flame-1' }),
    s('polygon', { points: '-15,-6 15,-6 2,-44', fill: '#ffc34d', class: 'flame flame-2' }),
    s('polygon', { points: '-7,-6 7,-6 -2,-26', fill: '#fff1b8', class: 'flame flame-3' }),
    ...[-30, -10, 12, 30].map((sx, i) => s('rect', { x: sx - 7, y: 2, width: 14, height: 9, rx: 3, fill: i % 2 ? '#6d6a7a' : '#5a5768' })),
  );
}

export function lanternPost(x: number, y: number, k = 1): G {
  return s('g', { transform: `translate(${x} ${y}) scale(${k})`, class: 'lantern-post' },
    s('rect', { x: -3, y: -120, width: 6, height: 120, fill: '#4b3020' }),
    s('rect', { x: -3, y: -120, width: 34, height: 6, fill: '#4b3020' }),
    s('circle', { cx: 28, cy: -88, r: 30, fill: 'var(--lantern-glow)', opacity: 0.35, class: 'lantern-halo' }),
    s('rect', { x: 18, y: -100, width: 20, height: 26, rx: 4, fill: 'var(--lantern)', stroke: '#5a3a10', 'stroke-width': 3 }),
    s('line', { x1: 28, y1: -114, x2: 28, y2: -100, stroke: '#5a3a10', 'stroke-width': 2 }),
  );
}

/* ---------------- characters ---------------- */

export function wren(outfit?: string, k = 1): G {
  const g = s('g', { class: 'wren', transform: `scale(${k})` });
  g.append(
    s('ellipse', { cx: 0, cy: 0, rx: 26, ry: 6, fill: '#000', opacity: 0.25 }),
    s('rect', { x: -16, y: -30, width: 12, height: 30, fill: '#3a3550' }),
    s('rect', { x: 4, y: -30, width: 12, height: 30, fill: '#3a3550' }),
    s('rect', { x: -22, y: -72, width: 44, height: 46, rx: 6, fill: '#3f7d5a' }),
    s('rect', { x: -22, y: -50, width: 44, height: 6, fill: '#2f5e43' }),
    s('rect', { x: -30, y: -70, width: 10, height: 34, rx: 4, fill: '#3f7d5a' }),
    s('rect', { x: 20, y: -70, width: 10, height: 30, rx: 4, fill: '#3f7d5a' }),
    s('rect', { x: -19, y: -110, width: 38, height: 38, rx: 6, fill: '#f0c39a' }),
    s('rect', { x: -19, y: -112, width: 38, height: 12, rx: 4, fill: '#6b3b22' }),
    s('rect', { x: -10, y: -96, width: 6, height: 7, rx: 2, fill: '#2a1e2e' }),
    s('rect', { x: 4, y: -96, width: 6, height: 7, rx: 2, fill: '#2a1e2e' }),
    s('path', { d: 'M -7 -83 Q 0 -78 7 -83', stroke: '#8a3b2b', 'stroke-width': 2.5, fill: 'none' }),
    s('circle', { cx: -12, cy: -84, r: 3, fill: '#f29a8a', opacity: 0.7 }),
    s('circle', { cx: 12, cy: -84, r: 3, fill: '#f29a8a', opacity: 0.7 }),
    // lantern in hand
    s('line', { x1: 25, y1: -40, x2: 25, y2: -30, stroke: '#5a3a10', 'stroke-width': 2 }),
    s('circle', { cx: 25, cy: -20, r: 16, fill: 'var(--lantern-glow)', opacity: 0.4, class: 'lantern-halo' }),
    s('rect', { x: 18, y: -30, width: 14, height: 18, rx: 3, fill: 'var(--lantern)', stroke: '#5a3a10', 'stroke-width': 2 }),
  );
  // hats
  if (outfit === 'outfit-woolly') {
    g.append(s('path', { d: 'M -21 -108 Q 0 -140 21 -108 Z', fill: '#d8434f' }), s('rect', { x: -22, y: -112, width: 44, height: 7, rx: 3, fill: '#f2f2f2' }), s('circle', { cx: 0, cy: -132, r: 6, fill: '#f2f2f2' }));
  } else if (outfit === 'outfit-explorer') {
    g.append(s('ellipse', { cx: 0, cy: -110, rx: 30, ry: 6, fill: '#c9a465' }), s('rect', { x: -16, y: -128, width: 32, height: 18, rx: 6, fill: '#d8b878' }), s('rect', { x: -16, y: -114, width: 32, height: 4, fill: '#6b4a22' }));
  } else if (outfit === 'outfit-crown') {
    for (let i = 0; i < 5; i++) g.append(s('circle', { cx: -16 + i * 8, cy: -113, r: 5, fill: ['#ff8fb1', '#ffd36b', '#9be38b', '#8fc7ff', '#ff8fb1'][i] }));
  } else {
    g.append(s('ellipse', { cx: 0, cy: -110, rx: 28, ry: 5, fill: '#7a5a2e' }), s('rect', { x: -14, y: -126, width: 28, height: 16, rx: 3, fill: '#8d6a36' }));
  }
  return g;
}

interface FriendArt { body: G; hatY: number; bowY: number }

function eyes(y: number, gap: number, r = 4): SVGElement[] {
  return [
    s('circle', { cx: -gap, cy: y, r, fill: '#20152a' }), s('circle', { cx: gap, cy: y, r, fill: '#20152a' }),
    s('circle', { cx: -gap + r * 0.35, cy: y - r * 0.35, r: r * 0.35, fill: '#fff' }), s('circle', { cx: gap + r * 0.35, cy: y - r * 0.35, r: r * 0.35, fill: '#fff' }),
  ];
}

function friendArt(id: string): FriendArt {
  const g = s('g', {});
  switch (id) {
    case 'bramble': {
      let spikes = 'M -44 -4 ';
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        const r = i % 2 ? 54 : 44;
        spikes += `L ${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r - 4).toFixed(1)} `;
      }
      g.append(
        s('path', { d: spikes + 'Z', fill: '#5b3a24' }),
        s('ellipse', { cx: 6, cy: -18, rx: 30, ry: 22, fill: '#d9a877' }),
        ...eyes(-24, 10),
        s('circle', { cx: 32, cy: -16, r: 5, fill: '#20152a' }),
        s('path', { d: 'M 4 -10 Q 12 -4 20 -10', stroke: '#6b3a2a', 'stroke-width': 2.5, fill: 'none' }),
        s('rect', { x: -26, y: -6, width: 10, height: 8, rx: 3, fill: '#3b2618' }), s('rect', { x: 14, y: -6, width: 10, height: 8, rx: 3, fill: '#3b2618' }),
      );
      return { body: g, hatY: -52, bowY: -2 };
    }
    case 'tock':
      g.append(
        s('ellipse', { cx: 0, cy: -40, rx: 32, ry: 40, fill: '#8b6b4e' }),
        s('ellipse', { cx: 0, cy: -30, rx: 20, ry: 26, fill: '#d8c19b' }),
        s('polygon', { points: '-30,-70 -18,-76 -24,-92', fill: '#8b6b4e' }), s('polygon', { points: '30,-70 18,-76 24,-92', fill: '#8b6b4e' }),
        s('circle', { cx: -13, cy: -54, r: 12, fill: '#fff4d6' }), s('circle', { cx: 13, cy: -54, r: 12, fill: '#fff4d6' }),
        ...eyes(-54, 13, 6),
        s('polygon', { points: '-5,-44 5,-44 0,-34', fill: '#f2a93b' }),
        s('ellipse', { cx: -30, cy: -36, rx: 8, ry: 20, fill: '#6f533c' }), s('ellipse', { cx: 30, cy: -36, rx: 8, ry: 20, fill: '#6f533c' }),
      );
      return { body: g, hatY: -82, bowY: -30 };
    case 'juniper':
      g.append(
        s('path', { d: 'M 22 -20 Q 70 -30 62 -62 Q 52 -40 24 -34 Z', fill: '#e07a36' }),
        s('path', { d: 'M 62 -62 Q 66 -50 56 -46 Q 54 -56 62 -62 Z', fill: '#fff' }),
        s('rect', { x: -26, y: -46, width: 52, height: 44, rx: 12, fill: '#e07a36' }),
        s('ellipse', { cx: 0, cy: -20, rx: 16, ry: 16, fill: '#fbe3c8' }),
        s('polygon', { points: '-30,-56 30,-56 0,-20', fill: '#e8843f' }),
        s('polygon', { points: '-30,-56 -18,-56 -26,-80', fill: '#e07a36' }), s('polygon', { points: '30,-56 18,-56 26,-80', fill: '#e07a36' }),
        s('polygon', { points: '-27,-60 -21,-60 -25,-72', fill: '#3a2018' }), s('polygon', { points: '27,-60 21,-60 25,-72', fill: '#3a2018' }),
        s('polygon', { points: '-12,-40 12,-40 0,-24', fill: '#fbe3c8' }),
        ...eyes(-46, 10),
        s('circle', { cx: 0, cy: -26, r: 4, fill: '#20152a' }),
      );
      return { body: g, hatY: -60, bowY: -12 };
    case 'ember':
      g.append(
        s('circle', { cx: 0, cy: -34, r: 34, fill: 'url(#emberGlow)', class: 'ember-glow' }),
        s('ellipse', { cx: -16, cy: -54, rx: 16, ry: 10, fill: '#cfe8ff', opacity: 0.8, transform: 'rotate(-25 -16 -54)', class: 'wing-l' }),
        s('ellipse', { cx: 16, cy: -54, rx: 16, ry: 10, fill: '#cfe8ff', opacity: 0.8, transform: 'rotate(25 16 -54)', class: 'wing-r' }),
        s('ellipse', { cx: 0, cy: -24, rx: 13, ry: 16, fill: '#fff07a' }),
        s('ellipse', { cx: 0, cy: -46, rx: 14, ry: 12, fill: '#3b3a5a' }),
        ...eyes(-48, 6, 3.5),
        s('line', { x1: -5, y1: -57, x2: -12, y2: -70, stroke: '#3b3a5a', 'stroke-width': 2 }), s('line', { x1: 5, y1: -57, x2: 12, y2: -70, stroke: '#3b3a5a', 'stroke-width': 2 }),
      );
      return { body: g, hatY: -58, bowY: -36 };
    case 'lumi':
      g.append(
        s('path', { d: 'M 0 -40 C -40 -90 -70 -60 -56 -30 C -46 -8 -18 -20 0 -34 Z', fill: '#b9a4e8' }),
        s('path', { d: 'M 0 -40 C 40 -90 70 -60 56 -30 C 46 -8 18 -20 0 -34 Z', fill: '#b9a4e8' }),
        s('circle', { cx: -32, cy: -50, r: 9, fill: '#f6e27a' }), s('circle', { cx: 32, cy: -50, r: 9, fill: '#f6e27a' }),
        s('circle', { cx: -34, cy: -28, r: 5, fill: '#8e78d4' }), s('circle', { cx: 34, cy: -28, r: 5, fill: '#8e78d4' }),
        s('ellipse', { cx: 0, cy: -30, rx: 8, ry: 22, fill: '#efe4d0' }),
        s('circle', { cx: 0, cy: -54, r: 9, fill: '#efe4d0' }),
        ...eyes(-55, 4, 2.6),
        s('path', { d: 'M -3 -62 Q -12 -78 -18 -74', stroke: '#6b5a8e', 'stroke-width': 2, fill: 'none' }), s('path', { d: 'M 3 -62 Q 12 -78 18 -74', stroke: '#6b5a8e', 'stroke-width': 2, fill: 'none' }),
      );
      return { body: g, hatY: -62, bowY: -44 };
    default: // ripple the otter
      g.append(
        s('path', { d: 'M 24 -10 Q 60 -6 66 -24 Q 50 -16 26 -22 Z', fill: '#7a5134' }),
        s('rect', { x: -26, y: -54, width: 52, height: 54, rx: 22, fill: '#8a5c3b' }),
        s('ellipse', { cx: 0, cy: -24, rx: 16, ry: 20, fill: '#d9b38c' }),
        s('circle', { cx: 0, cy: -64, r: 24, fill: '#8a5c3b' }),
        s('circle', { cx: -20, cy: -80, r: 6, fill: '#7a5134' }), s('circle', { cx: 20, cy: -80, r: 6, fill: '#7a5134' }),
        s('ellipse', { cx: 0, cy: -56, rx: 14, ry: 10, fill: '#d9b38c' }),
        ...eyes(-68, 9),
        s('ellipse', { cx: 0, cy: -60, rx: 5, ry: 3.5, fill: '#20152a' }),
        s('line', { x1: -6, y1: -56, x2: -22, y2: -58, stroke: '#3a2a20', 'stroke-width': 1.5 }), s('line', { x1: 6, y1: -56, x2: 22, y2: -58, stroke: '#3a2a20', 'stroke-width': 1.5 }),
      );
      return { body: g, hatY: -86, bowY: -40 };
  }
}

export function friend(id: string, opts: { accessory?: string; silhouette?: boolean; k?: number } = {}): G {
  const art = friendArt(id);
  const g = s('g', { class: `friend friend-${id} ${opts.silhouette ? 'silhouette' : ''}`, transform: `scale(${opts.k ?? 1})` });
  g.append(s('ellipse', { cx: 0, cy: 0, rx: 34, ry: 6, fill: '#000', opacity: 0.25 }), art.body);
  if (!opts.silhouette && opts.accessory === 'friends-party') {
    g.append(s('polygon', { points: `-12,${art.hatY} 12,${art.hatY} 0,${art.hatY - 30}`, fill: '#ff6fa8' }), s('circle', { cx: 0, cy: art.hatY - 30, r: 4, fill: '#ffe066' }));
  }
  if (!opts.silhouette && opts.accessory === 'friends-bows') {
    g.append(s('polygon', { points: `-14,${art.bowY - 7} 0,${art.bowY} -14,${art.bowY + 7}`, fill: '#e2475b' }), s('polygon', { points: `14,${art.bowY - 7} 0,${art.bowY} 14,${art.bowY + 7}`, fill: '#e2475b' }), s('circle', { cx: 0, cy: art.bowY, r: 3.5, fill: '#b52a3d' }));
  }
  return g;
}

export function friendSvg(id: string, opts: { accessory?: string; silhouette?: boolean } = {}, label = id): SVGSVGElement {
  const svg = svgRoot('-80 -110 160 120', { class: 'friend-svg', role: 'img', 'aria-label': label });
  svg.append(defs(), friend(id, opts));
  return svg;
}

export function wrenSvg(outfit?: string): SVGSVGElement {
  const svg = svgRoot('-45 -145 90 150', { class: 'wren-svg', role: 'img', 'aria-label': 'Wren the camp guide' });
  svg.append(defs(), wren(outfit));
  return svg;
}

/* ---------------- shared defs ---------------- */

export function defs(): SVGDefsElement {
  return s('defs', {},
    s('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: '0', 'stop-color': 'var(--sky-top)' }),
      s('stop', { offset: '0.6', 'stop-color': 'var(--sky-mid)' }),
      s('stop', { offset: '1', 'stop-color': 'var(--sky-low)' })),
    s('radialGradient', { id: 'fireGlow' },
      s('stop', { offset: '0', 'stop-color': '#ffb347', 'stop-opacity': '0.55' }),
      s('stop', { offset: '1', 'stop-color': '#ffb347', 'stop-opacity': '0' })),
    s('radialGradient', { id: 'emberGlow' },
      s('stop', { offset: '0', 'stop-color': '#fff7a0', 'stop-opacity': '0.8' }),
      s('stop', { offset: '1', 'stop-color': '#fff7a0', 'stop-opacity': '0' })),
    s('radialGradient', { id: 'moonGlow' },
      s('stop', { offset: '0', 'stop-color': '#fff6d5', 'stop-opacity': '0.5' }),
      s('stop', { offset: '1', 'stop-color': '#fff6d5', 'stop-opacity': '0' })),
  );
}

/* ---------------- the camp scene ---------------- */

export interface SceneOpts {
  spook: Spook;
  decor: string[];
  outfit?: string;
  showWren?: boolean;
  dawn?: boolean;
  friends?: string[];
  friendAccessory?: string;
  fireBig?: boolean;
}

export function campScene(o: SceneOpts): SVGSVGElement {
  const rng = makeRng(7);
  const svg = svgRoot('0 0 800 500', { class: `scene ${o.dawn ? 'scene-dawn' : ''}`, preserveAspectRatio: 'xMidYMax slice', role: 'img', 'aria-label': o.dawn ? 'The camp at dawn' : 'The camp at night' });
  svg.appendChild(defs());
  svg.appendChild(s('rect', { x: 0, y: 0, width: 800, height: 500, fill: 'url(#sky)' }));
  // stars
  const stars = s('g', { class: 'stars' });
  for (let i = 0; i < 60; i++) stars.appendChild(s('circle', { cx: rng.int(0, 800), cy: rng.int(0, 260), r: rng.chance(0.2) ? 2 : 1.2, class: `star twinkle-${i % 3}` }));
  svg.appendChild(stars);
  // moon or sun
  if (o.dawn) {
    svg.append(s('circle', { cx: 400, cy: 330, r: 150, fill: 'url(#moonGlow)' }), s('circle', { cx: 400, cy: 330, r: 70, fill: '#ffe08a', class: 'sun' }));
  } else {
    svg.append(s('circle', { cx: 660, cy: 90, r: 80, fill: 'url(#moonGlow)' }), s('circle', { cx: 660, cy: 90, r: 34, fill: '#fff3c4' }), s('circle', { cx: 648, cy: 82, r: 6, fill: '#efe0a8' }), s('circle', { cx: 672, cy: 100, r: 4, fill: '#efe0a8' }));
  }
  // hills
  svg.append(
    s('path', { d: 'M0 330 Q 120 260 240 310 T 480 300 T 800 290 L 800 500 L 0 500 Z', fill: 'var(--hill-far)' }),
    s('path', { d: 'M0 370 Q 160 320 330 360 T 640 350 T 800 360 L 800 500 L 0 500 Z', fill: 'var(--hill-near)' }),
  );
  // back trees
  const back = s('g', { class: 'trees-back' });
  [30, 110, 190, 610, 690, 770].forEach((x, i) => back.appendChild(pine(x, 360 + (i % 2) * 6, 0.9, 2)));
  svg.appendChild(back);
  // glowing eyes (friendly blinking pairs) – more of them when spookier
  const eyeCount = o.spook === 'cosy' ? 1 : o.spook === 'mild' ? 3 : 6;
  const eyeSpots: [number, number][] = [[110, 300], [700, 296], [196, 318], [612, 320], [38, 322], [770, 310]];
  const eyesG = s('g', { class: 'forest-eyes' });
  for (let i = 0; i < eyeCount && !o.dawn; i++) {
    const [x, y] = eyeSpots[i];
    eyesG.appendChild(s('g', { class: `eye-pair blink-${i % 3}`, transform: `translate(${x} ${y})` },
      s('ellipse', { cx: -6, cy: 0, rx: 4, ry: 3, fill: '#ffe680' }), s('ellipse', { cx: 6, cy: 0, rx: 4, ry: 3, fill: '#ffe680' })));
  }
  svg.appendChild(eyesG);
  // ground
  svg.appendChild(s('ellipse', { cx: 400, cy: 470, rx: 470, ry: 90, fill: 'var(--ground)' }));
  // decor behind
  if (o.decor.includes('decor-lights')) {
    const g = s('g', { class: 'decor-lights' });
    g.appendChild(s('path', { d: 'M 60 260 Q 200 320 330 280', stroke: '#2b2b3a', 'stroke-width': 2, fill: 'none' }));
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * 200 + t * t * 330;
      const y = (1 - t) * (1 - t) * 260 + 2 * (1 - t) * t * 320 + t * t * 280;
      g.appendChild(s('circle', { cx: x, cy: y + 4, r: 5, fill: ['#ff7aa2', '#ffe066', '#7ad7ff', '#9cff8a'][i % 4], class: `twinkle-${i % 3}` }));
    }
    svg.appendChild(g);
  }
  // tent
  svg.appendChild(tent(250, 420, 1));
  if (o.decor.includes('decor-bunting')) {
    const g = s('g', { class: 'decor-bunting' });
    g.appendChild(s('path', { d: 'M 170 330 L 250 300 L 330 330', stroke: '#3a2a20', 'stroke-width': 2, fill: 'none' }));
    const flags: [number, number][] = [[185, 325], [205, 318], [225, 310], [245, 303], [265, 306], [285, 313], [305, 320]];
    flags.forEach(([x, y], i) => g.appendChild(s('polygon', { points: `${x - 7},${y} ${x + 7},${y} ${x},${y + 14}`, fill: ['#e2475b', '#ffd23f', '#3fb6e2', '#7ad36b'][i % 4] })));
    svg.appendChild(g);
  }
  if (o.decor.includes('decor-flag')) {
    svg.append(s('line', { x1: 340, y1: 430, x2: 340, y2: 330, stroke: '#ccc', 'stroke-width': 4 }), s('rect', { x: 340, y: 330, width: 50, height: 32, fill: '#3b4fa8' }), s('path', { d: starPath(10, 4.5), fill: '#ffd23f', transform: 'translate(365 346)' }));
  }
  if (o.decor.includes('decor-hammock')) {
    svg.append(pine(560, 430, 0.8, 1), s('path', { d: 'M 600 360 Q 650 400 700 360', stroke: '#e9c46a', 'stroke-width': 8, fill: 'none' }));
  }
  // lantern post
  svg.appendChild(lanternPost(150, 440, 1));
  // fire
  svg.appendChild(campfire(430, 440, o.fireBig ? 1.25 : 1));
  if (o.decor.includes('decor-rug')) {
    const g = s('g', { class: 'decor-rug' });
    ['#c0392b', '#f1c40f', '#2e86c1', '#c0392b'].forEach((c, i) => g.appendChild(s('rect', { x: 470 + i * 0, y: 456 + i * 7, width: 110, height: 7, fill: c, transform: 'skewX(-20)' })));
    svg.appendChild(g);
  }
  if (o.decor.includes('decor-pumpkin')) {
    svg.appendChild(s('g', { transform: 'translate(330 455)', class: 'decor-pumpkin' },
      s('ellipse', { cx: 0, cy: 0, rx: 22, ry: 17, fill: '#f08a24' }), s('rect', { x: -3, y: -24, width: 6, height: 9, fill: '#4a7a2c' }),
      s('polygon', { points: '-11,-5 -5,-5 -8,-11', fill: '#ffe680' }), s('polygon', { points: '11,-5 5,-5 8,-11', fill: '#ffe680' }),
      s('path', { d: 'M -10 4 Q 0 12 10 4', stroke: '#ffe680', 'stroke-width': 3, fill: 'none' })));
  }
  if (o.decor.includes('decor-mushrooms')) {
    const g = s('g', { class: 'decor-mushrooms' });
    [[70, 470], [95, 480], [720, 474], [745, 466]].forEach(([x, y], i) => g.appendChild(s('g', { transform: `translate(${x} ${y})` },
      s('rect', { x: -3, y: -10, width: 6, height: 10, fill: '#f3e9d2' }), s('path', { d: 'M -11 -9 Q 0 -24 11 -9 Z', fill: i % 2 ? '#7ad7ff' : '#b28cff', class: 'glow-shroom' }))));
    svg.appendChild(g);
  }
  // front trees
  svg.append(pine(-10, 500, 1.4, 0), pine(820, 500, 1.4, 0));
  // friends (rescued)
  if (o.friends?.length) {
    const spots: [number, number][] = [[520, 470], [585, 462], [650, 474], [360, 482], [300, 488], [700, 486]];
    o.friends.forEach((id, i) => {
      const [x, y] = spots[i % spots.length];
      const fg = s('g', { transform: `translate(${x} ${y}) scale(0.55)` }, friend(id, { accessory: o.friendAccessory }));
      svg.appendChild(fg);
    });
  }
  if (o.showWren !== false) svg.appendChild(s('g', { transform: 'translate(520 470) scale(0.9)' }, wren(o.outfit)));
  // fireflies + mist
  const ff = s('g', { class: 'fireflies' });
  for (let i = 0; i < 12; i++) ff.appendChild(s('circle', { cx: rng.int(40, 760), cy: rng.int(250, 440), r: 2.5, class: `firefly ff-${i % 4}` }));
  svg.appendChild(ff);
  const mistOpacity = o.dawn ? 0.1 : o.spook === 'cosy' ? 0.18 : o.spook === 'mild' ? 0.28 : 0.38;
  svg.appendChild(s('g', { class: 'mist', opacity: mistOpacity },
    s('ellipse', { cx: 200, cy: 430, rx: 300, ry: 26, fill: '#cfd6ff', class: 'mist-a' }),
    s('ellipse', { cx: 620, cy: 455, rx: 320, ry: 22, fill: '#cfd6ff', class: 'mist-b' })));
  return svg;
}

/* ---------------- small icons for job signs ---------------- */

export function jobIcon(kind: string): SVGSVGElement {
  const svg = svgRoot('-24 -24 48 48', { class: 'job-icon', 'aria-hidden': 'true' });
  const add = (...els: SVGElement[]) => svg.append(...els);
  switch (kind) {
    case 'crate': add(s('rect', { x: -16, y: -14, width: 32, height: 28, rx: 3, fill: '#b07a45' }), s('path', { d: 'M -16 -14 L 16 14 M 16 -14 L -16 14', stroke: '#6b4422', 'stroke-width': 3 })); break;
    case 'sign': add(s('rect', { x: -2, y: -6, width: 4, height: 24, fill: '#6b4422' }), s('polygon', { points: '-16,-18 12,-18 18,-11 12,-4 -16,-4', fill: '#c99a5b' })); break;
    case 'shelf': add(...[-14, 0, 14].map((y) => s('rect', { x: -18, y, width: 36, height: 4, fill: '#8b5e34' })), s('rect', { x: -14, y: -10, width: 8, height: 10, fill: '#e07a5f' }), s('rect', { x: 2, y: 4, width: 10, height: 10, fill: '#81b29a' })); break;
    case 'pot': add(s('path', { d: 'M -16 -6 L 16 -6 L 13 14 L -13 14 Z', fill: '#4a4e69' }), s('rect', { x: -19, y: -10, width: 38, height: 5, rx: 2, fill: '#6c6f8a' }), s('path', { d: 'M -6 -14 Q -2 -20 -6 -24 M 4 -14 Q 8 -20 4 -24', stroke: '#ddd', 'stroke-width': 2, fill: 'none' })); break;
    case 'gate': add(s('rect', { x: -18, y: -16, width: 8, height: 32, fill: '#8d8aa0' }), s('rect', { x: 10, y: -16, width: 8, height: 32, fill: '#8d8aa0' }), s('path', { d: 'M -18 -16 Q 0 -30 18 -16', stroke: '#8d8aa0', 'stroke-width': 6, fill: 'none' })); break;
    case 'clock': add(s('circle', { r: 17, fill: '#fff4d6', stroke: '#6b4422', 'stroke-width': 3 }), s('path', { d: 'M 0 0 L 0 -11 M 0 0 L 8 4', stroke: '#2a1e2e', 'stroke-width': 3 })); break;
    case 'fence': add(...[-14, -2, 10].map((x) => s('rect', { x, y: -14, width: 6, height: 28, fill: '#a0703e' })), s('rect', { x: -18, y: -6, width: 36, height: 4, fill: '#7a5230' }), s('rect', { x: -18, y: 4, width: 36, height: 4, fill: '#7a5230' })); break;
    case 'map': add(s('polygon', { points: '-18,-12 -6,-16 6,-12 18,-16 18,12 6,16 -6,12 -18,16', fill: '#f2e3b3' }), s('path', { d: 'M -12 6 Q -2 -6 10 -2', stroke: '#c0392b', 'stroke-width': 2, 'stroke-dasharray': '3 3', fill: 'none' }), s('path', { d: 'M 8 -6 L 14 0 M 14 -6 L 8 0', stroke: '#c0392b', 'stroke-width': 2.5 })); break;
    case 'fire': add(s('polygon', { points: '-12,12 12,12 0,-18', fill: '#ff8a2a' }), s('polygon', { points: '-6,12 6,12 1,-6', fill: '#ffe066' })); break;
    case 'basket': add(s('path', { d: 'M -17 -4 L 17 -4 L 12 14 L -12 14 Z', fill: '#c48a4a' }), s('path', { d: 'M -12 -4 Q 0 -22 12 -4', stroke: '#8b5e34', 'stroke-width': 3, fill: 'none' }), s('circle', { cx: -5, cy: -6, r: 4, fill: '#d64545' }), s('circle', { cx: 4, cy: -7, r: 4, fill: '#6a4cc2' })); break;
    case 'book': add(s('rect', { x: -17, y: -14, width: 34, height: 28, rx: 3, fill: '#3d5a80' }), s('rect', { x: -13, y: -10, width: 26, height: 20, fill: '#f2e9d8' }), ...[-5, 0, 5].map((y) => s('line', { x1: -9, y1: y, x2: 9, y2: y, stroke: '#9a8f7a', 'stroke-width': 1.5 }))); break;
    case 'tent': add(s('polygon', { points: '-18,14 18,14 0,-16', fill: '#e07a3f' }), s('polygon', { points: '-5,14 5,14 0,-2', fill: '#5b2a10' })); break;
    case 'lantern': add(s('circle', { r: 18, fill: 'var(--lantern-glow)', opacity: 0.35 }), s('rect', { x: -8, y: -10, width: 16, height: 22, rx: 3, fill: 'var(--lantern)', stroke: '#6b4a12', 'stroke-width': 2 })); break;
    case 'mirror': add(s('ellipse', { rx: 13, ry: 17, fill: '#bfe3ff', stroke: '#8a6a3a', 'stroke-width': 4 }), s('line', { x1: -5, y1: -8, x2: 3, y2: -12, stroke: '#fff', 'stroke-width': 3 })); break;
    case 'sun': add(s('circle', { r: 10, fill: '#ffcf66' }), ...Array.from({ length: 8 }, (_, i) => s('line', { x1: Math.cos((i * Math.PI) / 4) * 14, y1: Math.sin((i * Math.PI) / 4) * 14, x2: Math.cos((i * Math.PI) / 4) * 20, y2: Math.sin((i * Math.PI) / 4) * 20, stroke: '#ffcf66', 'stroke-width': 3 }))); break;
    default: add(s('path', { d: starPath(18, 8), fill: 'var(--gold)' }));
  }
  return svg;
}

export function moonIcon(state: 'locked' | 'next' | 'done', n: number): SVGSVGElement {
  const svg = svgRoot('-20 -20 40 40', { class: `moon moon-${state}`, 'aria-hidden': 'true' });
  if (state === 'done') svg.append(s('circle', { r: 16, class: 'moon-full' }));
  else if (state === 'next') svg.append(s('circle', { r: 16, class: 'moon-ring' }), s('path', { d: 'M 0 -16 A 16 16 0 0 1 0 16 A 9 16 0 0 0 0 -16', class: 'moon-half' }));
  else svg.append(s('circle', { r: 16, class: 'moon-ring' }));
  svg.append(s('text', { y: 5, 'text-anchor': 'middle', class: 'moon-num' }, String(n)));
  return svg;
}
