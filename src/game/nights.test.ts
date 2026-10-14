import { describe, expect, it } from 'vitest';
import { NIGHTS, REVIEW_JOBS, nightMaths } from './nights';
import { TOPICS } from '../topics';

describe('night maths list (night picker)', () => {
  it('lists every job of every night, in order, using the topic titles', () => {
    for (const night of NIGHTS) {
      const list = nightMaths(night.n);
      expect(list.map((x) => x.id)).toEqual(night.jobs);
      for (const x of list) {
        expect(x.label.length).toBeGreaterThan(3);
        if (TOPICS[x.id]) expect(x.label).toBe(TOPICS[x.id].title);
      }
    }
  });

  it('review labels name the nights their questions really come from', () => {
    const nightOfTopic = (t: string) => NIGHTS.find((n) => n.jobs.includes(t))!.n;
    const nights = (id: string) => [...new Set(REVIEW_JOBS[id].topics.map(nightOfTopic))].sort();
    expect(nights('R1')).toEqual([1, 2, 3]);
    expect(nightMaths(3)[2].label).toContain('Nights 1–3');
    expect(nights('R2')).toEqual([4, 5, 6]);
    expect(nightMaths(6)[1].label).toContain('Nights 4–6');
    expect(nights('F')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(nightMaths(6)[2].label).toContain('everything');
  });
});
