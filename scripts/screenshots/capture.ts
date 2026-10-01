// Génère les captures du Chrome Web Store : 5 vues × 3 langues, 1280×800, PNG RGB 24 bits sans alpha.
// Usage : npm run screenshots [-- --locale fr --shot 2]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import { pngInfo, toRgbPng } from './png.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs/store/screenshots');
const LOCALES = ['fr', 'en', 'de'] as const;
const SHOTS = [1, 2, 3, 4, 5] as const;
const FILES: Record<(typeof SHOTS)[number], string> = {
  1: '01-sync-at-credits',
  2: '02-watching',
  3: '03-review',
  4: '04-rating',
  5: '05-settings',
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const onlyLocale = arg('locale');
const onlyShot = arg('shot');

const server = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  plugins: [tailwindcss()],
  define: { __SYNCKAI_BUILD__: JSON.stringify('screenshots') },
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
});
await server.listen();
const base = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5199/';

const browser = await puppeteer.launch({ headless: 'shell', args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
let failures = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (error) => console.error('  [page]', error));
  page.on('console', (msg) => msg.type() === 'error' && console.error('  [console]', msg.text()));

  for (const locale of LOCALES) {
    if (onlyLocale && onlyLocale !== locale) continue;
    await mkdir(path.join(OUT, locale), { recursive: true });
    for (const shot of SHOTS) {
      if (onlyShot && onlyShot !== String(shot)) continue;
      const file = path.join(OUT, locale, `${FILES[shot]}.png`);
      try {
        await page.goto(`${base}scripts/screenshots/banner.html?shot=${shot}&locale=${locale}`, { waitUntil: 'load' });
        await page.waitForFunction(() => document.documentElement.dataset.ready === '1', { timeout: 30_000 });
        const shotPng = Buffer.from(await page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: 1280, height: 800 } }));
        const png = toRgbPng(shotPng);
        const info = pngInfo(png);
        if (info.width !== 1280 || info.height !== 800 || info.colorType !== 2 || info.bitDepth !== 8) throw new Error(`PNG invalide : ${JSON.stringify(info)}`);
        await writeFile(file, png);
        console.log(`✓ ${path.relative(ROOT, file)} (${Math.round(png.length / 1024)} Ko)`);
      } catch (error: unknown) {
        failures++;
        console.error(`✗ ${path.relative(ROOT, file)} :`, error);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures > 0 ? 1 : 0);
