import { describe, expect, it } from 'vitest';
import { barSeconds, chordAt, composeBar, midiToFreq, MOODS, safeTones, type Mood, type NoteEvent } from './musicScore';
import { makeRng } from '../engine/rng';

const MOOD_LIST = Object.keys(MOODS) as Mood[];
const pc = (n: number) => ((n % 12) + 12) % 12;
const PITCHED = new Set(['pad', 'pluck', 'bell', 'bass']);

function bars(mood: Mood, count: number, seed = 1): NoteEvent[][] {
  const rng = makeRng(seed);
  return Array.from({ length: count }, (_, b) => composeBar(mood, b, rng));
}

describe('background music score', () => {
  it('uses concert pitch', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });

  for (const mood of MOOD_LIST) {
    it(`${mood}: every note sits sweetly on the chord (no semitone clashes)`, () => {
      const key = MOODS[mood].key;
      bars(mood, 400).forEach((events, b) => {
        const chord = chordAt(mood, b).map(pc);
        const ok = new Set(safeTones(chordAt(mood, b)));
        for (const e of events.filter((x) => PITCHED.has(x.voice))) {
          const p = pc(e.midi - key);
          expect(ok.has(p), `${mood} bar ${b} ${e.voice} pc ${p}`).toBe(true);
          if (e.voice !== 'bell') expect(chord).toContain(p); // accompaniment is pure chord tones
          for (const c of chord) expect([1, 11]).not.toContain(Math.abs(p - c));
        }
      });
    });

    it(`${mood}: notes stay inside their bar, in a comfortable range and volume`, () => {
      const len = barSeconds(mood);
      for (const events of bars(mood, 300, 3)) {
        expect(events.some((e) => e.voice === 'bass' && e.at === 0)).toBe(true);
        expect(events.some((e) => e.voice === 'pluck' && e.at === 0)).toBe(true);
        for (const e of events) {
          expect(e.at).toBeGreaterThanOrEqual(0);
          expect(e.at).toBeLessThan(len);
          expect(e.dur).toBeGreaterThan(0);
          expect(e.vol).toBeGreaterThan(0);
          expect(e.vol).toBeLessThanOrEqual(1);
          if (PITCHED.has(e.voice)) {
            expect(e.midi).toBeGreaterThanOrEqual(36);
            expect(e.midi).toBeLessThanOrEqual(96);
          }
        }
      }
    });
  }

  it('is the same for the same seed', () => {
    expect(bars('camp', 20, 9)).toEqual(bars('camp', 20, 9));
    expect(bars('camp', 20, 9)).not.toEqual(bars('camp', 20, 10));
  });

  it('is calm: slow tempo, a waltz, and focus music is sparse with no tunes or animal calls', () => {
    for (const m of MOOD_LIST) {
      expect(MOODS[m].bpm).toBeLessThanOrEqual(100);
      expect(barSeconds(m)).toBeGreaterThan(1.5);
    }
    const count = (m: Mood, v: string) => bars(m, 200, 5).flat().filter((e) => e.voice === v).length;
    expect(count('focus', 'bell')).toBe(0);
    expect(count('focus', 'cricket') + count('focus', 'bird')).toBe(0);
    expect(count('focus', 'pluck')).toBeLessThan(count('camp', 'pluck') * 0.7);
    expect(MOODS.focus.level).toBeLessThan(MOODS.camp.level);
    expect(count('camp', 'cricket')).toBeGreaterThan(0);
    expect(count('camp', 'bird')).toBe(0);
    expect(count('dawn', 'bird')).toBeGreaterThan(0);
    expect(count('dawn', 'cricket')).toBe(0);
  });

  it('camp and focus share harmony, so moving into a question keeps the same song', () => {
    expect(MOODS.focus.progression).toEqual(MOODS.camp.progression);
    expect(MOODS.focus.key).toBe(MOODS.camp.key);
    expect(MOODS.focus.bpm).toBe(MOODS.camp.bpm);
  });
});
