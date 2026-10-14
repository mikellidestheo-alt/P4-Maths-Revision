/**
 * Title screen, shown when the game opens. The 3D camp turns slowly in the background
 * (or the 2D camp picture without WebGL), with a card for each night showing its friend and maths.
 * Nights open in story order on the first playthrough; once all six are done, any night can be chosen.
 */
import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { campScene, jobIcon, moonIcon } from '../art';
import { JOB_ICON, NIGHTS, friendOf, nightMaths } from '../../game/nights';
import { allFinished, isFinished, isUnlocked, nextNight, startNight } from '../../game/progress';
import { modal } from './game';
import { GAME } from '../../config/game';
import { play, unlockAudio } from '../../game/audio';
import { use3D } from './world';
import { soundButtons } from '../soundButtons';
import { fullscreenButton } from '../fullscreen';
import type { World } from '../../world/world';
import { objective } from '../../world/quest';
import { stateForWorld } from './world';

export function startScreen(app: App): Screen {
  const d = app.data;
  const n = nextNight(d);
  const inProgress = d.current?.night;
  const allDone = allFinished(d);
  const label = inProgress ? `▶ Continue Night ${inProgress}` : '▶ Explore the camp';
  const sub = n === null
    ? 'All six friends are safe! Choose a night to play again:'
    : n === 1 && !inProgress ? 'Six friends are lost in the forest. Can you find them all?' : `Next: find ${friendOf(inProgress ?? n).name} the ${friendOf(inProgress ?? n).animal}.`;

  const stage = h('div', { class: 'start-stage' });
  const three = use3D(app);
  let world: World | null = null;
  if (three) {
    world = app.world as World;
    world.attract = true;
    world.events = { onNear: () => {}, onDistance: () => {}, onArrive: () => {} };
    world.setState(stateForWorld(app, objective(d)));
    world.mount(stage);
  } else {
    stage.appendChild(campScene({ spook: GAME.spook, decor: app.decor(), outfit: d.equipped.outfit, friends: NIGHTS.filter((x) => isFinished(d, x.n)).map((x) => x.friend), friendAccessory: d.equipped.friends, dawn: allFinished(d) }));
  }

  const go = () => {
    unlockAudio();
    play('night');
    nav.home(app);
  };
  const playBtn = h('button', { type: 'button', class: inProgress ? 'btn btn-primary btn-big btn-play' : 'btn btn-big btn-play-quiet', 'data-action': 'play' }, label);
  playBtn.addEventListener('click', go);

  const pick = (night: number) => {
    unlockAudio();
    const begin = () => {
      startNight(d, night);
      app.save();
      play('night');
      nav.night(app, night);
    };
    if (inProgress && inProgress !== night) {
      modal(app, `You’re partway through Night ${inProgress}. Start Night ${night} instead? Your stars are kept.`, [
        { label: `Play Night ${night}`, primary: true, act: begin },
        { label: `Carry on Night ${inProgress}`, act: go },
      ]);
    } else begin();
  };
  const picker = h('div', { class: 'night-pick', role: 'list', 'aria-label': allDone ? 'Choose a night' : 'Nights' }, ...NIGHTS.map((x) => {
    const f = friendOf(x.n);
    const done = isFinished(d, x.n);
    const open = isUnlocked(d, x.n);
    const here = inProgress === x.n;
    const isNext = !inProgress && !done && open;
    const stars = d.nights[x.n]?.bestStars ?? 0;
    const maths = nightMaths(x.n);
    const status = here ? 'in progress' : done ? `${stars} star${stars === 1 ? '' : 's'}` : open ? 'ready to play' : `locked until Night ${x.n - 1} is finished`;
    const b = h('button', {
      type: 'button', class: `pick-card${here ? ' pick-here' : ''}${isNext ? ' pick-next' : ''}${open ? '' : ' pick-locked'}`, role: 'listitem',
      'data-pick-night': String(x.n), disabled: !open,
      'aria-label': `Night ${x.n}: ${f.name} the ${f.animal}, ${status}. Maths: ${maths.map((m) => m.label).join('; ')}.`,
    },
      h('span', { class: 'pick-head' },
        moonIcon(done ? 'done' : open ? 'next' : 'locked', x.n),
        h('span', { class: 'pick-name' }, h('strong', {}, `Night ${x.n}`), h('span', {}, `${f.name} the ${f.animal}`)),
        done ? h('span', { class: 'pick-stars', 'aria-hidden': 'true' }, '★'.repeat(stars) + '☆'.repeat(3 - stars))
          : open ? null : h('span', { class: 'pick-lock', 'aria-hidden': 'true' }, '🔒')),
      h('span', { class: 'pick-topics' }, ...maths.map((m) => h('span', { class: 'pick-topic' }, jobIcon(JOB_ICON[m.id] ?? 'star'), h('span', {}, m.label)))),
      here ? h('span', { class: 'pick-badge' }, 'In progress')
        : isNext ? h('span', { class: 'pick-badge pick-badge-next' }, '▶ Play')
        : open ? null : h('span', { class: 'pick-locked-note' }, `Finish Night ${x.n - 1} to unlock`));
    if (open) b.addEventListener('click', () => pick(x.n));
    return b;
  }));
  const nextCard = picker.querySelector<HTMLElement>('.pick-next');

  const how = h('details', { class: 'start-how' },
    h('summary', {}, 'How to play'),
    h('ul', {},
      h('li', {}, three ? 'Walk with the joystick (or W A S D / arrow keys). Drag to look around.' : 'Pick a job at camp to start.'),
      three ? h('li', {}, 'Follow the glowing light — or tap “Walk to marker”.') : null,
      h('li', {}, 'Solve each job to move along the path. The lost friend appears at the end!'),
      h('li', {}, 'Stuck? Use 💡 for a hint. Mistakes come back later to try again.')));

  const el = h('div', { class: 'screen start-screen start-picking', 'data-screen': 'start' },
    stage,
    h('div', { class: 'start-overlay' },
      h('div', { class: 'start-top' }, ...soundButtons(app), fullscreenButton()),
      h('main', { class: 'start-panel' },
        h('h1', { class: 'start-title' }, h('span', { class: 'start-six' }, '6'), ' Nights at Camp'),
        h('p', { class: 'start-sub' }, sub),
        // Continue (if a night is under way) on top, then the nights, then "Explore the camp"
        inProgress ? playBtn : null,
        picker,
        inProgress ? null : playBtn,
        allDone ? null : how)));
  const first = inProgress || !nextCard ? (allDone && !inProgress ? picker.querySelector<HTMLElement>('button')! : playBtn) : nextCard;
  setTimeout(() => first.focus({ preventScroll: true }), 50);
  return {
    el,
    title: 'Welcome',
    music: allDone ? 'dawn' : 'camp',
    onKey: (e) => {
      if (e.key === 'Enter' && document.activeElement === document.body) {
        first.click();
        return true;
      }
      return false;
    },
    destroy: () => {
      if (world) {
        world.attract = false;
        if (stage.contains(world.container)) world.unmount();
      }
    },
  };
}
