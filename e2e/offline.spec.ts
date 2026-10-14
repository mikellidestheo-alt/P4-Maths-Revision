import { test, expect } from '@playwright/test';
import { pressPlay } from './bot';
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function build(id: string, out: string) {
  execSync(`npx vite build --outDir ${out} --emptyOutDir`, { env: { ...process.env, BUILD_ID: id }, stdio: 'pipe' });
}

test('works offline after the first visit, and picks up a new deploy cleanly', async ({ browser }) => {
  test.setTimeout(180_000);
  const tmp = mkdtempSync(join(tmpdir(), 'camp-sw-'));
  const a = join(tmp, 'a'), b = join(tmp, 'b'), live = join(tmp, 'live');
  build('deployA', a);
  build('deployB', b);
  cpSync(a, live, { recursive: true });
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    let p = decodeURIComponent(url.pathname).replace(/^\/P4-Maths-Revision\//, '/');
    if (p.endsWith('/')) p += 'index.html';
    const f = join(live, p);
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(readFileSync(f));
  });
  await new Promise<void>((r) => server.listen(4180, r));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const url = 'http://localhost:4180/P4-Maths-Revision/';
  try {
    await page.goto(url);
    await pressPlay(page);
    await expect(page.locator('[data-screen="world"]')).toBeVisible();
    await page.waitForFunction(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect(await page.getAttribute('html', 'data-build')).toBe('deployA');

    // offline: the whole game still loads and plays
    await ctx.setOffline(true);
    await page.reload();
    await pressPlay(page);
    await expect(page.locator('[data-screen="world"]')).toBeVisible();
    await expect(page.locator('.world-canvas canvas')).toBeVisible();
    await page.click('[data-action="autowalk"]');
    await page.locator('[data-action="interact"]').click({ timeout: 90_000 });
    await expect(page.locator('.q-prompt')).toBeVisible();
    await expect(page.locator('.widget-holder .widget')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/offline-question.png' });
    await ctx.setOffline(false);

    // redeploy: the next visit shows the new build straight away (network-first page)
    rmSync(live, { recursive: true, force: true });
    cpSync(b, live, { recursive: true });
    await page.goto(url);
    expect(await page.getAttribute('html', 'data-build')).toBe('deployB');
    await expect(page.locator('[data-screen="start"]')).toBeVisible();
    // the new service worker takes over and old caches are cleared
    await page.waitForFunction(async () => (await caches.keys()).includes('camp-deployB') && !(await caches.keys()).includes('camp-deployA'), null, { timeout: 30_000 });
    // and offline now serves the new version, never the stale one
    await ctx.setOffline(true);
    await page.reload();
    expect(await page.getAttribute('html', 'data-build')).toBe('deployB');
    await pressPlay(page);
    await expect(page.locator('[data-screen="world"]')).toBeVisible();
  } finally {
    await ctx.close();
    server.close();
    rmSync(tmp, { recursive: true, force: true });
  }
});
