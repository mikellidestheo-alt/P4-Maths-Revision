import { T16, type Tier } from '../config/difficulty';
import { makeQuestion, num } from '../engine/build';
import { parse12, parse24, parseClockFace, parseNumber, parseTime } from '../engine/answers';
import { clockFace, duration, time12, time24 } from '../engine/format';
import type { Rng } from '../engine/rng';
import type { Answer, CheckResult, GenContext, Question, Token, TopicModule } from '../engine/types';
import { pickKind } from './common';

const ID = '1.6';

const randTime = (rng: Rng, lo: number, hi: number, step: number) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
const AMPM: Token = { kind: 'toggle', id: 'ap', label: 'am or pm', options: [{ value: 'am', label: 'am' }, { value: 'pm', label: 'pm' }] };

function durationMsg(got: number, total: number): CheckResult {
  if (Math.abs(got - total) === 40 || Math.abs(got - total) === 80) return { correct: false, feedback: 'Remember: an hour has 60 minutes, not 100!' };
  if (got > total) return { correct: false, feedback: 'That’s a bit too long. Count on from the start time.' };
  return { correct: false, feedback: 'That’s a bit too short. Count on from the start time.' };
}

function workedInterval(a: number, b: number, show: (m: number) => string): string[] {
  const total = (b - a + 1440) % 1440;
  const lines: string[] = [];
  const toHour = (60 - (a % 60)) % 60;
  if (toHour && toHour < total) {
    lines.push(`${show(a)} → ${show(a + toHour)} is ${toHour} minutes.`);
    const rest = total - toHour;
    const h = Math.floor(rest / 60), m = rest % 60;
    if (h) lines.push(`${show(a + toHour)} → ${show(a + toHour + h * 60)} is ${h} hour${h === 1 ? '' : 's'}.`);
    if (m) lines.push(`${show(a + toHour + h * 60)} → ${show(b)} is ${m} minutes.`);
  }
  lines.push(`Altogether: ${duration(total)}.`);
  return lines;
}

function genSetClock(rng: Rng, tier: Tier): Question {
  const step = 5;
  const start = randTime(rng, 60, 715, step);
  const d = randTime(rng, tier === 1 ? 15 : 10, tier === 1 ? 60 : tier === 2 ? 150 : 200, tier === 1 ? 15 : 5);
  const end = (start + d) % 720;
  const expected = clockFace(end);
  const check = (a: Answer): CheckResult => {
    const m = parseClockFace(String(a));
    if (m === null) return { correct: false, feedback: 'Set both hands on the clock.' };
    if (m === end) return { correct: true };
    if (m === (start - d + 720) % 720) return { correct: false, feedback: 'That’s earlier! Count forwards round the clock.' };
    if (m % 60 === end % 60) return { correct: false, feedback: 'The minute hand is right! Now check the hour hand.' };
    if (Math.floor(m / 60) === Math.floor(end / 60)) return { correct: false, feedback: 'The hour is right. Count on the minutes in fives.' };
    return { correct: false, feedback: `Start at ${clockFace(start)} and count on ${duration(d)}.` };
  };
  return makeQuestion({
    topicId: ID, kind: 'setClock', tier,
    story: `Tock the owl will hoot ${duration(d)} after ${clockFace(start)}.`,
    prompt: `Set the clock to the time Tock will hoot.`,
    interaction: { type: 'clock', start },
    expected,
    check,
    hint: d >= 60 ? 'Move the hour hand on first for whole hours, then count on the minutes in fives.' : 'Count on in fives with the minute hand: 5, 10, 15…',
    worked: [`${clockFace(start)} + ${duration(d)} = ${clockFace(end)}`],
    answerText: clockFace(end),
    sig: [start, d],
    fallback: {
      label: 'Type the time instead',
      interaction: { type: 'fields', tokens: [{ kind: 'time', id: 'a', label: 'time' }] },
      expected: { a: expected },
      toMain: (a) => (parseTime(a.a ?? '') ? String(a.a) : null),
    },
    wrongExample: clockFace((end + 60) % 720),
  });
}

