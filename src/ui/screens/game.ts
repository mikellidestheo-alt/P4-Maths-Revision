import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { campScene, friendSvg, jobIcon, moonIcon, wrenSvg } from '../art';
import { FRIENDS, JOB_BLURB, JOB_ICON, NIGHTS, friendOf, jobDef } from '../../game/nights';
import {
  allFinished, applyCheckin, buildRecapQueue, campAsleep, canStart, finishNight, isFinished, nextNight,
  noteQuestionShown, recordJobAnswer, recordRecapAnswer, reviewWeights, startNight, allowanceLeft, type NightSummary,
} from '../../game/progress';
import { nextQuestion, recapQuestion, QUESTIONS_PER_JOB } from '../../engine/planner';
import { runnerScreen } from './runner';
import { play } from '../../game/audio';
import { installHint } from './install';

/* ---------- shared bits ---------- */

export function speech(text: string, outfit?: string): HTMLElement {
  return h('div', { class: 'speech' }, h('div', { class: 'speech-wren' }, wrenSvg(outfit)), h('p', { class: 'bubble' }, text));
}

function topBar(app: App, opts: { back?: () => void; title?: string } = {}): HTMLElement {
  const d = app.data;
  const moons = h('nav', { class: 'moons', 'aria-label': 'Six nights' },
    ...NIGHTS.map((n) => {
      const done = isFinished(d, n.n);
      const isNext = nextNight(d) === n.n;
      const state = done ? 'done' : isNext ? (campAsleep(d) ? 'sleep' : 'next') : 'locked';
      const stars = d.nights[n.n]?.bestStars ?? 0;
      const label = `Night ${n.n}: ${done ? `finished, ${stars} star${stars === 1 ? '' : 's'}${opts.back ? '' : ' — tap to replay'}` : isNext ? 'tonight' : 'not yet'}`;
      const b = h('button', { type: 'button', class: `moon-btn moon-${state}`, 'data-moon': String(n.n), 'aria-label': label, disabled: !done && !(isNext && !opts.back) },
        moonIcon(state, n.n),
        done ? h('span', { class: 'moon-stars', 'aria-hidden': 'true' }, '★'.repeat(stars)) : null);
      b.addEventListener('click', () => {
        if (done) confirmReplay(app, n.n);
        else if (isNext) tryStart(app, n.n);
      });
      return b;
    }));
  const coins = h('div', { class: 'coins', 'aria-label': `${d.coins} coins` }, '🪙 ', h('span', { 'data-coins': '1' }, String(d.coins)));
  const sound = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'sound', 'aria-label': d.settings.sound ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on', 'aria-pressed': String(d.settings.sound) }, d.settings.sound ? '🔊' : '🔇');
  sound.addEventListener('click', () => {
    d.settings.sound = !d.settings.sound;
    app.save();
    app.applySettings();
    sound.textContent = d.settings.sound ? '🔊' : '🔇';
    sound.setAttribute('aria-pressed', String(d.settings.sound));
    sound.setAttribute('aria-label', d.settings.sound ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on');
  });
  const grown = h('button', { type: 'button', class: 'icon-btn grown-btn', 'data-action': 'grownups', 'aria-label': 'Grown-ups area' }, '⚙️');
  grown.addEventListener('click', () => nav.parentGate(app));
  const back = opts.back ? h('button', { type: 'button', class: 'icon-btn', 'data-action': 'back', 'aria-label': 'Back' }, '⟵') : null;
  back?.addEventListener('click', opts.back!);
  return h('header', { class: 'topbar' }, back, moons, h('div', { class: 'topbar-right' }, coins, sound, grown));
}

function confirmReplay(app: App, n: number) {
  const d = app.data;
  if (d.current && d.current.night !== n) {
    modal(app, `You’re in the middle of Night ${d.current.night}. Finish it first, then you can replay Night ${n}.`, [{ label: `Go to Night ${d.current.night}`, primary: true, act: () => nav.night(app, d.current!.night) }, { label: 'OK', act: () => {} }]);
    return;
  }
  if (d.current && d.current.night === n) return nav.night(app, n);
  modal(app, `Play Night ${n} again? You’ll get new questions. (Replays never use up tonight’s nights.)`, [
    { label: `Replay Night ${n}`, primary: true, act: () => { startNight(d, n); app.save(); nav.night(app, n); } },
    { label: 'Not now', act: () => {} },
  ]);
}

function tryStart(app: App, n: number) {
  const d = app.data;
  if (d.current && d.current.night !== n) {
    modal(app, `You’re in the middle of Night ${d.current.night}. Let’s finish that first!`, [{ label: `Go to Night ${d.current.night}`, primary: true, act: () => nav.night(app, d.current!.night) }]);
    return;
  }
  const c = canStart(d, n);
  if (!c.ok) {
    if (c.reason === 'sleep') nav.rest(app);
    return;
  }
  startNight(d, n);
  app.save();
  play('tap');
  nav.night(app, n);
}

export function modal(app: App, text: string, buttons: { label: string; primary?: boolean; act: () => void }[]) {
  void app;
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Message' });
  const close = () => box.remove();
  box.appendChild(h('div', { class: 'modal-card' },
    h('p', {}, text),
    h('div', { class: 'modal-buttons' }, ...buttons.map((b) => {
      const btn = h('button', { type: 'button', class: `btn ${b.primary ? 'btn-primary' : ''}`, 'data-modal': b.label }, b.label);
      btn.addEventListener('click', () => { close(); b.act(); });
      return btn;
    }))));
  document.body.appendChild(box);
  box.querySelector<HTMLButtonElement>('button')?.focus();
}

/* ---------- home ---------- */

export function homeScreen(app: App): Screen {
  const d = app.data;
  if (d.current?.stage === 'checkin') {
    // the night was finished but the check-in was skipped (e.g. the app was closed)
    d.current = null;
    app.save();
  }
  const n = nextNight(d);
  const asleep = campAsleep(d);
  const friendsRescued = NIGHTS.filter((x) => isFinished(d, x.n)).map((x) => x.friend);
  const scene = h('div', { class: 'scene-wrap' }, campScene({ spook: d.settings.spook, decor: app.decor(), outfit: d.equipped.outfit, friends: friendsRescued, friendAccessory: d.equipped.friends }));
  if (asleep) scene.classList.add('asleep');
  const name = d.nickname ? `, ${d.nickname}` : '';
  let message: string;
  const actions = h('div', { class: 'home-actions' });
  if (n === null) {
    message = `You rescued all six friends${name}! The camp is safe. You can replay any night, or visit the shop.`;
    const dawn = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'dawn' }, '🌅 See the Dawn again');
    dawn.addEventListener('click', () => nav.dawn(app));
    actions.appendChild(dawn);
  } else if (d.current && d.current.night === n) {
    const f = friendOf(n);
    message = `Welcome back${name}! Let’s keep looking for ${f.name} the ${f.animal}.`;
    const go = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'start' }, `Continue Night ${n} of 6`);
    go.addEventListener('click', () => nav.night(app, n));
    actions.appendChild(go);
  } else if (asleep) {
    message = `The camp is fast asleep. Zzz… Come back tomorrow for Night ${n}! You can still replay a night or visit the shop.`;
    actions.appendChild(h('p', { class: 'sleep-note' }, `🌙 Tonight: done. Night ${n} opens tomorrow.`));
  } else {
    const f = friendOf(n);
    message = n === 1
      ? `Hello${name}! I’m Wren, the camp guide. ${f.name} the ${f.animal} is lost in ${f.lostIn}. Will you help me run the camp and find them?`
      : `${f.name} the ${f.animal} is lost in ${f.lostIn}! Ready for Night ${n}?`;
    const go = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'start' }, `Start Night ${n} of 6`);
    go.addEventListener('click', () => tryStart(app, n));
    actions.appendChild(go);
  }
  if (d.current && d.current.night !== n) {
    const cur = d.current.night;
    const b = h('button', { type: 'button', class: 'btn', 'data-action': 'continue-replay' }, `Continue replay of Night ${cur}`);
    b.addEventListener('click', () => nav.night(app, cur));
    actions.appendChild(b);
  }
  const shop = h('button', { type: 'button', class: 'btn', 'data-action': 'shop' }, '🛒 Camp shop');
  shop.addEventListener('click', () => nav.shop(app));
  const friends = h('button', { type: 'button', class: 'btn', 'data-action': 'friends' }, '🦔 Friends');
  friends.addEventListener('click', () => nav.friends(app));
  const left = allowanceLeft(d);
  const pace = d.settings.pacing === 0 || n === null ? '' : asleep ? '' : `Nights left today: ${left === Infinity ? 'no limit' : left}`;
  const el = h('div', { class: 'screen home', 'data-screen': 'home' },
    topBar(app),
    h('main', { class: 'home-main' },
      scene,
      h('div', { class: 'home-panel' },
        h('h1', { class: 'game-title' }, '6 Nights at Camp'),
        h('p', { class: 'tonight', 'data-tonight': String(n ?? 'done') }, n ? `Tonight: Night ${n} of 6` : 'All six nights complete! ⭐'),
        speech(message, d.equipped.outfit),
        actions,
        h('div', { class: 'home-secondary' }, shop, friends),
        pace ? h('p', { class: 'pace-note' }, pace) : null,
        !app.store.persistent ? h('p', { class: 'warn-note', role: 'note' }, '⚠️ This browser isn’t letting the game save. Progress will be lost when you close it. (Private browsing? Try a normal window.)') : null,
        installHint(app),
      )),
  );
  return { el, title: 'Camp' };
}

