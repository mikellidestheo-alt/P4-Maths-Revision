/**
 * The 3D world screen: the forest in the background, a small HUD on top.
 * Falls back to the 2D camp (screens/game.ts) if WebGL isn't available.
 */
import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { topBar } from './game';
import { World, webglAvailable, type WorldState } from '../../world/world';
import { objective, stepsDone, type Objective } from '../../world/quest';
import { NIGHTS, friendOf } from '../../game/nights';
import { allFinished, canStart, isFinished, startNight } from '../../game/progress';
import { GAME } from '../../config/game';
import { iconCanvas, preloadIcons } from '../worldIcons';
import { play } from '../../game/audio';

/** Decide once whether to use the 3D world. `?2d=1` forces the 2D camp (useful on very old devices). */
export function use3D(app: App): boolean {
  if (app.world === null) {
    let ok = !/[?&]2d=1/.test(location.search) && webglAvailable();
    if (ok) {
      try {
        app.world = new World();
      } catch {
        ok = false;
      }
    }
    if (!ok) app.world = false;
    app.world3d = ok;
  }
  return app.world3d;
}

export function stateForWorld(app: App, o: Objective): WorldState {
  const d = app.data;
  const night = o.kind === 'done' ? null : o.night;
  return {
    objective: o,
    night,
    stepsDone: night ? stepsDone(d, night) : 0,
    rescued: NIGHTS.filter((n) => isFinished(d, n.n)).map((n) => n.friend),
    friendIds: NIGHTS.map((n) => n.friend),
    dawn: allFinished(d),
    spook: GAME.spook,
    lantern: d.equipped.lantern ?? 'lantern-gold',
    decor: app.decor(),
    outfit: d.equipped.outfit,
    friendAccessory: d.equipped.friends,
    iconFor: iconCanvas,
    jobsOfNight: (n) => NIGHTS[n - 1].jobs,
  };
}

function questText(app: App, o: Objective): { title: string; step: string; tip: string } {
  if (o.kind === 'done') return { title: 'All six friends are safe! 🌅', step: 'Explore the camp, visit the shop, or replay a night from the moons.', tip: 'You did it! Every friend is home. Tap a moon at the top to play a night again.' };
  const f = friendOf(o.night);
  const replay = app.data.current?.replay ? ' (replay)' : '';
  const title = `Night ${o.night} of 6 · Find ${f.name}${replay}`;
  if (o.kind === 'job') {
    return {
      title,
      step: `Task ${o.step} of 3: ${o.label}`,
      tip: o.step === 1 && !o.started
        ? `${f.name} the ${f.animal} is lost in ${f.lostIn}! Follow the glowing light to your first job.`
        : o.step === 1 ? 'Your first job is waiting by the glowing light.' : `Brilliant! The next job is further along the path towards ${f.lostIn}.`,
    };
  }
  if (o.kind === 'recap') return { title, step: `Light the campfire: ${o.left} tricky one${o.left === 1 ? '' : 's'} to fix`, tip: 'Light the campfire before the last stretch. Some tricky ones are back — with new numbers!' };
  return { title, step: `Rescue ${f.name}!`, tip: `✨ ${f.name} has appeared at the end of the path! Go and say hello.` };
}