function intervalTimes(rng: Rng, tier: Tier) {
  const step = T16.minuteStep[tier];
  const d = randTime(rng, 20, T16.maxInterval[tier], step);
  let a: number;
  if (tier === 3 && rng.chance(0.3)) {
    a = randTime(rng, 20 * 60, 23 * 60 + 55, step); // evening → may cross midnight ("until dawn")
  } else if (tier === 1) {
    a = randTime(rng, 13 * 60, 23 * 60 - d, step); // pm only
  } else {
    a = randTime(rng, 6 * 60, 23 * 60 + 50 - d, step);
  }
  return { a, b: (a + d) % 1440, d };
}

function genElapsed(rng: Rng, tier: Tier): Question {
  const { a, b, d } = intervalTimes(rng, tier);
  const use24 = T16.use24h[tier] && (tier === 3 || rng.chance(0.5));
  const show = use24 ? time24 : time12;
  const crosses = a + d >= 1440;
  const tokens: Token[] = [num('h', 'hours'), 'hours', num('m', 'minutes'), 'minutes'];
  return makeQuestion({
    topicId: ID, kind: 'elapsed', tier,
    story: crosses ? 'How long is it until dawn?' : 'How long will the night walk take?',
    prompt: `From ${show(a)} to ${show(b)}${crosses ? ' the next morning' : ''}. How long is that?`,
    interaction: { type: 'fields', tokens },
    expected: { h: String(Math.floor(d / 60)), m: String(d % 60) },
    check(ans: Answer) {
      const r = ans as Record<string, string>;
      const h = parseNumber(r.h || '0'), m = parseNumber(r.m || '0');
      if (h === null || m === null) return { correct: false, feedback: 'Type the hours and the minutes.' };
      const got = h * 60 + m;
      if (got === d) return m >= 60 ? { correct: true, feedback: `Right! That’s the same as ${duration(d)}.` } : { correct: true };
      return durationMsg(got, d);
    },
    hint: 'Count on to the next o’clock first, then whole hours, then the minutes left.',
    worked: workedInterval(a, b, show),
    answerText: duration(d),
    sig: [a, d, use24],
    wrongExample: { h: String(Math.floor(d / 60) + 1), m: String(d % 60) },
  });
}

function genEndTime(rng: Rng, tier: Tier, backwards = false): Question {
  const step = T16.minuteStep[tier];
  const d = randTime(rng, 15, Math.min(T16.maxInterval[tier], 240), step);
  const use24 = T16.use24h[tier] && rng.chance(tier === 3 ? 0.8 : 0.5);
  // keep inside one day so no date change is needed; 12-hour versions stay within am or pm unless tier 3
  let lo = 6 * 60, hi = 23 * 60 + 55 - d;
  if (!use24 && tier < 3) {
    const pm = rng.chance(0.6);
    lo = pm ? 12 * 60 + 5 : 6 * 60;
    hi = (pm ? 23 * 60 + 55 : 11 * 60 + 55) - d;
  }
  if (hi < lo) hi = lo;
  const start = randTime(rng, lo, hi, step);
  const end = start + d;
  const [known, ans] = backwards ? [end, start] : [start, end];
  const show = use24 ? time24 : time12;
  const tokens: Token[] = use24 ? [{ kind: 'time', id: 'a', label: '24-hour time' }] : [{ kind: 'time', id: 'a', label: 'time' }, AMPM];
  const expected: Record<string, string> = use24 ? { a: time24(ans) } : { a: time12(ans).split(' ')[0], ap: ans < 720 ? 'am' : 'pm' };
  return makeQuestion({
    topicId: ID, kind: backwards ? 'startTime' : 'endTime', tier,
    story: backwards ? 'The campfire story has just finished.' : 'The forest walk is about to start.',
    prompt: backwards
      ? `It ended at ${show(known)} and lasted ${duration(d)}. What time did it start?${use24 ? ' (24-hour)' : ''}`
      : `It starts at ${show(known)} and lasts ${duration(d)}. What time will it finish?${use24 ? ' (24-hour)' : ''}`,
    interaction: { type: 'fields', tokens },
    expected,
    check(a: Answer) {
      const r = a as Record<string, string>;
      const got = use24 ? parse24(r.a ?? '') : parse12(r.a ?? '', r.ap ?? '');
      if (got === null) return { correct: false, feedback: use24 ? 'Type a time like 18:45.' : 'Type a time like 7:45 and choose am or pm.' };
      if (got === ans) return { correct: true };
      if (use24 && got + 720 === ans) return { correct: false, feedback: 'In 24-hour time, afternoon and evening hours are 12 to 23.' };
      if (!use24 && got % 720 === ans % 720) return { correct: false, feedback: 'The time is right — check am or pm!' };
      if (got === (backwards ? known + d : known - d)) return { correct: false, feedback: backwards ? 'Count backwards from the end time.' : 'Count forwards from the start time.' };
      if (Math.abs(got - ans) === 40) return { correct: false, feedback: 'Remember: an hour has 60 minutes, not 100!' };
      return { correct: false, feedback: backwards ? 'Count back the hours first, then the minutes.' : 'Count on the hours first, then the minutes.' };
    },
    hint: backwards ? 'Count back the whole hours first, then the minutes.' : 'Add the whole hours first, then count on the minutes.',
    worked: backwards
      ? [`${show(known)} − ${duration(d)} = ${show(ans)}`]
      : [`${show(known)} + ${duration(d)} = ${show(ans)}`],
    answerText: show(ans),
    sig: [known, d, use24, backwards],
    wrongExample: use24 ? { a: time24(ans + 60) } : { ...expected, a: time12(ans + 60).split(' ')[0], ap: (ans + 60) < 720 ? 'am' : 'pm' },
  });
}