/* ---------- night (day phase at camp) ---------- */

export function nightScreen(app: App, n: number): Screen {
  const d = app.data;
  const run = d.current?.night === n ? d.current : startNight(d, n);
  app.save();
  const def = NIGHTS[n - 1];
  const f = friendOf(n);
  for (const j of def.jobs) if (run.jobs[j].index >= QUESTIONS_PER_JOB) run.jobs[j].done = true;
  if (run.stage === 'checkin' && run.summary) { const sm = run.summary as NightSummary; setTimeout(() => nav.checkin(app, sm), 0); }
  if (run.stage === 'campfire' || run.stage === 'recap') { setTimeout(() => nav.campfire(app), 0); }
  if (run.stage === 'rescue') { setTimeout(() => nav.rescue(app), 0); }
  const cards = def.jobs.map((jobId, i) => {
    const job = jobDef(jobId);
    const st = run.jobs[jobId];
    const done = st.done;
    const firsts = st.firstTry.filter(Boolean).length;
    const b = h('button', { type: 'button', class: `job-card ${done ? 'done' : ''}`, 'data-job': jobId },
      h('div', { class: 'job-icon-wrap' }, jobIcon(JOB_ICON[jobId] ?? 'star')),
      h('div', { class: 'job-text' },
        h('strong', {}, `${i + 1}. ${job.job}`),
        h('span', { class: 'job-topic' }, job.review ? job.title : `${job.id} ${job.title}`),
        h('span', { class: 'job-blurb' }, JOB_BLURB[jobId] ?? ''),
        done ? h('span', { class: 'job-done' }, `✔ Done — ${firsts}/10 first try`) : st.index > 0 ? h('span', { class: 'job-progress' }, `${st.index}/10 done`) : null),
    );
    b.addEventListener('click', () => {
      if (done) {
        modal(app, 'This job is done! Pick another one, or light the campfire when all three are finished.', [{ label: 'OK', act: () => {} }]);
        return;
      }
      nav.job(app, jobId);
    });
    return b;
  });
  const allDone = def.jobs.every((j) => run.jobs[j].done);
  const fire = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'campfire', disabled: !allDone }, allDone ? '🔥 Light the campfire' : `🔥 Finish the jobs to light the campfire`);
  fire.addEventListener('click', () => {
    run.stage = 'campfire';
    app.save();
    nav.campfire(app);
  });
  const doneCount = def.jobs.filter((j) => run.jobs[j].done).length;
  const msg = allDone
    ? `All the jobs are done! Night is falling. Let’s light the campfire and search for ${f.name}.`
    : doneCount === 0
      ? `${f.name} the ${f.animal} is lost in ${f.lostIn}. First, let’s get the camp ready. Pick a job!`
      : `Great work! ${3 - doneCount} job${3 - doneCount === 1 ? '' : 's'} to go.`;
  const el = h('div', { class: 'screen night', 'data-screen': 'night', 'data-night': String(n) },
    topBar(app, { back: () => nav.home(app) }),
    h('main', { class: 'night-main' },
      h('div', { class: 'scene-wrap scene-small' }, campScene({ spook: d.settings.spook, decor: app.decor(), outfit: d.equipped.outfit, showWren: false })),
      h('div', { class: 'night-panel' },
        h('h1', {}, `Night ${n}: Find ${f.name}${run.replay ? ' (replay)' : ''}`),
        speech(msg, d.equipped.outfit),
        h('div', { class: 'job-cards' }, ...cards),
        fire)),
  );
  return { el, title: `Night ${n}`, onBack: () => nav.home(app) };
}

