import { h } from './dom';
import type { App } from './app';

/**
 * The 🎵 music and 🔊 sound buttons (top bar and start screen). Sound off silences everything;
 * music off keeps the sound effects but stops the background music.
 */
export function soundButtons(app: App): HTMLElement[] {
  const st = app.data.settings;
  const music = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'music' }, '🎵');
  const sound = h('button', { type: 'button', class: 'icon-btn', 'data-action': 'sound' });
  const show = () => {
    const musicOn = st.sound && st.music;
    music.classList.toggle('is-off', !musicOn);
    music.setAttribute('aria-pressed', String(musicOn));
    music.setAttribute('aria-label', musicOn ? 'Music on — tap to turn off' : 'Music off — tap to turn on');
    sound.textContent = st.sound ? '🔊' : '🔇';
    sound.setAttribute('aria-pressed', String(st.sound));
    sound.setAttribute('aria-label', st.sound ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on');
  };
  const apply = () => {
    app.save();
    app.applySettings();
    show();
  };
  music.addEventListener('click', () => {
    if (st.sound && st.music) st.music = false;
    else st.sound = st.music = true; // turning music on also turns sound back on
    apply();
  });
  sound.addEventListener('click', () => {
    st.sound = !st.sound;
    apply();
  });
  show();
  return [music, sound];
}
