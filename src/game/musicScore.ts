/**
 * The background music, as pure data: a slow campfire lullaby, generated bar by bar from a seeded RNG.
 * No audio here — `music.ts` turns these note events into sound. Kept pure so it can be unit-tested.
 */
import type { Rng } from '../engine/rng';

/** camp: cosy night lullaby · focus: the same, much sparser and quieter, under questions · dawn: brighter, for the finale */
export type Mood = 'camp' | 'focus' | 'dawn';

export type Voice = 'pad' | 'pluck' | 'bell' | 'bass' | 'cricket' | 'bird';

export interface NoteEvent {
  voice: Voice;
  /** seconds from the start of the bar */
  at: number;
  /** seconds */
  dur: number;
  /** MIDI note number (ambience voices use it as a pitch too) */
  midi: number;
  /** 0–1 before the music's master volume */
  vol: number;
}

export interface MoodSpec {
  bpm: number;
  /** 3 = a gentle waltz (lullaby feel) */
  beatsPerBar: number;
  /** MIDI note of the key's tonic (middle octave) */
  key: number;
  /** chords as semitone offsets from the key; each chord lasts two bars */
  progression: number[][];
  /** chance an arpeggio note is left out (more space = calmer) */
  rest: number;
  /** chance of a short bell melody in a bar */
  melody: number;
  /** chance of a cricket (night) or bird (dawn) call in a bar */
  ambience: number;
  ambienceVoice: Voice | null;
  /** overall loudness of this mood */
  level: number;
}

const I = [0, 4, 7], IV = [5, 9, 12], V = [7, 11, 14], vi = [9, 12, 16], ii = [2, 5, 9];

export const MOODS: Record<Mood, MoodSpec> = {
  camp: { bpm: 80, beatsPerBar: 3, key: 62, progression: [I, vi, IV, V, I, IV, ii, V], rest: 0.18, melody: 0.45, ambience: 0.35, ambienceVoice: 'cricket', level: 1 },
  focus: { bpm: 80, beatsPerBar: 3, key: 62, progression: [I, vi, IV, V, I, IV, ii, V], rest: 0.6, melody: 0, ambience: 0, ambienceVoice: null, level: 0.45 },
  dawn: { bpm: 96, beatsPerBar: 3, key: 67, progression: [I, V, vi, IV, I, IV, V, I], rest: 0.08, melody: 0.7, ambience: 0.45, ambienceVoice: 'bird', level: 1 },
};

/** major pentatonic: always sounds sweet */
export const PENTATONIC = [0, 2, 4, 7, 9];

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function barSeconds(mood: Mood): number {
  const s = MOODS[mood];
  return (60 / s.bpm) * s.beatsPerBar;
}

export function chordAt(mood: Mood, bar: number): number[] {
  const p = MOODS[mood].progression;
  return p[Math.floor(bar / 2) % p.length];
}

const pc = (n: number) => ((n % 12) + 12) % 12;

/** Melody notes that sit nicely over a chord: chord tones plus pentatonic notes that aren't a semitone from any chord tone. */
export function safeTones(chord: number[]): number[] {
  const cps = chord.map(pc);
  const clash = (n: number) => cps.some((c) => { const d = Math.abs(pc(n) - c); return d === 1 || d === 11; });
  return [...new Set([...cps, ...PENTATONIC.filter((n) => !clash(n))])].sort((a, b) => a - b);
}

/** All the notes for one bar of a mood. Deterministic for a given rng state. */
export function composeBar(mood: Mood, bar: number, rng: Rng): NoteEvent[] {
  const s = MOODS[mood];
  const chord = chordAt(mood, bar);
  const beat = 60 / s.bpm;
  const eighth = beat / 2;
  const barLen = beat * s.beatsPerBar;
  const out: NoteEvent[] = [];

  // a soft held chord, once per chord change (spans both bars)
  if (bar % 2 === 0) for (const n of chord) out.push({ voice: 'pad', at: 0, dur: barLen * 2, midi: s.key - 12 + n, vol: 0.32 });

  // a low root on the first beat
  out.push({ voice: 'bass', at: 0, dur: barLen * 0.95, midi: s.key - 24 + chord[0], vol: 0.5 });

  // music-box arpeggio: root, fifth, third up, fifth, root up, third up
  const arp = [chord[0], chord[2], chord[1] + 12, chord[2], chord[0] + 12, chord[1] + 12];
  const steps = s.beatsPerBar * 2;
  for (let i = 0; i < steps; i++) {
    if (i > 0 && rng.next() < s.rest) continue; // the first note always plays, so the bar is anchored
    out.push({ voice: 'pluck', at: i * eighth, dur: 1.1, midi: s.key + arp[i % arp.length], vol: i === 0 ? 0.42 : 0.3 });
  }

  // now and then, a little bell tune on top
  if (rng.next() < s.melody) {
    const tones = safeTones(chord);
    const count = 2 + Math.floor(rng.next() * 3);
    let pos = Math.floor(rng.next() * 2);
    for (let k = 0; k < count && pos < steps; k++) {
      // the first note is a chord tone, so the tune lands on the harmony
      const pool = k === 0 ? chord.map(pc) : tones;
      out.push({ voice: 'bell', at: pos * eighth, dur: 1.8, midi: s.key + 12 + pool[Math.floor(rng.next() * pool.length)], vol: 0.28 });
      pos += 1 + Math.floor(rng.next() * 2);
    }
  }

  // crickets at night, birds at dawn
  if (s.ambienceVoice && rng.next() < s.ambience) {
    out.push({ voice: s.ambienceVoice, at: rng.next() * barLen * 0.8, dur: 0.4, midi: s.ambienceVoice === 'cricket' ? 107 : 98 + Math.floor(rng.next() * 5), vol: 0.5 });
  }
  return out;
}
