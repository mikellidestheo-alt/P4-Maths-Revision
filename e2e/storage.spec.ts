import { test, expect, type Page } from '@playwright/test';
import { openGame, playQuestion, readSave, setTouch, walkAndInteract } from './bot';

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

test('first visit goes straight into the 3D camp; there is no grown-ups area', async ({ page }) => {
  await page.goto('./?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 1 of 6');
  await expect(page.locator('[data-quest]')).toContainText('Task 1 of 3: Label the supply crates');
  await expect(page.locator('[data-action="grownups"]')).toHaveCount(0);
  await expect(page.locator('[data-action="sound"]')).toBeVisible();
  await expect(page.locator('.world-canvas canvas')).toBeVisible();
});

test('3D: the marker moves along the path; closing mid-job resumes at the same task', async ({ page }) => {
  await page.goto('./?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await walkAndInteract(page);
  for (let i = 0; i < 3; i++) await playQuestion(page);
  await page.reload();
  await expect(page.locator('[data-quest]')).toContainText('Task 1 of 3');
  await walkAndInteract(page);
  await expect(page.locator('.dot.done')).toHaveCount(3);
  for (let i = 0; i < 7; i++) await playQuestion(page);
  await page.locator('[data-action="job-back"]').tap();
  await expect(page.locator('[data-quest]')).toContainText('Task 2 of 3: Fix the trail markers');
  // the next marker is further along the path, away from camp
  const w = await page.evaluate(() => { const x = (window as any).__campWorld; return { p: x.pos, t: x.state.objective.point }; });
  expect(Math.hypot(w.t.x, w.t.z)).toBeGreaterThan(Math.hypot(w.p.x, w.p.z) + 8);
});

test('3D: walking with the keyboard moves the camper', async ({ page }) => {
  await page.goto('./?bot=1');
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  const before = await page.evaluate(() => ({ ...(window as any).__campWorld.pos }));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowUp');
  const after = await page.evaluate(() => ({ ...(window as any).__campWorld.pos }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
});

test('no night limit: after five nights today, Night 6 can start straight away; replays always work', async ({ page }) => {
  await page.goto('./?bot=1&2d=1');
  await openGame(page);
  await inject(page, { nights: { 1: done(), 2: done(), 3: done(), 4: done(), 5: done() } });
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 6/);
  await expect(page.locator('.sleep-note, .pace-note')).toHaveCount(0);
  await page.locator('[data-moon="1"]').click();
  await page.locator('[data-modal="Replay Night 1"]').click();
  await expect(page.locator('[data-screen="night"]')).toContainText('(replay)');
});

test('story order still applies: a later night opens when the one before is finished', async ({ page }) => {
  await page.goto('./?bot=1&2d=1');
  await openGame(page);
  await expect(page.locator('[data-moon="2"]')).toBeDisabled();
  await inject(page, { nights: { 1: done() } });
  await expect(page.locator('[data-moon="2"]')).toBeEnabled();
  await expect(page.locator('[data-moon="3"]')).toBeDisabled();
});

test('works with storage blocked (private mode) and says progress will not be saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError: storage blocked'); } });
  });
  await page.goto('./?bot=1&2d=1');
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
  await page.goto('./?bot=1&2d=1');
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
  expect(save.schemaVersion).toBe(3);
  expect(save).not.toHaveProperty('daily');
  expect(save).not.toHaveProperty('pin');
  expect(errors).toEqual([]);
});

test('2D fallback: closing the app mid-night resumes where she left off', async ({ page }) => {
  await page.goto('./?bot=1&2d=1');
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
