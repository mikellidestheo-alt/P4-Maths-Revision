import { test, expect, type Page, type Locator } from '@playwright/test';
import { enterAnswer, info, setTouch, openGame } from './bot';

async function preview(page: Page, topic: string, kind: string, tier: 1 | 2 | 3, seed = 5) {
  await page.evaluate(([t, k, tr, sd]) => (window as any).__campPreview(t, k, tr, sd), [topic, kind, tier, seed] as const);
  await page.waitForFunction(() => (window as any).__camp && !(window as any).__camp.resolved);
}

async function checkGood(page: Page) {
  await page.locator('[data-action="check"]').click();
  await expect(page.locator('.banner')).toHaveClass(/banner-good/);
}

/** A real touch drag (Chrome DevTools touch events), not a mouse drag. */
async function touchDrag(page: Page, from: Locator, to: { x: number; y: number }) {
  const a = (await from.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + ((to.x - sx) * i) / 10, y: sy + ((to.y - sy) * i) / 10 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const centre = async (l: Locator) => { const b = (await l.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

test.beforeEach(async ({ page }, ti) => {
  setTouch(ti.project.name !== 'laptop-game');
  await page.goto('./?bot=1');
  await openGame(page);
});

test('every drag/draw/tap question has a working typed fallback', async ({ page }) => {
  const cases: [string, string, 1 | 2 | 3][] = [
    ['1.1', 'build', 3], ['1.3', 'roundLine', 2], ['1.4', 'slide', 3], ['1.6', 'setClock', 2], ['1.7', 'drawLine', 3],
    ['1.7', 'complete', 3], ['1.8', 'vertex', 3], ['2.3', 'column', 3], ['2.4', 'column', 2], ['2.5', 'build', 2], ['2.6', 'tapLines', 2], ['2.7', 'reflectShape', 2],
  ];
  for (const [t, k, tier] of cases) {
    await preview(page, t, k, tier);
    await expect(page.locator('[data-action="fallback"]'), `${t} ${k} has a fallback`).toBeVisible();
    await page.locator('[data-action="fallback"]').click();
    const inf = await info(page);
    expect(inf.type).toBe('fields');
    await enterAnswer(page, inf, inf.expected);
    await checkGood(page);
  }
});

test('touch: drag digit tiles, number-line lantern, order cards, triangle corners and clock hands', async ({ page }, ti) => {
  test.skip(ti.project.name === 'laptop-game', 'touch only');
  // place value: drag a tile into a column with a finger
  await preview(page, '1.1', 'build', 1);
  await touchDrag(page, page.locator('[data-tile="7"]'), await centre(page.locator('[data-place="0"]')));
  await expect(page.locator('[data-place="0"]')).toHaveText('7');
  // number line: finger-drag the lantern to a mark
  await preview(page, '1.3', 'roundLine', 1);
  let inf = await info(page);
  await touchDrag(page, page.locator('[data-nl-handle]'), await centre(page.locator(`[data-nl-tick="${inf.expected}"] line`)));
  await checkGood(page);
  // ordering: drag the bottom card to the top
  await preview(page, '1.3', 'order', 2);
  const ids = await page.locator('[data-order-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.orderId!));
  const first = await centre(page.locator('[data-order-id]').first());
  await touchDrag(page, page.locator(`[data-order-id="${ids.at(-1)}"]`), { x: first.x, y: first.y - 20 });
  const after = await page.locator('[data-order-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.orderId!));
  expect(after[0]).toBe(ids.at(-1));
  // triangle: drag corner C to make the required tent
  await preview(page, '2.5', 'build', 2);
  inf = await info(page);
  const tgt = inf.expected[2];
  await touchDrag(page, page.locator('[data-corner="2"]'), await centre(page.locator(`[data-gx="${tgt[0]}"][data-gy="${tgt[1]}"]`)));
  await checkGood(page);
  // clock: drag the minute hand round to the 3 (quarter past)
  await preview(page, '1.6', 'setClock', 1);
  const face = (await page.locator('.clock-interactive').boundingBox())!;
  const cx = face.x + face.width / 2, cy = face.y + face.height / 2, r = face.width * 0.33;
  const before = await page.locator('.clock-interactive').getAttribute('aria-valuetext');
  await touchDrag(page, page.locator('[data-hand="minute"] .hand-knob'), { x: cx + r, y: cy });
  const now = await page.locator('.clock-interactive').getAttribute('aria-valuetext');
  expect(now).toMatch(/:15$/);
  expect(now).not.toBe(before);
});

test('grid: plot with the arrow buttons instead of tapping', async ({ page }) => {
  await preview(page, '1.8', 'plot', 2);
  const inf = await info(page);
  const [x, y] = inf.expected[0];
  await page.locator('[data-action="grid-arrows"]').click();
  for (let i = 0; i < x; i++) await page.locator('[data-cursor="right"]').click();
  for (let i = 0; i < y; i++) await page.locator('[data-cursor="up"]').click();
  await page.locator('[data-cursor="place"]').click();
  await checkGood(page);
});

test('grid: draw a fence by dragging from the start point', async ({ page }) => {
  await preview(page, '1.7', 'drawLine', 2);
  const inf = await info(page);
  const q = inf.expected[0];
  const from = page.locator(`[data-gx="${inf.interaction.fixed[0]}"][data-gy="${inf.interaction.fixed[1]}"]`);
  const a = await centre(from), b = await centre(page.locator(`[data-gx="${q[0]}"][data-gy="${q[1]}"]`));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await checkGood(page);
});

test('physical keyboard works for typed answers (laptop)', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'laptop-game', 'laptop only');
  await preview(page, '2.1', 'add', 2);
  const inf = await info(page);
  await page.keyboard.type(String(inf.expected.a));
  await page.keyboard.press('Enter');
  await expect(page.locator('.banner')).toHaveClass(/banner-good/);
  await page.keyboard.press('Enter'); // Next
  await expect(page.locator('[data-screen="world"]')).toBeVisible();
  // time with a colon, typed on the keyboard, then am/pm by clicking
  await preview(page, '1.6', 'swap', 2, 11);
  const t = await info(page);
  await page.keyboard.type(String(t.expected.a));
  if (t.expected.ap) await page.locator(`[data-toggle-id="ap"][data-value="${t.expected.ap}"]`).click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.banner')).toHaveClass(/banner-good/);
});

test('the number pad accepts "1,000"-style answers and leading zeros', async ({ page }) => {
  await preview(page, '1.4', 'typed', 2);
  const inf = await info(page);
  await enterAnswer(page, inf, { a: '00' + inf.expected.a });
  await checkGood(page);
});
