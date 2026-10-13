/**
 * Game rules that used to be grown-up settings. Change here and redeploy.
 */
export type Spook = 'cosy' | 'mild' | 'spooky';

export const GAME = {
  /** New nights that can be finished per calendar day (replays never count). 0 = no limit. */
  nightsPerDay: 3,
  /** Cosy: gentle mist, one pair of friendly eyes. Mild / spooky: more mist and eyes (never scary). */
  spook: 'cosy' as Spook,
};
