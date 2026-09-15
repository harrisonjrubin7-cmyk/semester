/**
 * The installed icons, written from the one drawing.
 *
 * `public/icon.svg` and `public/icon-maskable.svg` are generated from
 * `src/components/mark.data.ts` — the same geometry `components/Brand.tsx`
 * draws in the app — and `src/components/mark.test.ts` checks that what is on
 * disk is what `src/components/mark.svg.ts` produces. Same arrangement as
 * `scripts/counts.mjs` and the numbers in the README: generated, committed,
 * and held to the generator by a test, so the files can be fetched straight
 * off the origin without a build step and still cannot quietly diverge from
 * the source.
 *
 *     npm run icons                   # write the SVGs
 *     node scripts/icons.mjs --check  # fail if they are out of date
 *
 * This file is I/O and nothing else. The SVG text lives in
 * `src/components/mark.svg.ts`, which is what the test imports — see the note
 * there for the bug that arrangement was written for.
 *
 * Node runs the TypeScript directly, the way `scripts/styles.mjs` does: this
 * only needs the exports, and a build step between a generator and the source
 * it generates from is a build step that will be out of date at exactly the
 * wrong moment.
 *
 * ## The PNGs
 *
 * `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and
 * `icon-maskable-512.png` are rasterised from the same text, because iOS
 * ignores an SVG `apple-touch-icon` and some Android launchers still want a
 * bitmap. That needs a browser, and a headless Chromium is not a dependency
 * this app carries for four files that change once a year:
 *
 *     node scripts/icons.mjs --png public   # needs `playwright` resolvable
 *
 * `.claude/skills/run` has the container's browser setup. Without a
 * resolvable `playwright` this says so and writes nothing, which is the honest
 * outcome rather than a silent skip.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const pub = join(here, '..', 'public');

const { APPLE, FILES } = await import(join(src, 'components', 'mark.svg.ts'));

if (process.argv.includes('--png')) {
  const out = process.argv[process.argv.indexOf('--png') + 1] ?? pub;
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'icons: --png needs `playwright` resolvable from here. See the note at the ' +
        'top of this file, and `.claude/skills/run` for the container’s browser.',
    );
    process.exit(1);
  }
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });
  // Rasterised from the SVG *text*, not from a file URL, so a stale file on
  // disk cannot be what ends up in the PNG.
  const shots = [
    ['icon-192.png', FILES['icon.svg'], 192],
    ['icon-512.png', FILES['icon.svg'], 512],
    ['icon-maskable-512.png', FILES['icon-maskable.svg'], 512],
    ['apple-touch-icon.png', APPLE, 180],
  ];
  for (const [name, svg, size] of shots) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: join(out, name), omitBackground: true });
    await page.close();
    console.log(`icons: wrote ${name} at ${size}px`);
  }
  await browser.close();
  process.exit(0);
}

const check = process.argv.includes('--check');
let stale = 0;
for (const [name, text] of Object.entries(FILES)) {
  const path = join(pub, name);
  if (readFileSync(path, 'utf8') === text) continue;
  stale += 1;
  if (check) console.error(`icons: public/${name} is not what the drawing produces`);
  else {
    writeFileSync(path, text);
    console.log(`icons: wrote public/${name}`);
  }
}

if (check && stale) {
  console.error('Run `npm run icons` and commit the result.');
  process.exit(1);
}
if (!stale) console.log(`icons: ${Object.keys(FILES).length} files already match the drawing`);