function genConvert(rng: Rng, tier: Tier): Question {
  const toMinutes = tier === 1 || rng.chance(0.5);
  const step = tier === 1 ? 15 : 5;
  const total = randTime(rng, 65, tier === 1 ? 225 : 400, step);
  const h = Math.floor(total / 60), m = total % 60;
  if (toMinutes) {
    return makeQuestion({
      topicId: ID, kind: 'convert', tier,
      story: 'Tock is counting how long the owls slept.',
      prompt: `How many minutes is ${duration(total)}?`,
      interaction: { type: 'fields', tokens: [num('a', 'minutes'), 'minutes'] },
      expected: { a: String(total) },
      check(a: Answer) {
        const n = parseNumber((a as Record<string, string>).a ?? '');
        if (n === null) return { correct: false, feedback: 'Type a number of minutes.' };
        if (n === total) return { correct: true };
        if (n === h * 100 + m) return { correct: false, feedback: 'An hour is 60 minutes, not 100!' };
        return { correct: false, feedback: n > total ? 'Too many minutes.' : 'Not enough minutes.' };
      },
      hint: `1 hour = 60 minutes. So ${h} hour${h === 1 ? '' : 's'} = ${h} × 60 minutes.`,
      worked: m ? [`${h} × 60 = ${h * 60} minutes`, `${h * 60} + ${m} = ${total} minutes`] : [`${h} × 60 = ${total} minutes`],
      answerText: `${total} minutes`,
      sig: [total, 'toMin'],
      wrongExample: { a: String(total + 10) },
    });
  }
  return makeQuestion({
    topicId: ID, kind: 'convert', tier,
    story: 'The owls slept for a long time!',
    prompt: `Change ${total} minutes into hours and minutes.`,
    interaction: { type: 'fields', tokens: [num('h', 'hours'), 'hours', num('m', 'minutes'), 'minutes'] },
    expected: { h: String(h), m: String(m) },
    check(a: Answer) {
      const r = a as Record<string, string>;
      const hh = parseNumber(r.h || '0'), mm = parseNumber(r.m || '0');
      if (hh === null || mm === null) return { correct: false, feedback: 'Type the hours and the minutes.' };
      if (hh === h && mm === m) return { correct: true };
      if (hh * 60 + mm === total) return { correct: false, feedback: 'That adds up, but the minutes should be less than 60. Make another hour!' };
      return { correct: false, feedback: 'How many lots of 60 fit into the minutes?' };
    },
    hint: 'How many 60s fit in? Those are the hours. What’s left over is the minutes.',
    worked: [`${h} × 60 = ${h * 60}`, `${total} − ${h * 60} = ${m}`, `So ${total} minutes = ${duration(total)}.`],
    answerText: duration(total),
    sig: [total, 'toHM'],
    wrongExample: { h: String(h + 1), m: String(m) },
  });
}

