import { test, expect } from '@playwright/test';
import { enterAnswer, info, playUntil, readSave, setTouch, setupFirstRun } from './bot';

test('wrong-answer flow: hint after 1st miss, worked solution after 2nd, then the Campfire recap', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  setTouch(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?bot=1');
  await setupFirstRun(page);
  await page.locator('[data-action="start"]').tap();
  await page.locator('[data-job="1.2"]').tap();

  // --- first question by hand: miss twice and check what the child sees ---
  await page.waitForFunction(() => (window as any).__camp && !(window as any).__camp.resolved);
  let inf = await info(page);
  const hint = await page.evaluate(() => (window as any).__camp.question.hint);
  await enterAnswer(page, inf, inf.wrong);
  await page.locator('[data-action="check"]').tap();
  await expect(page.locator('.banner')).toHaveClass(/banner-retry/);
  await expect(page.locator('.banner')).toContainText('Not quite');
  await expect(page.locator('.banner')).toContainText(hint);
  await expect(page.locator('[data-action="check"]')).toHaveText('Try again');
  // no red crosses, no lost progress: the dots still show the question as current
  inf = await info(page);
  await enterAnswer(page, inf, inf.wrong);
  await page.locator('[data-action="check"]').tap();
  await expect(page.locator('.worked')).toBeVisible();
  await expect(page.locator('.worked')).toContainText('come back at the campfire');
  await expect(page.locator('[data-action="next"]')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/wrong-worked.png' });
  await page.locator('[data-action="next"]').tap();

  // --- the rest of the night: a mix of misses ---
  const plan = (i: number) => (i % 4 === 0 ? 2 : i % 5 === 2 ? 1 : 0) as 0 | 1 | 2;
  const r = await playUntil(page, (s) => s === 'campfire', plan);
  expect(r.stats.wrongTwice).toBeGreaterThan(3);
  await expect(page.locator('[data-action="recap"]')).toBeVisible();
  const recapLabel = await page.locator('[data-action="recap"]').innerText();
  const n = Number(/\((\d+) to fix\)/.exec(recapLabel)![1]);
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(8);
  await page.screenshot({ path: 'e2e/screenshots/wrong-campfire.png' });

  // recap: miss one of them twice as well — the child still moves on
  const r2 = await playUntil(page, (s) => s === 'rescue', (i) => (i === 0 ? 2 : 0));
  expect(r2.stats.recap).toBe(n);
  // every recap question re-tests a skill that was missed (fresh numbers, same kind)
  const missed = new Set([...r.stats.missedKinds, '1.2|' + inf.kind]);
  for (const k of r2.stats.recapKinds) expect(missed.has(k), k).toBe(true);
  await expect(page.locator('[data-screen="rescue"]')).toBeVisible();
  const stars = await page.locator('.star-on').count();
  expect(stars).toBeLessThan(3);
  await page.locator('[data-action="rescue-next"]').tap();
  await page.locator('[data-level="hard"]').tap();
  await page.locator('[data-action="goodnight"]').tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();

  const save = await readSave(page);
  expect(save.nights[1].finished).toBe(true);
  expect(save.nudge).toBe(-1); // "too hard" → slightly easier later nights
  const missedRecords = Object.values(save.topics).flatMap((t: any) => t.missed);
  expect(missedRecords.length).toBeGreaterThan(3);
  expect(missedRecords.some((m: any) => m.fixed)).toBe(true);

  // parent area lists the missed questions with answers
  await page.locator('[data-action="grownups"]').tap();
  await page.locator('[data-action="hold"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(3200);
  await expect(page.locator('[data-screen="parent"]')).toBeVisible();
  await expect(page.locator('.missed details').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/parent-after-wrongs.png', fullPage: true });
  expect(errors).toEqual([]);
});