/* ---------- a job (10 questions) ---------- */

export function jobScreen(app: App, jobId: string): Screen {
  const d = app.data;
  const run = d.current!;
  const job = jobDef(jobId);
  const st = () => d.current!.jobs[jobId];
  const weights = reviewWeights(d);
  const screen = runnerScreen(app, {
    mode: 'job',
    title: job.job,
    total: QUESTIONS_PER_JOB,
    done: st().index,
    friendId: friendOf(run.night).id,
    next: () => nextQuestion(app.rng, job, st(), { nudge: d.nudge, weights, seen: app.seen }),
    onShown: (q) => {
      noteQuestionShown(d, jobId, q);
      app.save();
    },
    onResult: (q, o) => {
      const c = recordJobAnswer(d, jobId, q, o);
      app.save();
      return c;
    },
    onFinish: () => {
      st().done = true;
      app.save();
      jobDone(app, jobId);
    },
    onExit: () => nav.night(app, run.night),
  });
  return screen;
}

function jobDone(app: App, jobId: string) {
  const d = app.data;
  const run = d.current!;
  const st = run.jobs[jobId];
  const firsts = st.firstTry.filter(Boolean).length;
  const job = jobDef(jobId);
  const back = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'job-back' }, 'Back to camp');
  back.addEventListener('click', () => nav.night(app, run.night));
  play('coin');
  const el = h('div', { class: 'screen job-done-screen', 'data-screen': 'job-done' },
    h('main', { class: 'centre-panel' },
      h('div', { class: 'big-icon' }, jobIcon(JOB_ICON[jobId] ?? 'star')),
      h('h1', {}, 'Job done!'),
      h('p', {}, `${job.job}: ${firsts} out of 10 right first time.`),
      speech(firsts >= 8 ? 'Amazing work! The camp is looking great.' : firsts >= 5 ? 'Good job! Every question makes you stronger.' : 'You kept going — that’s what real campers do! Tricky ones will come back at the campfire.', d.equipped.outfit),
      back));
  app.show({ el, title: 'Job done', onBack: () => nav.night(app, run.night) });
}

