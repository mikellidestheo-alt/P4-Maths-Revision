/**
 * Game settings that are fixed in code. Change here and redeploy.
 * (There is no daily limit on nights: she can play as many as she likes.)
 */
export type Spook = 'cosy' | 'mild' | 'spooky';

export const GAME = {
  /** Cosy: gentle mist, one pair of friendly eyes. Mild / spooky: more mist and eyes (never scary). */
  spook: 'cosy' as Spook,
  /** background music loudness: 1 = normal, 0.5 = half, 0 = no music at all */
  musicVolume: 1,
  /** passcode for the "Unlock All" button on the title screen (opens every night). The repo is public, so this is a gentle gate, not a secret. */
  unlockCode: '1234',
};