export function worldScreen(app: App): Screen {
  const world = app.world as World;
  const d = app.data;
  if (d.current?.stage === 'checkin') {
    d.current = null;
    app.save();
  }
  const o = objective(d);
  world.setState(stateForWorld(app, o));
  void preloadIcons().then(() => {
    if (app.current?.el === el) world.setState(stateForWorld(app, objective(d)));
  });

  const q = questText(app, o);
  const distEl = h('span', { class: 'quest-dist', 'data-quest-dist': '1' }, '');
  const quest = h('div', { class: 'quest-card', 'data-quest': o.kind, role: 'status' },
    h('strong', {}, q.title), h('span', { 'data-quest-step': '1' }, q.step), o.kind === 'done' ? null : distEl);
  const tip = h('div', { class: 'world-tip', role: 'note' }, h('span', { class: 'tip-who' }, 'Wren: '), q.tip);
  const tipKey = `${o.kind}-${'night' in o ? o.night : 0}-${'step' in o ? o.step : 0}`;
  if ((app as unknown as { lastTip?: string }).lastTip === tipKey) tip.classList.add('tip-quiet');
  (app as unknown as { lastTip?: string }).lastTip = tipKey;
  setTimeout(() => tip.classList.add('tip-hide'), 9000);

  const act = h('button', { type: 'button', class: 'btn btn-primary btn-act', 'data-action': 'interact', hidden: true }, '');
  const walk = h('button', { type: 'button', class: 'btn btn-walk', 'data-action': 'autowalk', 'aria-pressed': 'false', hidden: o.kind === 'done' }, '🧭 Walk to marker');
  const setWalkLabel = () => {
    walk.textContent = world.autoWalking ? '✋ Stop walking' : '🧭 Walk to marker';
    walk.setAttribute('aria-pressed', String(world.autoWalking));
  };
  walk.addEventListener('click', () => {
    if (world.autoWalking) world.stopAutoWalk();
    else world.startAutoWalk();
    play('tap');
    setWalkLabel();
  });

  const interact = () => {
    const cur = objective(d);
    if (cur.kind === 'done') return;
    play('tap');
    if (cur.kind === 'job') {
      if (!d.current) {
        if (!canStart(d, cur.night).ok) return;
        startNight(d, cur.night);
        app.save();
      }
      nav.job(app, cur.jobId);
    } else if (cur.kind === 'recap') nav.recap(app);
    else nav.rescue(app);
  };
  act.addEventListener('click', interact);
  const actLabel = (cur: Objective) =>
    cur.kind === 'job' ? `▶ Start: ${cur.label}` : cur.kind === 'recap' ? `🔥 Light the campfire (${cur.left} to fix)` : cur.kind === 'friend' ? `💛 Rescue ${friendOf(cur.night).name}` : '';

  world.events = {
    onNear: (near) => {
      act.hidden = !near;
      act.textContent = actLabel(objective(d));
      el.classList.toggle('is-near', near);
      if (near) setTimeout(() => act.focus({ preventScroll: true }), 30);
    },
    onDistance: (m) => (distEl.textContent = m > 3 ? `${m} m away` : 'Here!'),
    onArrive: () => setWalkLabel(),
  };

  // joystick (touch screens)
  const knob = h('div', { class: 'joy-knob' });
  const joy = h('div', { class: 'joystick', 'aria-label': 'Joystick: drag to walk', role: 'application' }, knob);
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    const move = (ev: PointerEvent) => {
      let dx = ev.clientX - cx, dy = ev.clientY - cy;
      const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      world.joy.x = dx / R;
      world.joy.y = dy / R;
      if (world.autoWalking) { world.stopAutoWalk(); setWalkLabel(); }
    };
    const up = () => {
      knob.style.transform = '';
      world.joy.x = world.joy.y = 0;
      joy.removeEventListener('pointermove', move);
      joy.removeEventListener('pointerup', up);
      joy.removeEventListener('pointercancel', up);
    };
    move(e);
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', up);
    joy.addEventListener('pointercancel', up);
  });
  const touch = window.matchMedia?.('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  const shop = h('button', { type: 'button', class: 'icon-btn world-side-btn', 'data-action': 'shop', 'aria-label': 'Camp shop' }, '🛒');
  shop.addEventListener('click', () => nav.shop(app));
  const friends = h('button', { type: 'button', class: 'icon-btn world-side-btn', 'data-action': 'friends', 'aria-label': 'Friends' }, '🦔');
  friends.addEventListener('click', () => nav.friends(app));
  const dawnBtn = o.kind === 'done' ? h('button', { type: 'button', class: 'btn btn-small', 'data-action': 'dawn' }, '🌅 Dawn') : null;
  dawnBtn?.addEventListener('click', () => nav.dawn(app));

  const stage = h('div', { class: 'world-stage' });
  const el = h('div', { class: `screen world-screen ${touch ? 'has-touch' : 'no-touch'}`, 'data-screen': 'world', 'data-objective': o.kind },
    stage,
    h('div', { class: 'world-hud' },
      topBar(app),
      h('div', { class: 'world-top' }, quest, h('div', { class: 'world-side' }, shop, friends, dawnBtn)),
      tip,
      !app.store.persistent ? h('p', { class: 'warn-note world-warn', role: 'note' }, '⚠️ This browser can’t save progress (private browsing?).') : null,
      h('div', { class: 'world-bottom' },
        touch ? joy : h('p', { class: 'key-hint' }, 'Walk: W A S D or arrow keys · Look: drag · Start a job: Enter'),
        h('div', { class: 'world-actions' }, act, walk)),
    ),
  );
  world.mount(stage);
  const debug = app.debug ? (window as unknown as Record<string, unknown>) : null;
  if (debug) debug.__campWorld = world;

  const keyup = (e: KeyboardEvent) => world.keyUp(e);
  window.addEventListener('keyup', keyup);
  return {
    el,
    title: 'Camp',
    onKey: (e) => {
      if ((e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'e') && !act.hidden && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        interact();
        return true;
      }
      if (world.keyDown(e)) {
        e.preventDefault();
        setWalkLabel();
        return true;
      }
      return false;
    },
    destroy: () => {
      window.removeEventListener('keyup', keyup);
      // the next screen may already have taken the 3D view (e.g. world → world after tapping a moon)
      if (stage.contains(world.container)) world.unmount();
    },
  };
}

