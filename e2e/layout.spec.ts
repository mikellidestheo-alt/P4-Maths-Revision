import { test, expect, type Page } from '@playwright/test';

const PREVIEWS: [string, string, 1 | 2 | 3, string][] = [
  ['1.1', 'build', 3, 'placevalue'],
  ['1.1', 'partition', 3, 'fields-partition'],
  ['1.2', 'markers', 3, 'fields-markers'],
  ['1.3', 'roundLine', 2, 'numberline'],
  ['1.3', 'order', 3, 'order'],
  ['1.3', 'compare', 2, 'choice'],
  ['1.4', 'slide', 3, 'slide'],
  ['1.5', 'rule', 2, 'fields-toggle'],
  ['1.6', 'setClock', 2, 'clock'],
  ['1.6', 'endTime', 1, 'time-ampm'],
  ['1.7', 'drawLine', 3, 'grid-segment'],
  ['1.7', 'tapPairs', 2, 'lineselect-planks'],
  ['1.8', 'read', 3, 'grid-read'],
  ['1.8', 'describe', 3, 'fields-describe'],
  ['2.3', 'column', 3, 'column-add'],
  ['2.4', 'column', 3, 'column-sub'],
  ['2.5', 'build', 2, 'triangle'],
  ['2.5', 'sort', 1, 'bins'],
  ['2.6', 'tapLines', 2, 'lineselect-folds'],
  ['2.6', 'complete', 3, 'cells'],
  ['2.7', 'reflectShape', 3, 'reflect'],
];

async function noHorizontalScroll(page: Page, what: string) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, w: window.innerWidth }));
  expect(Math.max(r.sw, r.bw), `${what}: horizontal scroll`).toBeLessThanOrEqual(r.w + 1);
}

async function controlsInside(page: Page, what: string) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const w = window.innerWidth;
    document.querySelectorAll('button, [role="button"], .field').forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const st = getComputedStyle(el as HTMLElement);
      if (st.visibility === 'hidden' || (el as HTMLElement).closest('.table-scroll, .column-wrap, .drag-ghost, .peek')) return;
      if (r.left < -1 || r.right > w + 1) out.push(`${(el as HTMLElement).outerHTML.slice(0, 80)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    });
    return out;
  });
  expect(bad, `${what}: controls clipped sideways`).toEqual([]);
}

async function tapTargets(page: Page, what: string) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('.key, .btn, .icon-btn, .toggle-btn, .choice, .order-arrow, .clock-btn, .col-box, .field:not(.col-help)').forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0) return;
      if (r.height < 40 || r.width < 40) out.push(`${(el as HTMLElement).className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return out;
  });
  expect(small, `${what}: tap targets under 40px`).toEqual([]);
}

async function check(page: Page, name: string, project: string) {
  await page.waitForTimeout(150);
  await noHorizontalScroll(page, name);
  await controlsInside(page, name);
  await tapTargets(page, name);
  await page.screenshot({ path: `e2e/screenshots/${project}--${name}.png` });
}

test('screens and every interaction fit this viewport', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const P = testInfo.project.name;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?bot=1');
  await page.waitForSelector('[data-screen="home"]');
  await check(page, 'home', P);
  await page.click('[data-action="start"]');
  await page.waitForSelector('[data-screen="night"]');
  await check(page, 'night', P);

  for (const [topic, kind, tier, label] of PREVIEWS) {
    await page.evaluate(([t, k, tr]) => (window as any).__campPreview(t, k, tr, 3), [topic, kind, tier] as const);
    await page.waitForSelector('[data-screen="runner"]');
    const name = `q-${topic}-${label}`;
    await check(page, name, P);
    // the question prompt and the Check button are both on screen without scrolling
    const vh = await page.evaluate(() => window.innerHeight);
    const prompt = await page.locator('.q-prompt').boundingBox();
    const btn = await page.locator('[data-action="check"]').boundingBox();
    expect(prompt!.y, `${name}: prompt visible`).toBeGreaterThanOrEqual(0);
    expect(prompt!.y + prompt!.height, `${name}: prompt visible`).toBeLessThanOrEqual(vh + 1);
    expect(btn!.y + btn!.height, `${name}: check button visible`).toBeLessThanOrEqual(vh + 1);
    // the first answer box is on screen without scrolling (keyboard/pad never hides it)
    const firstField = page.locator('.widget-holder .field').first();
    if (await firstField.count()) {
      const fb = (await firstField.boundingBox())!;
      const footer = (await page.locator('.q-footer').boundingBox())!;
      const limit = footer.x > fb.x + fb.width ? vh : footer.y; // side-by-side layout vs stacked
      expect(fb.y + fb.height, `${name}: answer box visible above the pad`).toBeLessThanOrEqual(limit + 1);
    }
    // the number pad never sits on top of the question area
    const pad = page.locator('.pad-wrap');
    if (await pad.isVisible()) {
      const pb = (await pad.boundingBox())!;
      const body = (await page.locator('.q-body').boundingBox())!;
      const overlapX = Math.min(pb.x + pb.width, body.x + body.width) - Math.max(pb.x, body.x);
      const overlapY = Math.min(pb.y + pb.height, body.y + body.height) - Math.max(pb.y, body.y);
      expect(overlapX > 1 && overlapY > 1, `${name}: numpad overlaps question`).toBe(false);
    }
    // the main picture/widget is at least partly visible inside the question area
    const wb = await page.locator('.widget-holder').boundingBox();
    expect(wb!.height, `${name}: widget rendered`).toBeGreaterThan(30);
  }

  await page.evaluate(() => (window as any).__campApp && document.querySelector<HTMLButtonElement>('[data-action="exit"]')?.click());
  await page.waitForSelector('[data-screen="home"]');
  await page.click('[data-action="shop"]');
  await page.waitForSelector('[data-screen="shop"]');
  await check(page, 'shop', P);
  await page.click('[data-action="back"]');
  await page.click('[data-action="friends"]');
  await page.waitForSelector('[data-screen="friends"]');
  await check(page, 'friends', P);
  await page.click('[data-action="back"]');
  expect(errors).toEqual([]);
});
