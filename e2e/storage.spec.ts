import { test, expect, type Page } from '@playwright/test';
import { playQuestion, readSave, setTouch, setupFirstRun } from './bot';

const KEY = 'sixNightsCamp.save';

async function inject(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(([k, p]) => {
    const cur = JSON.parse(localStorage.getItem(k as string) || '{}');
    localStorage.setItem(k as string, JSON.stringify({ ...cur, ...(p as object) }));
  }, [KEY, patch] as const);
  await page.reload();
}

async function openParent(page: Page) {
  await page.locator('[data-action="grownups"]').click();
  await page.locator('[data-action="hold"]').dispatchEvent('pointerdown');
  await expect(page.locator('[data-screen="parent"]')).toBeVisible({ timeout: 6000 });
}

test.beforeEach(() => setTouch(true));

test('daily allowance resets by calendar date; replays never count; parent can reset the day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T10:00:00') });
  await page.goto('./?bot=1');
  await setupFirstRun(page, { pacing: 1 });
  await inject(page, { nights: { 1: { finished: true, bestStars: 2, plays: 1 } }, daily: { date: '2026-10-17', newNightsFinished: 1 } });
  // 1 night a day, already used: the camp is asleep
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.locator('[data-action="start"]')).toHaveCount(0);
  await expect(page.locator('.sleep-note')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/pacing-asleep.png' });
  // tapping the sleeping moon shows the rest screen
  await page.locator('[data-moon="2"]').click();
  await expect(page.locator('[data-screen="rest"]')).toBeVisible();
  await page.locator('[data-action="rest-home"]').click();
  // replay of Night 1 is still allowed
  await page.locator('[data-moon="1"]').click();
  await page.locator('[data-modal="Replay Night 1"]').click();
  await expect(page.locator('[data-screen="night"]')).toContainText('(replay)');
  await page.locator('[data-action="back"]').click();
  // grown-up resets today's allowance
  await openParent(page);
  await page.locator('[data-action="reset-day"]').click();
  await page.locator('[data-action="back"]').click();
  // the replay in progress has to be finished first, so drop it for this check
  await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)!); d.current = null; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 2/);
  // and the next calendar day brings a fresh allowance on its own
  await inject(page, { daily: { date: '2026-10-17', newNightsFinished: 1 } });
  await expect(page.locator('[data-action="start"]')).toHaveCount(0);
  await page.clock.setSystemTime(new Date('2026-10-18T07:30:00'));
  await page.reload();
  await expect(page.locator('[data-action="start"]')).toHaveText(/Start Night 2/);
  const save = await readSave(page);
  expect(save.daily.date).toBe('2026-10-18');
});

test('parent can unlock a night; it can then be started from the moons', async ({ page }) => {
  await page.goto('./?bot=1');
  await setupFirstRun(page);
  await expect(page.locator('[data-moon="4"]')).toBeDisabled();
  await openParent(page);
  await page.locator('[data-unlock="4"]').click();
  await expect(page.locator('[data-unlock="4"]')).toBeDisabled();
  await page.locator('[data-action="back"]').click();
  await page.locator('[data-moon="4"]').click();
  await expect(page.locator('[data-screen="night"]')).toHaveAttribute('data-night', '4');
});

test('PIN gate: wrong PIN refused, right PIN opens the grown-ups area', async ({ page }) => {
  await page.goto('./?bot=1');
  await setupFirstRun(page, { pin: '2468' });
  await page.locator('[data-action="grownups"]').click();
  for (const k of '1111') await page.locator(`[data-pin-key="${k}"]`).click();
  await expect(page.locator('.form-error')).toContainText('isn’t right');
  await page.waitForTimeout(500);
  for (const k of '2468') await page.locator(`[data-pin-key="${k}"]`).click();
  await expect(page.locator('[data-screen="parent"]')).toBeVisible();
});

test('progress code: export, wipe, import round trip', async ({ page }) => {
  await page.goto('./?bot=1');
  await setupFirstRun(page, { nickname: 'Robin' });
  await inject(page, { coins: 77, owned: ['lantern-gold', 'decor-rug'], nights: { 1: { finished: true, bestStars: 3, plays: 1 }, 2: { finished: true, bestStars: 2, plays: 1 } }, topics: { '1.1': { attempts: 10, firstTry: 8, eventual: 10, recapTries: 0, recapFixed: 0, missed: [] } } });
  await openParent(page);
  await page.locator('[data-action="make-code"]').click();
  const code = await page.locator('[data-code-out]').inputValue();
  expect(code).toMatch(/^CAMP1\./);
  // a different device: empty storage
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await setupFirstRun(page);
  await openParent(page);
  await page.locator('[data-code-in]').fill(code + 'x');
  await page.locator('[data-action="load-code"]').click();
  await expect(page.locator('[data-load-msg]')).toContainText('doesn’t look right');
  await page.locator('[data-code-in]').fill(code);
  await page.locator('[data-action="load-code"]').click();
  await page.locator('[data-modal="Yes, replace it"]').click();
  const save = await readSave(page);
  expect(save.coins).toBe(77);
  expect(save.nickname).toBe('Robin');
  expect(save.nights['2'].finished).toBe(true);
  expect(save.topics['1.1'].firstTry).toBe(8);
  expect(save.owned).toContain('decor-rug');
});

test('works with storage blocked (private mode) and warns the grown-up', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError: storage blocked'); } });
  });
  await page.goto('./?bot=1');
  await setupFirstRun(page);
  await expect(page.locator('.warn-note')).toBeVisible();
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.1"]').tap();
  await playQuestion(page);
  await playQuestion(page);
  await expect(page.locator('.dot.done')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a corrupted save does not crash the game', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?bot=1');
  await page.evaluate((k) => localStorage.setItem(k, '{"schemaVersion":1, "nights": {broken'), KEY);
  await page.reload();
  await expect(page.locator('[data-screen="first-run"]')).toBeVisible();
  const backup = await page.evaluate((k) => localStorage.getItem(k + '.corrupt'), KEY);
  expect(backup).toContain('broken');
  // a save from an older/partial shape is migrated, not thrown away
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ schemaVersion: 0, setupDone: true, coins: 12, nights: { 1: { finished: true, bestStars: 1, plays: 1 } } })), KEY);
  await page.reload();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.locator('[data-coins]')).toHaveText('12');
  await expect(page.locator('[data-tonight]')).toHaveAttribute('data-tonight', '2');
  expect(errors).toEqual([]);
});

test('closing the app mid-night resumes where she left off', async ({ page }) => {
  await page.goto('./?bot=1');
  await setupFirstRun(page);
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
