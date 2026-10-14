import { h, s } from './dom';

/**
 * ⛶ Full screen toggle (start screen and top bar). Uses the Fullscreen API, with the webkit prefix for
 * older Safari / iPad. iPhone Safari has no full screen for pages, so there the button is left out
 * (adding the game to the home screen gives the same effect).
 */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as FsDoc;

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  return !!(doc().fullscreenElement || doc().webkitFullscreenElement);
}

export async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      await (doc().exitFullscreen ? doc().exitFullscreen() : doc().webkitExitFullscreen?.());
    } else {
      const el = document.documentElement as FsEl;
      await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.());
    }
  } catch {
    /* the browser said no (e.g. not allowed here): nothing else to do */
  }
  sync();
}

/** expand / shrink corners */
function icon(on: boolean): SVGSVGElement {
  const d = on
    ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'
    : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
  return s('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': 'true', class: 'fs-icon' },
    s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function show(b: HTMLElement) {
  const on = isFullscreen();
  b.replaceChildren(icon(on));
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
  b.title = on ? 'Leave full screen' : 'Full screen';
}

/** keep every full screen button right, however full screen was left (Esc, swipe, back button) */
function sync() {
  document.querySelectorAll<HTMLElement>('[data-action="fullscreen"]').forEach(show);
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

export function fullscreenButton(): HTMLElement | null {
  if (!fullscreenSupported()) return null;
  const b = h('button', { type: 'button', class: 'icon-btn icon-btn-svg', 'data-action': 'fullscreen' });
  b.addEventListener('click', () => void toggleFullscreen());
  show(b);
  return b;
}
