import { test, expect, type Page } from '@playwright/test';
import { playUntil, readSave, setTouch, openGame } from './bot';

async function playNight(page: Page, n: number) {
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.locator('[data-tonight]')).toHaveAttribute('data-tonight', String(n));
  await page.locator('[data-action="start"]').tap();
  console.log(`[bot] night ${n} started ${new Date().toISOString().slice(11, 19)}`);
  return playUntil(page, (s) => s === 'home' || s === 'dawn');
}

test('bot plays all six nights in one sitting through the real UI and reaches the Dawn (no night limit)', async ({ page }) => {
  test.setTimeout(40 * 60_000);
  setTouch(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?bot=1');
  await openGame(page);

  const types = new Set<string>();
  let questions = 0;
  for (let n = 1; n <= 6; n++) {
    const r = await playNight(page, n);
    r.stats.types.forEach((t) => types.add(t));
    questions += r.stats.questions;
    // never a "come back tomorrow" screen: straight back to camp, ready for the next night
    expect(r.seenScreens).not.toContain('rest');
    if (n < 6) expect(r.seenScreens.at(-1)).toBe('home');
  }
  await expect(page.locator('[data-screen="dawn"]')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/bot-dawn.png' });
  await page.locator('[data-action="dawn-home"]').tap();
  await expect(page.locator('[data-action="dawn"]')).toBeVisible();

  const save = await readSave(page);
  for (let n = 1; n <= 6; n++) expect(save.nights[n].finished).toBe(true);
  for (let n = 1; n <= 6; n++) expect(save.nights[n].bestStars).toBe(3);
  for (const t of ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7']) {
    expect(save.topics[t].attempts, t).toBeGreaterThanOrEqual(10);
    expect(save.topics[t].firstTry, t).toBe(save.topics[t].attempts);
  }
  expect(questions).toBe(180);
  // question types are random, so only the ones that are (almost) certain to appear are required here;
  // every interaction type is exercised deterministically in layout.spec.ts and widgets.spec.ts
  for (const t of ['fields', 'grid', 'column']) expect([...types], t).toContain(t);
  expect(types.size).toBeGreaterThanOrEqual(8);
  console.log('interaction types used:', [...types].join(', '));
  expect(errors).toEqual([]);
});
