/**
 * Versioned save data, kept only on this device (localStorage).
 * Everything is wrapped in try/catch: if storage is unavailable (private mode, blocked) the game
 * still works using memory only, and the parent area says so.
 */
import type { JobState, MissEntry } from '../engine/planner';
import { localDate, now } from '../game/clock';

export const SAVE_KEY = 'sixNightsCamp.save';
export const SCHEMA_VERSION = 1;

export type Pacing = 0 | 1 | 2 | 3; // 0 = no limit
export type Spook = 'cosy' | 'mild' | 'spooky';

export interface Settings {
  pacing: Pacing;
  spook: Spook;
  sound: boolean;
  motion: 'auto' | 'reduce' | 'full';
  textSize: 'normal' | 'large' | 'xl';
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

export interface CheckIn {
  night: number;
  fun: 'boring' | 'good' | 'great' | null;
  level: 'easy' | 'right' | 'hard' | null;
  at: string;
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
  setupDone: boolean;
  pin: string | null;
  nickname: string;
  settings: Settings;
  nights: Record<string, NightRecord>;
  unlockedByParent: number[];
  daily: { date: string; newNightsFinished: number };
  current: NightRun | null;
  topics: Record<string, TopicStats>;
  coins: number;
  coinsEarnedTotal: number;
  owned: string[];
  equipped: Record<string, string>;
  /** -1 easier, 0 normal, +1 harder (from check-ins) */
  nudge: number;
  checkins: CheckIn[];
  flags: { installHintSeen: boolean; dawnSeen: boolean; storageWarned: boolean };
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date(now()).toISOString(),
    setupDone: false,
    pin: null,
    nickname: '',
    settings: { pacing: 3, spook: 'cosy', sound: true, motion: 'auto', textSize: 'normal' },
    nights: {},
    unlockedByParent: [],
    daily: { date: localDate(), newNightsFinished: 0 },
    current: null,
    topics: {},
    coins: 0,
    coinsEarnedTotal: 0,
    owned: ['lantern-gold'],
    equipped: { lantern: 'lantern-gold' },
    nudge: 0,
    checkins: [],
    flags: { installHintSeen: false, dawnSeen: false, storageWarned: false },
  };
}

/** Bring any older / partial save up to the current schema without losing progress. */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData> & { schemaVersion?: number };
  // Future schema changes go here, e.g. if (r.schemaVersion === 1) { …; r.schemaVersion = 2 }
  const out: SaveData = {
    ...base,
    ...r,
    schemaVersion: SCHEMA_VERSION,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
    flags: { ...base.flags, ...(r.flags ?? {}) },
    nights: { ...(r.nights ?? {}) },
    topics: { ...(r.topics ?? {}) },
    owned: Array.isArray(r.owned) ? r.owned : base.owned,
    equipped: { ...base.equipped, ...(r.equipped ?? {}) },
    unlockedByParent: Array.isArray(r.unlockedByParent) ? r.unlockedByParent : [],
    checkins: Array.isArray(r.checkins) ? r.checkins : [],
  };
  if (![0, 1, 2, 3].includes(out.settings.pacing)) out.settings.pacing = 3;
  if (!['cosy', 'mild', 'spooky'].includes(out.settings.spook)) out.settings.spook = 'cosy';
  if (typeof out.coins !== 'number' || out.coins < 0 || !Number.isFinite(out.coins)) out.coins = 0;
  if (typeof out.nudge !== 'number') out.nudge = 0;
  out.nudge = Math.max(-1, Math.min(1, Math.round(out.nudge)));
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
  replace(d: SaveData): void;
  reset(): void;
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
    replace(d) {
      store.data = migrate(d);
      store.save();
    },
    reset() {
      const keep = { pin: store.data.pin, nickname: store.data.nickname, settings: store.data.settings, setupDone: store.data.setupDone };
      store.data = { ...defaultSave(), ...keep };
      store.save();
    },
  };
  return store;
}

/* ---------- progress code (copy/paste between devices) ---------- */

const CODE_PREFIX = 'CAMP1.';

function checksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(7, '0').slice(-7);
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(b64: string): string {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Export progress (the PIN is left out on purpose). */
export function exportCode(d: SaveData): string {
  const payload = toBase64(JSON.stringify({ ...d, pin: null, current: null }));
  return `${CODE_PREFIX}${payload}.${checksum(payload)}`;
}

export function importCode(code: string): SaveData | null {
  const c = code.replace(/\s+/g, '');
  if (!c.startsWith(CODE_PREFIX)) return null;
  const rest = c.slice(CODE_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = rest.slice(0, dot), sum = rest.slice(dot + 1);
  if (checksum(payload) !== sum) return null;
  try {
    return migrate(JSON.parse(fromBase64(payload)));
  } catch {
    return null;
  }
}
