/** Tiny synthesised sound effects (Web Audio). Starts only after a user gesture (iOS rule). */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

const readyListeners: (() => void)[] = [];

/** the shared audio context, once a user gesture has created it */
export function audioContext(): AudioContext | null {
  return ctx;
}

/** called after every unlock (the background music uses this to start on the first tap) */
export function onAudioReady(fn: () => void) {
  readyListeners.push(fn);
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
    return;
  }
  for (const fn of readyListeners) fn();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export type Sfx = 'tap' | 'correct' | 'retry' | 'coin' | 'rescue' | 'night' | 'place';

export function play(sfx: Sfx) {
  if (!enabled || !ctx) return;
  try {
    switch (sfx) {
      case 'tap': tone(660, 0, 0.06, 'triangle', 0.05); break;
      case 'place': tone(520, 0, 0.08, 'triangle', 0.07); break;
      case 'correct': tone(784, 0, 0.25); tone(1047, 0.1, 0.35); break;
      case 'retry': tone(330, 0, 0.18, 'triangle', 0.08); tone(294, 0.12, 0.22, 'triangle', 0.06); break;
      case 'coin': tone(988, 0, 0.08, 'square', 0.04); tone(1319, 0.07, 0.16, 'square', 0.04); break;
      case 'rescue': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.4)); break;
      case 'night': tone(196, 0, 0.8, 'sine', 0.08); tone(247, 0.3, 0.9, 'sine', 0.06); break;
    }
  } catch {
    /* sound is optional */
  }
}
