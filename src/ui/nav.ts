import type { App } from './app';
import type { NightSummary } from '../game/progress';

/** Screen routes. Filled in by screens/index.ts (avoids import cycles between screens). */
export const nav = {
  home: (_app: App) => {},
  night: (_app: App, _n: number) => {},
  job: (_app: App, _jobId: string) => {},
  campfire: (_app: App) => {},
  recap: (_app: App) => {},
  rescue: (_app: App) => {},
  checkin: (_app: App, _s: NightSummary) => {},
  rest: (_app: App) => {},
  dawn: (_app: App) => {},
  shop: (_app: App) => {},
  friends: (_app: App) => {},
};
