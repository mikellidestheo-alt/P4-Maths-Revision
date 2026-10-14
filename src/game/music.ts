/**
 * Background music, synthesised live with Web Audio from `musicScore.ts` (no audio files, works offline).
 * Starts after the first tap (iOS rule), fades out when the tab is hidden, follows the mood of the screen.
 */
import { audioContext, onAudioReady } from './audio';
import { barSeconds, composeBar, midiToFreq, MOODS, type Mood, type NoteEvent } from './musicScore';
import { makeRng, randomSeed, type Rng } from '../engine/rng';
import { GAME } from '../config/game';

/** loudness of the music before GAME.musicVolume (kept well under the sound effects) */
const BASE_VOLUME = 0.25;

interface Bus {
  master: GainNode;
  dry: GainNode;
  wet: GainNode;
}

interface Session {
  ctx: AudioContext;
  bus: Bus;
  rng: Rng;
  bar: number;
  nextBar: number;
  timer: number;
}

let enabled = true;
let mood: Mood = 'camp';
let session: Session | null = null;
let barsPlayed = 0;

export function setMusicEnabled(on: boolean) {
  enabled = on;
  sync();
}

export function setMood(m: Mood) {
  if (m === mood) return;
  mood = m;
  if (session) session.bus.master.gain.setTargetAtTime(levelOf(m), session.ctx.currentTime, 0.8);
}

/** for tests (?bot=1) */
export function musicState() {
  return { enabled, mood, playing: !!session, bars: barsPlayed };
}

const levelOf = (m: Mood) => BASE_VOLUME * GAME.musicVolume * MOODS[m].level;

function sync() {
  const ctx = audioContext();
  const want = enabled && !!ctx && !document.hidden && GAME.musicVolume > 0;
  if (want && !session) start(ctx!);
  else if (!want && session) stop();
}

function start(ctx: AudioContext) {
  try {
    const bus = makeBus(ctx, ctx.destination);
    bus.master.gain.setValueAtTime(0, ctx.currentTime);
    bus.master.gain.setTargetAtTime(levelOf(mood), ctx.currentTime, 1);
    const s: Session = { ctx, bus, rng: makeRng(randomSeed()), bar: 0, nextBar: ctx.currentTime + 0.15, timer: 0 };
    s.timer = window.setInterval(() => tick(s), 200);
    session = s;
    tick(s);
  } catch {
    session = null; // music is optional
  }
}

function stop() {
  const s = session!;
  session = null;
  clearInterval(s.timer);
  try {
    s.bus.master.gain.cancelScheduledValues(s.ctx.currentTime);
    s.bus.master.gain.setTargetAtTime(0, s.ctx.currentTime, 0.25);
    // notes already scheduled ring out into silence; then let the nodes go
    setTimeout(() => s.bus.master.disconnect(), 6000);
  } catch {
    /* ignore */
  }
}

