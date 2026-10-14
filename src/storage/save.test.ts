import { describe, expect, it } from 'vitest';
import { defaultSave, migrate, SCHEMA_VERSION } from './save';

describe('save migration', () => {
  it('v1/v2 saves keep their progress and lose the parent data and daily counter', () => {
    const v1 = {
      schemaVersion: 1, setupDone: true, pin: '1234', nickname: 'Robin',
      settings: { pacing: 2, spook: 'mild', sound: false, motion: 'reduce', textSize: 'xl' },
      nights: { 1: { finished: true, bestStars: 3, plays: 1 } }, unlockedByParent: [4],
      daily: { date: '2026-10-17', newNightsFinished: 1 }, coins: 42, coinsEarnedTotal: 50,
      owned: ['lantern-gold', 'decor-rug'], equipped: { lantern: 'lantern-gold' }, nudge: 1,
      checkins: [{ night: 1, fun: 'great', level: 'easy', at: 'x' }],
      topics: { '1.1': { attempts: 10, firstTry: 9, eventual: 10, recapTries: 0, recapFixed: 0, missed: [] } },
      flags: { installHintSeen: true, dawnSeen: false, storageWarned: true },
    };
    const d = migrate(v1) as unknown as Record<string, unknown>;
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    for (const gone of ['pin', 'nickname', 'setupDone', 'unlockedByParent', 'checkins', 'daily']) expect(d, gone).not.toHaveProperty(gone);
    expect(d.settings).toEqual({ sound: false, music: true });
    expect(d.coins).toBe(42);
    expect((d.nights as Record<string, { finished: boolean }>)['1'].finished).toBe(true);
    expect(d.owned).toContain('decor-rug');
    expect(d.nudge).toBe(1);
    expect(d.flags).toEqual({ installHintSeen: true, dawnSeen: false, allUnlocked: false });
  });

  it('rubbish input gives a fresh save', () => {
    expect(migrate(null)).toMatchObject({ coins: 0, nights: {} });
    expect(migrate({ coins: -5, nudge: 9 })).toMatchObject({ coins: 0, nudge: 1 });
    expect(Object.keys(defaultSave())).not.toContain('pin');
  });
});
