import { test, expect } from '@playwright/test';
import { enterAnswer, info, playUntil, readSave, setTouch, openGame, walkAndInteract, open, reopen } from './bot';

test('wrong-answer flow: hint after 1st miss, worked solution after 2nd, then the Campfire recap', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  setTouch(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, './?bot=1');
  await openGame(page);
  // walk to the first marker in the 3D forest and start the job
  await walkAndInteract(page);

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
  const r = await playUntil(page, async (s) => s === 'world' && (await page.locator('[data-objective="recap"]').count()) > 0, plan);
  expect(r.stats.wrongTwice).toBeGreaterThan(3);
  // the campfire marker comes before the friend appears
  await expect(page.locator('[data-quest]')).toContainText('Light the campfire');
  await page.locator('[data-action="autowalk"]').tap();
  await expect(page.locator('[data-action="interact"]')).toBeVisible({ timeout: 90_000 });
  const recapLabel = await page.locator('[data-action="interact"]').innerText();
  const n = Number(/\((\d+) to fix\)/.exec(recapLabel)![1]);
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(8);
  await page.screenshot({ path: 'e2e/screenshots/wrong-campfire.png' });
  await page.locator('[data-action="interact"]').tap();

  // recap: miss one of them twice as well — the child still moves on
  const r2 = await playUntil(page, (s) => s === 'rescue', (i) => (i === 0 ? 2 : 0));
  expect(r2.seenScreens).toContain('world'); // after the campfire: back to the forest, then walk to the friend
  expect(r2.stats.recap).toBe(n);
  // every recap question re-tests a skill that was missed (fresh numbers, same kind)
  const missed = new Set([...r.stats.missedKinds, '1.1|' + inf.kind]);
  for (const k of r2.stats.recapKinds) expect(missed.has(k), k).toBe(true);
  await expect(page.locator('[data-screen="rescue"]')).toBeVisible();
  const stars = await page.locator('.star-on').count();
  expect(stars).toBeLessThan(3);
  await page.screenshot({ path: 'e2e/screenshots/wrong-rescue.png' });
  await page.locator('[data-action="rescue-next"]').tap();
  await page.screenshot({ path: 'e2e/screenshots/wrong-checkin.png' });
  await page.locator('[data-level="hard"]').tap();
  await page.locator('[data-action="goodnight"]').tap();
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  await expect(page.locator('[data-quest]')).toContainText('Night 2 of 6');

  const save = await readSave(page);
  expect(save.nights[1].finished).toBe(true);
  expect(save.nudge).toBe(-1); // "too hard" → slightly easier later nights
  const missedRecords = Object.values(save.topics).flatMap((t: any) => t.missed);
  expect(missedRecords.length).toBeGreaterThan(3);
  expect(missedRecords.some((m: any) => m.fixed)).toBe(true);

  expect(errors).toEqual([]);
});
