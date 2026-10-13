import { test, expect, type Page } from '@playwright/test';
import { openGame, playQuestion, readSave, setTouch } from './bot';

const KEY = 'sixNightsCamp.save';

async function inject(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(([k, p]) => {
    const cur = JSON.parse(localStorage.getItem(k as string) || '{}');
    localStorage.setItem(k as string, JSON.stringify({ ...cur, ...(p as object) }));
  }, [KEY, patch] as const);
  await page.reload();
}

const done = (stars = 2) => ({ finished: true, bestStars: stars, plays: 1 });

test.beforeEach(() => setTouch(true));

test('first visit goes straight to the camp; there is no grown-ups area', async ({ page }) => {
  await page.goto('./?bot=1');
  await openGame(page);
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 1/);
  await expect(page.locator('[data-action="grownups"]')).toHaveCount(0);
  await expect(page.locator('[data-action="sound"]')).toBeVisible();
});

test('3 new nights a day: the camp sleeps, replays still work, and the next day it wakes up', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T10:00:00') });
  await page.goto('./?bot=1');
  await openGame(page);
  await inject(page, { nights: { 1: done(), 2: done(), 3: done() }, daily: { date: '2026-10-17', newNightsFinished: 3 } });
  await expect(page.locator('[data-action="start"]')).toHaveCount(0);
  await expect(page.locator('.sleep-note')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/pacing-asleep.png' });
  // tapping tonight's moon shows the rest screen
  await page.locator('[data-moon="4"]').click();
  await expect(page.locator('[data-screen="rest"]')).toBeVisible();
  await page.locator('[data-action="rest-home"]').click();
  // replaying a finished night is always allowed and does not use the allowance
  await page.locator('[data-moon="1"]').click();
  await page.locator('[data-modal="Replay Night 1"]').click();
  await expect(page.locator('[data-screen="night"]')).toContainText('(replay)');
  await page.locator('[data-action="back"]').click();
  expect((await readSave(page)).daily.newNightsFinished).toBe(3);
  // the next calendar day brings a fresh allowance on its own
  await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)!); d.current = null; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
  await page.clock.setSystemTime(new Date('2026-10-18T07:30:00'));
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 4/);
  const save = await readSave(page);
  expect(save.daily).toEqual({ date: '2026-10-18', newNightsFinished: 0 });
});

test('fewer than 3 nights today: the next night can still be started', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T10:00:00') });
  await page.goto('./?bot=1');
  await openGame(page);
  await inject(page, { nights: { 1: done(), 2: done() }, daily: { date: '2026-10-17', newNightsFinished: 2 } });
  await expect(page.locator('.pace-note')).toHaveText('Nights left today: 1');
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 3/);
});

test('works with storage blocked (private mode) and says progress will not be saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError: storage blocked'); } });
  });
  await page.goto('./?bot=1');
  await openGame(page);
  await expect(page.locator('.warn-note')).toBeVisible();
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.1"]').tap();
  await playQuestion(page);
  await playQuestion(page);
  await expect(page.locator('.dot.done')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a corrupted save does not crash the game; an old save is migrated', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?bot=1');
  await page.evaluate((k) => localStorage.setItem(k, '{"schemaVersion":1, "nights": {broken'), KEY);
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 1/);
  const backup = await page.evaluate((k) => localStorage.getItem(k + '.corrupt'), KEY);
  expect(backup).toContain('broken');
  // a v1 save from before the grown-ups area was removed keeps its progress
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ schemaVersion: 1, setupDone: true, pin: '1234', nickname: 'Robin', coins: 12, nights: { 1: { finished: true, bestStars: 1, plays: 1 } } })), KEY);
  await page.reload();
  await expect(page.locator('[data-coins]')).toHaveText('12');
  await expect(page.locator('[data-tonight]')).toHaveAttribute('data-tonight', '2');
  const save = await readSave(page);
  expect(save.schemaVersion).toBe(2);
  expect(save).not.toHaveProperty('pin');
  expect(errors).toEqual([]);
});

test('closing the app mid-night resumes where she left off', async ({ page }) => {
  await page.goto('./?bot=1');
  await openGame(page);
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.1"]').tap();
  for (let i = 0; i < 3; i++) await playQuestion(page);
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toHaveText(/Continue Night 1/);
  await page.locator('[data-action="start"]').tap();
  await expect(page.locator('[data-job="1.1"]')).toContainText('3/10 done');
  await page.locator('[data-job="1.1"]').tap();
  await expect(page.locator('.dot.done')).toHaveCount(3);
});
