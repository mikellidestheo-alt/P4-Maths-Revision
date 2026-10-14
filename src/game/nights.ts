import { TOPICS, UNIT1, UNIT2 } from '../topics';
import type { JobDef } from '../engine/planner';

export interface Friend {
  id: string;
  name: string;
  animal: string;
  line: string;
  lostIn: string;
  found: string;
}

export const FRIENDS: Friend[] = [
  { id: 'bramble', name: 'Bramble', animal: 'hedgehog', line: 'Counts everything twice, just to be sure.', lostIn: 'the Bramble Thicket', found: '“I lost count of the stars and wandered off! Thank you for finding me.”' },
  { id: 'tock', name: 'Tock', animal: 'owl', line: 'Never late. Always hoots on the hour.', lostIn: 'the Old Clock Tree', found: '“Hoo-hoo! I was waiting for the right time to come home. That’s now!”' },
  { id: 'juniper', name: 'Juniper', animal: 'fox', line: 'Draws a map of every path she walks.', lostIn: 'the Winding Paths', found: '“My map blew away in the wind. Your map brought me back!”' },
  { id: 'ember', name: 'Ember', animal: 'firefly', line: 'Glows brighter when she’s happy.', lostIn: 'the Misty Meadow', found: '“The mist was so thick! Your campfire glow showed me the way.”' },
  { id: 'lumi', name: 'Lumi', animal: 'moth', line: 'Has perfectly matching wings.', lostIn: 'the Lantern Glade', found: '“I was looking at all the lanterns. Now I’ve found the brightest one — yours!”' },
  { id: 'ripple', name: 'Ripple', animal: 'otter', line: 'Loves pulling faces at his reflection.', lostIn: 'the Mirror Cave', found: '“I thought my reflection was a new friend! But you’re my real friends.”' },
];

export const REVIEW_JOBS: Record<string, JobDef> = {
  R1: { id: 'R1', title: 'Unit 1 review', job: 'Check the map with Wren', topics: UNIT1, review: true },
  R2: { id: 'R2', title: 'Unit 2 review', job: 'Wren’s camp quiz', topics: UNIT2, review: true },
  F: { id: 'F', title: 'Final mixed challenge', job: 'The Dawn Challenge', topics: [...UNIT1, ...UNIT2], review: true },
};

export function jobDef(id: string): JobDef {
  if (REVIEW_JOBS[id]) return REVIEW_JOBS[id];
  const t = TOPICS[id];
  return { id, title: t.title, job: t.job, topics: [id], review: false };
}

/** A short story line shown before each job. */
export const JOB_BLURB: Record<string, string> = {
  '1.1': 'The supply crates have lost their labels! Help Wren write the big numbers.',
  '1.2': 'The wind knocked the trail markers down. Put the right numbers back.',
  '1.3': 'The stockroom is a muddle. Round the piles and sort the boxes.',
  '1.4': 'Cooking for the whole camp! Make recipes 10 or 100 times bigger — or smaller.',
  '1.5': 'An old stone gate only opens when its number patterns are finished.',
  '1.6': 'The night clock tells us how long until dawn. Can you work it out?',
  '1.7': 'New fences and paths are needed. Some must be parallel, some perpendicular.',
  '1.8': 'Supply drops are landing on the camp map. Use coordinates to find them.',
  R1: 'Wren wants to check everything we’ve learned so far before the search.',
  '2.1': 'Quick sums by the fire — add up the supplies in your head.',
  '2.2': 'Share out the supplies. Take away in your head.',
  '2.3': 'The stock book needs adding up. Use the column method.',
  '2.4': 'Balance the stock book: what’s left after the campers took some?',
  '2.5': 'Time to pitch the tents! Every tent is a triangle.',
  '2.6': 'Make lanterns that look the same on both sides.',
  '2.7': 'The bridge in the Mirror Cave is broken. Reflections can fix it!',
  R2: 'Wren has a quiz about everything since Night 4.',
  F: 'The final challenge before dawn: a bit of everything!',
};

export interface NightDef {
  n: number;
  friend: string;
  jobs: string[];
}

export const NIGHTS: NightDef[] = [
  { n: 1, friend: 'bramble', jobs: ['1.1', '1.2', '1.3'] },
  { n: 2, friend: 'tock', jobs: ['1.4', '1.5', '1.6'] },
  { n: 3, friend: 'juniper', jobs: ['1.7', '1.8', 'R1'] },
  { n: 4, friend: 'ember', jobs: ['2.1', '2.2', '2.3'] },
  { n: 5, friend: 'lumi', jobs: ['2.4', '2.5', '2.6'] },
  { n: 6, friend: 'ripple', jobs: ['2.7', 'R2', 'F'] },
];

export const friendOf = (n: number) => FRIENDS.find((f) => f.id === NIGHTS[n - 1].friend)!;

/** Icon (emoji-free SVG key) for each job's sign. */
export const JOB_ICON: Record<string, string> = {
  '1.1': 'crate', '1.2': 'sign', '1.3': 'shelf', '1.4': 'pot', '1.5': 'gate', '1.6': 'clock', '1.7': 'fence', '1.8': 'map', R1: 'star',
  '2.1': 'fire', '2.2': 'basket', '2.3': 'book', '2.4': 'book', '2.5': 'tent', '2.6': 'lantern', '2.7': 'mirror', R2: 'star', F: 'sun',
};

const REVIEW_LABEL: Record<string, string> = {
  R1: 'Review: a mix of Nights 1–3',
  R2: 'Review: a mix of Nights 4–6',
  F: 'Final challenge: a bit of everything',
};

/** The kinds of maths in a night, in play order (shown when choosing a night to replay). */
export function nightMaths(n: number): { id: string; label: string }[] {
  return NIGHTS[n - 1].jobs.map((id) => ({ id, label: REVIEW_LABEL[id] ?? jobDef(id).title }));
}
