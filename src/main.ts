import './styles.css';
import { App } from './ui/app';
import { nav } from './ui/screens';
import { h } from './ui/dom';
import { makeRng } from './engine/rng';
import { runnerScreen } from './ui/screens/runner';
import { TOPICS } from './topics';

declare const __BUILD_ID__: string;

function boot() {
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
  nav.home(app);
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
