/** Job pictures for the 3D task stations: the 2D SVG icons drawn onto canvases. */
import { jobIcon } from './art';
import { JOB_ICON } from '../game/nights';

const cache = new Map<string, HTMLCanvasElement>();
let ready: Promise<void> | null = null;

export function preloadIcons(): Promise<void> {
  if (ready) return ready;
  const kinds = [...new Set(Object.values(JOB_ICON))];
  ready = Promise.all(kinds.map((k) => new Promise<void>((resolve) => {
    const svg = jobIcon(k);
    svg.setAttribute('width', '128');
    svg.setAttribute('height', '128');
    // inline styles use CSS variables, which an <img> can't see: swap in real colours
    const src = new XMLSerializer().serializeToString(svg)
      .replace(/var\(--lantern-glow\)/g, '#ffcf66').replace(/var\(--lantern\)/g, '#ffd166').replace(/var\(--gold\)/g, '#ffd166');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      x.fillStyle = 'rgba(20, 16, 50, 0.85)';
      x.beginPath();
      x.arc(64, 64, 62, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#ffd166';
      x.lineWidth = 5;
      x.stroke();
      x.drawImage(img, 16, 16, 96, 96);
      cache.set(k, c);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  }))).then(() => undefined);
  return ready;
}

export function iconCanvas(jobId: string): HTMLCanvasElement | null {
  return cache.get(JOB_ICON[jobId] ?? 'star') ?? null;
}