/* ---------- campfire (night phase) + recap ---------- */

export function campfireScreen(app: App): Screen {
  const d = app.data;
  const run = d.current!;
  const f = friendOf(run.night);
  if (!run.recap) {
    run.recap = { queue: buildRecapQueue(run), index: 0, fixed: 0 };
    run.stage = 'recap';
    app.save();
  }
  const left = run.recap.queue.length - run.recap.index;
  play('night');
  const go = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': left > 0 ? 'recap' : 'search' }, left > 0 ? `Let’s go (${left} to fix)` : `🔦 Search for ${f.name}`);
  go.addEventListener('click', () => (left > 0 ? nav.recap(app) : (run.stage = 'rescue', app.save(), nav.rescue(app))));
  const el = h('div', { class: 'screen campfire', 'data-screen': 'campfire' },
    h('main', { class: 'campfire-main' },
      h('div', { class: 'scene-wrap' }, campScene({ spook: d.settings.spook, decor: app.decor(), outfit: d.equipped.outfit, fireBig: true })),
      h('div', { class: 'night-panel' },
        h('h1', {}, 'Night falls…'),
        speech(left > 0
          ? `The campfire is crackling. Some tricky ones from today are back for another go — with new numbers. Fixing mistakes earns extra coins!`
          : `What a day! The campfire is lit and everyone is cosy. Let’s search for ${f.name}!`, d.equipped.outfit),
        go)),
  );
  return { el, title: 'Campfire', onBack: () => nav.night(app, run.night) };
}