/** schedule bars a little ahead of time so timer jitter never causes gaps */
function tick(s: Session) {
  if (s.ctx.state !== 'running') return;
  const now = s.ctx.currentTime;
  if (s.nextBar < now) s.nextBar = now + 0.1; // timers were paused: pick up cleanly rather than catching up
  while (s.nextBar < now + 0.5) {
    scheduleBar(s.ctx, s.bus, composeBar(mood, s.bar, s.rng), s.nextBar);
    s.nextBar += barSeconds(mood);
    s.bar++;
    barsPlayed++;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', sync);
  onAudioReady(sync);
}

/* ---------- synthesis (works on a live or an offline context) ---------- */

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();

/** a soft "night air" reverb: decaying stereo noise */
function impulse(c: BaseAudioContext): AudioBuffer {
  let b = impulses.get(c);
  if (b) return b;
  const len = Math.floor(c.sampleRate * 2.6);
  b = c.createBuffer(2, len, c.sampleRate);
  const rng = makeRng(7);
  for (let ch = 0; ch < 2; ch++) {
    const data = b.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  impulses.set(c, b);
  return b;
}

export function makeBus(c: BaseAudioContext, dest: AudioNode): Bus {
  const master = c.createGain();
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 4;
  master.connect(limiter).connect(dest);
  const dry = c.createGain();
  dry.connect(master);
  const verb = c.createConvolver();
  verb.buffer = impulse(c);
  const wetOut = c.createGain();
  wetOut.gain.value = 0.55;
  const wet = c.createGain();
  wet.connect(verb).connect(wetOut).connect(master);
  return { master, dry, wet };
}

function route(c: BaseAudioContext, bus: Bus, node: AudioNode, dry: number, wet: number) {
  const d = c.createGain();
  d.gain.value = dry;
  node.connect(d).connect(bus.dry);
  const w = c.createGain();
  w.gain.value = wet;
  node.connect(w).connect(bus.wet);
}

function osc(c: BaseAudioContext, type: OscillatorType, freq: number, t: number, end: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

/** a plucked / struck envelope: quick attack, smooth exponential fade */
function strike(c: BaseAudioContext, t: number, peak: number, dur: number, attack = 0.006): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

export function scheduleBar(c: BaseAudioContext, bus: Bus, events: NoteEvent[], t0: number) {
  for (const e of events) {
    const t = t0 + e.at;
    const f = midiToFreq(e.midi);
    switch (e.voice) {
      case 'pad': {
        // two gently detuned voices through a low-pass: warm and soft
        const g = c.createGain();
        const peak = e.vol * 0.1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 1.3);
        g.gain.setValueAtTime(peak, t + e.dur - 1.2);
        g.gain.linearRampToValueAtTime(0, t + e.dur + 0.6);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        osc(c, 'triangle', f, t, t + e.dur + 0.6).connect(lp);
        osc(c, 'sine', f * 1.004, t, t + e.dur + 0.6).connect(lp);
        lp.connect(g);
        route(c, bus, g, 0.7, 0.8);
        break;
      }
      case 'pluck': {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        const g = strike(c, t, e.vol * 0.3, e.dur);
        osc(c, 'triangle', f, t, t + e.dur).connect(lp).connect(g);
        route(c, bus, g, 1, 0.5);
        break;
      }
      case 'bell': {
        // music-box bell: a pure tone plus a faint, quicker overtone
        const g = strike(c, t, e.vol * 0.32, e.dur, 0.004);
        osc(c, 'sine', f, t, t + e.dur).connect(g);
        const g2 = strike(c, t, e.vol * 0.05, e.dur * 0.4, 0.003);
        osc(c, 'sine', f * 3, t, t + e.dur * 0.4).connect(g2);
        route(c, bus, g, 0.6, 1);
        route(c, bus, g2, 0.6, 1);
        break;
      }
      case 'bass': {
        const g = strike(c, t, e.vol * 0.35, e.dur, 0.03);
        osc(c, 'sine', f, t, t + e.dur).connect(g);
        route(c, bus, g, 1, 0.2);
        break;
      }
      case 'cricket': {
        // three tiny chirps
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        for (let i = 0; i < 3; i++) {
          const p = t + i * 0.065;
          g.gain.setValueAtTime(0, p);
          g.gain.linearRampToValueAtTime(e.vol * 0.035, p + 0.012);
          g.gain.linearRampToValueAtTime(0, p + 0.035);
        }
        osc(c, 'sine', f, t, t + 0.25).connect(g);
        route(c, bus, g, 0.5, 0.9);
        break;
      }
      case 'bird': {
        // two quick rising whistles
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        const o = osc(c, 'sine', f, t, t + 0.35);
        for (let i = 0; i < 2; i++) {
          const p = t + i * 0.16;
          o.frequency.setValueAtTime(f, p);
          o.frequency.exponentialRampToValueAtTime(f * 1.3, p + 0.1);
          g.gain.setValueAtTime(0, p);
          g.gain.linearRampToValueAtTime(e.vol * 0.05, p + 0.02);
          g.gain.linearRampToValueAtTime(0, p + 0.11);
        }
        o.connect(g);
        route(c, bus, g, 0.5, 0.9);
        break;
      }
    }
  }
}

/**
 * Render a stretch of a mood offline (for checking levels in tests, and for listening without the game).
 * Returns the mixed-down samples at the given sample rate.
 */
export async function renderMood(m: Mood, seconds: number, seed = 1, sampleRate = 22050): Promise<Float32Array> {
  const c = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const bus = makeBus(c, c.destination);
  bus.master.gain.value = levelOf(m);
  const rng = makeRng(seed);
  for (let bar = 0, t = 0.05; t < seconds; bar++, t += barSeconds(m)) scheduleBar(c, bus, composeBar(m, bar, rng), t);
  const buf = await c.startRendering();
  return buf.getChannelData(0);
}
