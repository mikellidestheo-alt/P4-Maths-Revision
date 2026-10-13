import { h } from '../dom';
import type { App } from '../app';

let deferred: (Event & { prompt?: () => void }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as Event & { prompt?: () => void };
});

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** A friendly, dismissible "Add to Home Screen" tip (shown once). */
export function installHint(app: App): HTMLElement | null {
  if (standalone() || app.data.flags.installHintSeen) return null;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const text = ios
    ? 'Tip for grown-ups: tap the Share button (□↑), then “Add to Home Screen” so the camp works like an app — even offline.'
    : 'Tip for grown-ups: use your browser menu (⋮) and choose “Add to Home screen” or “Install app” so the camp works like an app — even offline.';
  const close = h('button', { type: 'button', class: 'link-btn', 'data-action': 'install-dismiss' }, 'Got it');
  const box = h('div', { class: 'install-hint', role: 'note' }, h('p', {}, text), h('div', { class: 'row-end' }, close));
  if (deferred && !ios) {
    const inst = h('button', { type: 'button', class: 'btn btn-small' }, 'Install');
    inst.addEventListener('click', () => {
      deferred?.prompt?.();
      deferred = null;
      inst.remove();
    });
    box.querySelector('.row-end')!.prepend(inst);
  }
  close.addEventListener('click', () => {
    app.data.flags.installHintSeen = true;
    app.save();
    box.remove();
  });
  return box;
}
