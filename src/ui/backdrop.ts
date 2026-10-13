/**
 * A dark forest scene drawn as one SVG, used behind the 2D task screens instead of flat purple.
 * Kept dark at the top so white question text stays easy to read.
 */
import { makeRng } from '../engine/rng';

function pines(rng: ReturnType<typeof makeRng>, y: number, h: number, count: number, color: string): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = (i / count) * 1700 - 50 + rng.next() * 40;
    const s = h * (0.75 + rng.next() * 0.5);
    const w = s * 0.42;
    const base = y + rng.next() * 30;
    d += `M${x - w} ${base}L${x} ${base - s}L${x + w} ${base}Z`;
    d += `M${x - w * 0.8} ${base - s * 0.35}L${x} ${base - s * 1.1}L${x + w * 0.8} ${base - s * 0.35}Z`;
  }
  return `<path d="${d}" fill="${color}"/>`;
}

export function forestBackdropUrl(): string {
  const rng = makeRng(42);
  let stars = '';
  for (let i = 0; i < 70; i++) stars += `<circle cx="${(rng.next() * 1600).toFixed(0)}" cy="${(rng.next() * 420).toFixed(0)}" r="${rng.chance(0.2) ? 1.8 : 1}" fill="#fff" opacity="${(0.3 + rng.next() * 0.5).toFixed(2)}"/>`;
  let flies = '';
  for (let i = 0; i < 26; i++) flies += `<circle cx="${(rng.next() * 1600).toFixed(0)}" cy="${(620 + rng.next() * 330).toFixed(0)}" r="2.4" fill="#f7ff9c" opacity="${(0.4 + rng.next() * 0.5).toFixed(2)}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice">
<defs>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0f26"/><stop offset="0.55" stop-color="#141c38"/><stop offset="1" stop-color="#14262a"/></linearGradient>
<radialGradient id="m"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.35"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6ff" stop-opacity="0"/><stop offset="1" stop-color="#cfd6ff" stop-opacity="0.09"/></linearGradient>
</defs>
<rect width="1600" height="1000" fill="url(#s)"/>
${stars}
<circle cx="1310" cy="150" r="160" fill="url(#m)"/><circle cx="1310" cy="150" r="46" fill="#f3e6b4" opacity="0.85"/>
${pines(rng, 760, 260, 22, '#16283a')}
<rect y="620" width="1600" height="200" fill="url(#mist)"/>
${pines(rng, 880, 320, 18, '#102028')}
${pines(rng, 1010, 380, 14, '#0a161b')}
${flies}
</svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
