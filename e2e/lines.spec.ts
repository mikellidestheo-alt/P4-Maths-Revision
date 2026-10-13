import { test, expect } from '@playwright/test';
import { enterAnswer, info, setTouch, setupFirstRun } from './bot';

// Every symmetry shape: every fold line is fully inside the picture and can be tapped.
test('fold lines are fully visible and tappable for every shape', async ({ page }) => {
  setTouch(true);
  await page.goto('./?bot=1');
  await setupFirstRun(page);
  for (let seed = 1; seed <= 40; seed++) {
    await page.evaluate((sd) => (window as any).__campPreview('2.6', 'tapLines', 3, sd), seed);
    await page.waitForFunction(() => (window as any).__camp && !(window as any).__camp.resolved);
    const outside = await page.evaluate(() => {
      const svg = document.querySelector('.lines-wrap svg') as SVGSVGElement;
      const vb = svg.viewBox.baseVal;
      return [...svg.querySelectorAll('line.pick-vis')].filter((l) => {
        const L = l as SVGLineElement;
        const xs = [L.x1.baseVal.value, L.x2.baseVal.value], ys = [L.y1.baseVal.value, L.y2.baseVal.value];
        return xs.some((x) => x < vb.x - 0.5 || x > vb.x + vb.width + 0.5) || ys.some((y) => y < vb.y - 0.5 || y > vb.y + vb.height + 0.5);
      }).length;
    });
    expect(outside, `seed ${seed}`).toBe(0);
    const inf = await info(page);
    await enterAnswer(page, inf, inf.expected);
    await page.locator('[data-action="check"]').click();
    await expect(page.locator('.banner'), `seed ${seed} ${inf.qid}`).toHaveClass(/banner-good/);
  }
});
