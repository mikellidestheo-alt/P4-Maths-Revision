import { describe, expect, it } from 'vitest';
import { WEAR, lookKey, lookOf } from './look';
import { SHOP, SHOP_GROUPS } from './shop';

describe('camper look', () => {
  it('defaults to the boy camper with nothing extra', () => {
    const l = lookOf({ lantern: 'lantern-gold' });
    expect(l).toMatchObject({ avatar: 'boy', pattern: 'plain', head: null, face: null, neck: null, back: null });
  });

  it('girl camper, and clothes from the shop', () => {
    const l = lookOf({ avatar: 'girl', top: 'wear-top-star', head: 'wear-head-ears', face: 'wear-face-glasses', neck: 'wear-neck-scarf', back: 'wear-back-cape' });
    expect(l).toMatchObject({ avatar: 'girl', shirt: '#27346b', pattern: 'star', head: 'wear-head-ears', face: 'wear-face-glasses', neck: 'wear-neck-scarf', back: 'wear-back-cape' });
    expect(lookOf({ avatar: 'girl' }).shirt).not.toBe(lookOf({ avatar: 'boy' }).shirt);
  });

  it('ignores items in the wrong slot or unknown ids (old or broken saves)', () => {
    const l = lookOf({ head: 'wear-top-red', face: 'nope', top: 'decor-rug', avatar: 'robot' });
    expect(l).toMatchObject({ avatar: 'boy', head: null, face: null, pattern: 'plain' });
  });

  it('the look key changes whenever anything visible changes', () => {
    const a = lookKey(lookOf({}));
    expect(lookKey(lookOf({ avatar: 'girl' }))).not.toBe(a);
    expect(lookKey(lookOf({ head: 'wear-head-pirate' }))).not.toBe(a);
    expect(lookKey(lookOf({ top: 'wear-top-red' }))).not.toBe(a);
    expect(lookKey(lookOf({}))).toBe(a);
  });

  it('every camper item is in the shop, in its own slot, with a fair price; shop sections list each item once', () => {
    for (const w of WEAR) {
      const it = SHOP.find((x) => x.id === w.id)!;
      expect(it, w.id).toBeTruthy();
      expect(it.slot).toBe(w.slot);
      expect(it.exclusive).toBe(true);
      expect(w.price).toBeGreaterThanOrEqual(15);
      expect(w.price).toBeLessThanOrEqual(40);
      if (w.slot === 'top') expect(w.colour).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(SHOP.map((x) => x.id)).size).toBe(SHOP.length);
    const grouped = SHOP_GROUPS.flatMap((g) => SHOP.filter((x) => g.slots.includes(x.slot)).map((x) => x.id));
    expect(grouped.sort()).toEqual(SHOP.map((x) => x.id).sort());
  });
});
