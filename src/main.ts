import './styles.css';
import { App } from './ui/app';
import { nav } from './ui/screens';
import { h } from './ui/dom';
import { makeRng } from './engine/rng';
import { runnerScreen } from './ui/screens/runner';
import { TOPICS } from './topics';
import { forestBackdropUrl } from './ui/backdrop';
import { preloadIcons } from './ui/worldIcons';
import { musicState, renderMood } from './game/music';
import type { Mood } from './game/musicScore';

declare const __BUILD_ID__: string;

function boot() {
  document.documentElement.style.setProperty('--forest-bg', forestBackdropUrl());
  void preloadIcons();
  const root = document.getElementById('app')!;
  let app: App;
  try {
    app = new App(root);
  } catch (e) {
    root.textContent = 'Sorry — the camp could not start. Please reload the page.';
    console.error(e);
    return;
  }
  if (app.debug) {
    // test/QA hooks (only with ?bot=1 in the address)
    const w = window as unknown as Record<string, unknown>;
    w.__campApp = app;
    w.__campMusic = {
      state: musicState,
      /** render some music offline: loudness figures plus a 16-bit WAV (base64) to listen to */
      render: async (mood: Mood, seconds = 20, seed = 1) => {
        const rate = 22050;
        const x = await renderMood(mood, seconds, seed, rate);
        let peak = 0, sum = 0;
        for (const v of x) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
        return { peak, rms: Math.sqrt(sum / x.length), wav: wavBase64(x, rate) };
      },
    };
    w.__campPreview = (topicId: string, kind: string, tier: 1 | 2 | 3, seed = 1) => {
      const rng = makeRng(seed);
      app.show(runnerScreen(app, {
        mode: 'job', title: `Preview ${topicId} ${kind}`, total: 1, done: 0, friendId: 'bramble',
        next: () => TOPICS[topicId].generate(rng, tier, { kind }),
        onResult: () => 0, onFinish: () => nav.home(app), onExit: () => nav.home(app),
      }));
    };
  }
  document.documentElement.dataset.build = __BUILD_ID__;
  nav.start(app);
  registerSW();
}

/** Offline support. New deploys: the page always asks the network first for the HTML, so a fresh
 *  version loads whenever there is a connection; a toast offers a refresh if one arrives mid-session. */
function registerSW() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const base = import.meta.env.BASE_URL;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: 'none' })
    .then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    showUpdateToast();
  });
}

function showUpdateToast() {
  if (document.querySelector('.toast')) return;
  const btn = h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'refresh' }, 'Refresh');
  const later = h('button', { type: 'button', class: 'link-btn' }, 'Later');
  const t = h('div', { class: 'toast', role: 'status' }, h('span', {}, '✨ A new version of the camp is ready.'), btn, later);
  btn.addEventListener('click', () => location.reload());
  later.addEventListener('click', () => t.remove());
  document.body.appendChild(t);
}

boot();

/** test helper: mono 16-bit WAV as base64 */
function wavBase64(x: Float32Array, rate: number): string {
  const b = new DataView(new ArrayBuffer(44 + x.length * 2));
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); b.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVEfmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
  str(36, 'data'); b.setUint32(40, x.length * 2, true);
  x.forEach((v, i) => b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  let s = '';
  const bytes = new Uint8Array(b.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