export function recapScreen(app: App): Screen {
  const d = app.data;
  const run = d.current!;
  const recap = run.recap!;
  return runnerScreen(app, {
    mode: 'recap',
    title: 'Campfire recap',
    total: recap.queue.length,
    done: recap.index,
    friendId: friendOf(run.night).id,
    next: () => recapQuestion(app.rng, recap.queue[recap.index], app.seen),
    onResult: (q, o) => {
      const c = recordRecapAnswer(d, q, o);
      recap.index++;
      app.save();
      return c;
    },
    onFinish: () => {
      run.stage = 'rescue';
      app.save();
      nav.rescue(app);
    },
    onExit: () => nav.campfire(app),
  });
}

/* ---------- rescue, check-in, rest, dawn ---------- */

export function rescueScreen(app: App): Screen {
  const d = app.data;
  const run = d.current!;
  const f = friendOf(run.night);
  const summary = finishNight(d)!;
  app.save();
  play('rescue');
  const next = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'rescue-next' }, 'Next');
  next.addEventListener('click', () => nav.checkin(app, summary));
  const el = h('div', { class: 'screen rescue', 'data-screen': 'rescue' },
    h('main', { class: 'centre-panel' },
      h('div', { class: 'rescue-stage' }, h('div', { class: 'rescue-tree' }), h('div', { class: 'rescue-friend' }, friendSvg(f.id, { accessory: d.equipped.friends }, `${f.name} the ${f.animal}`))),
      h('h1', {}, `You found ${f.name}!`),
      h('p', { class: 'friend-quote' }, f.found),
      h('div', { class: 'stars-big', 'aria-label': `${summary.stars} out of 3 stars` }, ...[1, 2, 3].map((i) => h('span', { class: i <= summary.stars ? 'star-on' : 'star-off' }, '★'))),
      h('p', {}, `${summary.firstTry} of ${summary.answered} right first time`, summary.recapTotal ? ` · fixed ${summary.recapFixed} of ${summary.recapTotal} at the campfire` : '', ` · +${summary.coins} 🪙`),
      next));
  return { el, title: 'Rescued!' };
}

