/**
 * Versioned save data, kept only on this device (localStorage).
 * Everything is wrapped in try/catch: if storage is unavailable (private mode, blocked) the game
 * still works using memory only, and the home screen says so.
 */
import type { JobState, MissEntry } from '../engine/planner';
import { now } from '../game/clock';

export const SAVE_KEY = 'sixNightsCamp.save';
export const SCHEMA_VERSION = 3;

export interface Settings {
  sound: boolean;
  /** background music (only plays while sound is on too) */
  music: boolean;
}

export interface MissRecord extends MissEntry {
  prompt: string;
  story: string;
  answer: string;
  at: string;
  night: number;
  fixed?: boolean;
}

export interface TopicStats {
  attempts: number;
  firstTry: number;
  eventual: number;
  recapTries: number;
  recapFixed: number;
  missed: MissRecord[];
}

export interface JobRun extends JobState {
  done: boolean;
}

export interface NightRun {
  night: number;
  replay: boolean;
  startedAt: string;
  jobs: Record<string, JobRun>;
  misses: MissRecord[];
  recap: { queue: MissEntry[]; index: number; fixed: number } | null;
  stage: 'day' | 'campfire' | 'recap' | 'rescue' | 'checkin';
  coins: number;
  firstTry: number;
  answered: number;
  /** set when the friend is rescued (so a reload doesn't score the night twice) */
  summary?: {
    night: number; stars: 1 | 2 | 3; coins: number; firstFinish: boolean; firstTry: number; answered: number; recapFixed: number; recapTotal: number;
  };
}

export interface NightRecord {
  finished: boolean;
  firstFinishedAt?: string;
  bestStars: number;
  plays: number;
}

export interface SaveData {
  schemaVersion: number;
  createdAt: string;
  settings: Settings;
  nights: Record<string, NightRecord>;
  current: NightRun | null;
  topics: Record<string, TopicStats>;
  coins: number;
  coinsEarnedTotal: number;
  owned: string[];
  equipped: Record<string, string>;
  /** -1 easier, 0 normal, +1 harder (from the end-of-night "was the maths…" answer) */
  nudge: number;
  flags: { installHintSeen: boolean; dawnSeen: boolean };
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date(now()).toISOString(),
    settings: { sound: true, music: true },
    nights: {},
    current: null,
    topics: {},
    coins: 0,
    coinsEarnedTotal: 0,
    owned: ['lantern-gold'],
    equipped: { lantern: 'lantern-gold' },
    nudge: 0,
    flags: { installHintSeen: false, dawnSeen: false },
  };
}

/**
 * Bring any older / partial save up to the current schema without losing progress.
 * v1 → v2: the grown-ups area was removed (PIN, nickname, pacing/spookiness/motion/text settings,
 * parent unlocks and check-in history are dropped; nights, coins, shop items and history are kept).
 * v2 → v3: the daily night limit was removed (the daily counter is dropped).
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const out: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : base.createdAt,
    settings: {
      sound: typeof r.settings?.sound === 'boolean' ? r.settings.sound : true,
      music: typeof r.settings?.music === 'boolean' ? r.settings.music : true,
    },
    nights: { ...(r.nights ?? {}) },
    current: r.current ?? null,
    topics: { ...(r.topics ?? {}) },
    coins: typeof r.coins === 'number' && r.coins >= 0 && Number.isFinite(r.coins) ? r.coins : 0,
    coinsEarnedTotal: typeof r.coinsEarnedTotal === 'number' ? r.coinsEarnedTotal : 0,
    owned: Array.isArray(r.owned) ? r.owned : base.owned,
    equipped: { ...base.equipped, ...(r.equipped ?? {}) },
    nudge: typeof r.nudge === 'number' ? Math.max(-1, Math.min(1, Math.round(r.nudge))) : 0,
    flags: { installHintSeen: !!r.flags?.installHintSeen, dawnSeen: !!r.flags?.dawnSeen },
  };
  if (out.current && (typeof out.current.night !== 'number' || !out.current.jobs)) out.current = null;
  return out;
}

export interface Store {
  data: SaveData;
  /** false when the browser won't let us save (memory only) */
  persistent: boolean;
  /** set when a corrupted save was found and replaced */
  recovered: boolean;
  save(): void;
}

function storageWorks(): boolean {
  try {
    const k = '__camp_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function openStore(): Store {
  const persistent = storageWorks();
  let recovered = false;
  let data = defaultSave();
  if (persistent) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        try {
          data = migrate(JSON.parse(raw));
        } catch {
          recovered = true;
          try {
            localStorage.setItem(`${SAVE_KEY}.corrupt`, raw.slice(0, 200_000));
          } catch {
            /* ignore */
          }
          data = defaultSave();
        }
      }
    } catch {
      data = defaultSave();
    }
  }
  const store: Store = {
    data,
    persistent,
    recovered,
    save() {
      if (!store.persistent) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(store.data));
      } catch {
        // quota or blocked: keep playing from memory
      }
    },
  };
  return store;
}
