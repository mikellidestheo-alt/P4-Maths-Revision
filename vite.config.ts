import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = '/P4-Maths-Revision/';
const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

/** Writes dist/sw.js with a precache list of every built file and a unique cache name. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'camp-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const template = readFileSync('src/sw-template.js', 'utf8');
      const sw = template
        .replace('__BUILD_ID__', BUILD_ID)
        .replace('__PRECACHE__', JSON.stringify(['./', ...precache.filter((f) => f !== 'index.html'), 'index.html']));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: BASE,
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    target: 'es2019',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  plugins: [serviceWorker()],
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000,
  },
} as never);
