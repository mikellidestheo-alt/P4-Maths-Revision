/**
 * Title screen, shown when the game opens. The 3D camp turns slowly in the background
 * (or the 2D camp picture without WebGL). One big Play button.
 */
import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { campScene, moonIcon } from '../art';
import { NIGHTS, friendOf } from '../../game/nights';
import { allFinished, isFinished, nextNight } from '../../game/progress';
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
  const label = inProgress ? `▶ Continue Night ${inProgress}` : n === 1 && !Object.keys(d.topics).length ? '▶ Start' : n ? `▶ Play Night ${n}` : '▶ Explore the camp';
  const sub = n === null
    ? 'All six friends are safe! You can still explore and replay any night.'
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
  const playBtn = h('button', { type: 'button', class: 'btn btn-primary btn-big btn-play', 'data-action': 'play' }, label);
  playBtn.addEventListener('click', go);

  const moons = h('div', { class: 'start-moons', 'aria-label': `${NIGHTS.filter((x) => isFinished(d, x.n)).length} of 6 friends rescued` },
    ...NIGHTS.map((x) => moonIcon(isFinished(d, x.n) ? 'done' : x.n === (inProgress ?? n) ? 'next' : 'locked', x.n)));

  const how = h('details', { class: 'start-how' },
    h('summary', {}, 'How to play'),
    h('ul', {},
      h('li', {}, three ? 'Walk with the joystick (or W A S D / arrow keys). Drag to look around.' : 'Pick a job at camp to start.'),
      three ? h('li', {}, 'Follow the glowing light — or tap “Walk to marker”.') : null,
      h('li', {}, 'Solve each job to move along the path. The lost friend appears at the end!'),
      h('li', {}, 'Stuck? Use 💡 for a hint. Mistakes come back later to try again.')));

  const el = h('div', { class: 'screen start-screen', 'data-screen': 'start' },
    stage,
    h('div', { class: 'start-overlay' },
      h('div', { class: 'start-top' }, ...soundButtons(app), fullscreenButton()),
      h('main', { class: 'start-panel' },
        h('h1', { class: 'start-title' }, h('span', { class: 'start-six' }, '6'), ' Nights at Camp'),
        h('p', { class: 'start-sub' }, sub),
        moons,
        playBtn,
        how)));
  setTimeout(() => playBtn.focus({ preventScroll: true }), 50);
  return {
    el,
    title: 'Welcome',
    music: allFinished(d) ? 'dawn' : 'camp',
    onKey: (e) => {
      if (e.key === 'Enter' && document.activeElement === document.body) {
        go();
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