function genSwap(rng: Rng, tier: Tier): Question {
  const t = randTime(rng, 0, 1435, 5);
  const to24 = rng.chance(0.6);
  if (to24) {
    return makeQuestion({
      topicId: ID, kind: 'swap', tier,
      story: 'The ranger’s watch uses the 24-hour clock.',
      prompt: `Write ${time12(t)} as a 24-hour time.`,
      interaction: { type: 'fields', tokens: [{ kind: 'time', id: 'a', label: '24-hour time' }] },
      expected: { a: time24(t) },
      check(a: Answer) {
        const got = parse24((a as Record<string, string>).a ?? '');
        if (got === null) return { correct: false, feedback: 'Type a time like 19:35.' };
        if (got === t) return { correct: true };
        if (t >= 780 && got === t - 720) return { correct: false, feedback: 'It’s pm — add 12 to the hours.' };
        if (t < 60 && got === t + 720) return { correct: false, feedback: '12 midnight is 00 in 24-hour time.' };
        return { correct: false, feedback: 'For pm times add 12 to the hour. For am times the hour stays the same.' };
      },
      hint: 'From 1 pm onwards, add 12 to the hour. Morning times keep the same hour.',
      worked: [t >= 780 ? `${time12(t)} is pm, so add 12 to the hour: ${time24(t)}` : `${time12(t)} → ${time24(t)}`],
      answerText: time24(t),
      sig: [t, 'to24'],
      wrongExample: { a: time24(t + 60) },
    });
  }
  const parts = time12(t).split(' ');
  return makeQuestion({
    topicId: ID, kind: 'swap', tier,
    story: 'Wren’s old watch only shows 12 hours.',
    prompt: `Write ${time24(t)} as a 12-hour time.`,
    interaction: { type: 'fields', tokens: [{ kind: 'time', id: 'a', label: 'time' }, AMPM] },
    expected: { a: parts[0], ap: parts[1] },
    check(a: Answer) {
      const r = a as Record<string, string>;
      const got = parse12(r.a ?? '', r.ap ?? '');
      if (got === null) return { correct: false, feedback: 'Type a time like 7:35 and choose am or pm.' };
      if (got === t) return { correct: true };
      if (got % 720 === t % 720) return { correct: false, feedback: 'Nearly — check am or pm.' };
      return { correct: false, feedback: 'If the hour is 13 or more, take away 12 and it’s pm.' };
    },
    hint: 'If the hour is more than 12, take away 12. Times after 12 noon are pm.',
    worked: [`${time24(t)} → ${time12(t)}`],
    answerText: time12(t),
    sig: [t, 'to12'],
    wrongExample: { a: parts[0], ap: parts[1] === 'am' ? 'pm' : 'am' },
  });
}

const GENS: Record<string, (rng: Rng, tier: Tier) => Question> = {
  setClock: genSetClock,
  elapsed: genElapsed,
  endTime: (r, t) => genEndTime(r, t, false),
  startTime: (r, t) => genEndTime(r, t, true),
  convert: genConvert,
  swap: genSwap,
};

export const topic16: TopicModule = {
  id: ID,
  title: 'Time intervals',
  job: 'Wind the night clock',
  unit: 1,
  kinds: Object.keys(GENS),
  generate(rng: Rng, tier: Tier, ctx: GenContext) {
    const kind = pickKind(rng, ctx, { setClock: [4, 3, 2], elapsed: [2, 3, 3], endTime: [2, 2, 2], startTime: [0, 1, 2], convert: [2, 1, 1], swap: [0, 2, 1] }, tier);
    return GENS[kind](rng, tier);
  },
};