export function checkinScreen(app: App, summary: NightSummary): Screen {
  const d = app.data;
  let fun: 'boring' | 'good' | 'great' | null = null;
  let level: 'easy' | 'right' | 'hard' | null = null;
  const group = (label: string, opts: { v: string; t: string }[], set: (v: string) => void, attr: string) => {
    const g = h('div', { class: 'checkin-row', role: 'radiogroup', 'aria-label': label });
    for (const o of opts) {
      const b = h('button', { type: 'button', class: 'checkin-btn', role: 'radio', 'aria-checked': 'false', [attr]: o.v }, o.t);
      b.addEventListener('click', () => {
        set(o.v);
        g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        play('tap');
      });
      g.appendChild(b);
    }
    return g;
  };
  const done = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'goodnight' }, 'Goodnight! 🌙');
  done.addEventListener('click', () => {
    applyCheckin(d, { night: summary.night, fun, level });
    app.save();
    if (summary.night === 6 && allFinished(d) && !d.flags.dawnSeen) nav.dawn(app);
    else if (campAsleep(d)) nav.rest(app);
    else nav.home(app);
  });
  const el = h('div', { class: 'screen checkin', 'data-screen': 'checkin' },
    h('main', { class: 'centre-panel' },
      h('h1', {}, 'Before bed…'),
      h('h2', { class: 'checkin-q' }, 'How was tonight?'),
      group('How was tonight?', [{ v: 'boring', t: '😴 Boring' }, { v: 'good', t: '🙂 Good' }, { v: 'great', t: '🤩 Great' }], (v) => (fun = v as typeof fun), 'data-fun'),
      h('h2', { class: 'checkin-q' }, 'Was the maths…'),
      group('Was the maths', [{ v: 'easy', t: 'Too easy' }, { v: 'right', t: 'Just right' }, { v: 'hard', t: 'Too hard' }], (v) => (level = v as typeof level), 'data-level'),
      done));
  return { el, title: 'Check-in' };
}

export function restScreen(app: App): Screen {
  const d = app.data;
  const n = nextNight(d);
  const back = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'rest-home' }, 'Back to camp');
  back.addEventListener('click', () => nav.home(app));
  const el = h('div', { class: 'screen rest', 'data-screen': 'rest' },
    h('main', { class: 'campfire-main' },
      h('div', { class: 'scene-wrap asleep' }, campScene({ spook: 'cosy', decor: app.decor(), outfit: d.equipped.outfit, showWren: false }), h('div', { class: 'zzz', 'aria-hidden': 'true' }, 'Z z z')),
      h('div', { class: 'night-panel' },
        h('h1', {}, 'The camp is asleep'),
        speech(`Great work today${d.nickname ? ', ' + d.nickname : ''}! Brains grow while we sleep. Come back tomorrow for Night ${n ?? ''}.`, d.equipped.outfit),
        h('p', { class: 'small-help' }, 'You can still replay finished nights, or visit the shop.'),
        back)),
  );
  return { el, title: 'Goodnight', onBack: () => nav.home(app) };
}

export function dawnScreen(app: App): Screen {
  const d = app.data;
  d.flags.dawnSeen = true;
  app.save();
  play('rescue');
  const back = h('button', { type: 'button', class: 'btn btn-primary btn-big', 'data-action': 'dawn-home' }, 'Back to camp');
  back.addEventListener('click', () => nav.home(app));
  const totalStars = NIGHTS.reduce((t, n) => t + (d.nights[n.n]?.bestStars ?? 0), 0);
  const el = h('div', { class: 'screen dawn', 'data-screen': 'dawn' },
    h('main', { class: 'campfire-main' },
      h('div', { class: 'scene-wrap' }, campScene({ spook: 'cosy', decor: app.decor(), outfit: d.equipped.outfit, dawn: true, friends: FRIENDS.map((f) => f.id), friendAccessory: d.equipped.friends }), h('div', { class: 'confetti', 'aria-hidden': 'true' }, ...Array.from({ length: 24 }, (_, i) => h('i', { class: `c${i % 6}`, style: { left: `${(i * 41) % 100}%`, animationDelay: `${(i % 8) * 0.4}s` } })))),
      h('div', { class: 'night-panel' },
        h('h1', {}, '🌅 Dawn!'),
        speech(`You did it${d.nickname ? ', ' + d.nickname : ''}! All six friends are safe and the sun is coming up. You’re a true maths camper — good luck on Monday!`, d.equipped.outfit),
        h('p', {}, `⭐ ${totalStars} stars out of 18 · 🪙 ${d.coinsEarnedTotal} coins earned`),
        back)),
  );
  return { el, title: 'Dawn' };
}

