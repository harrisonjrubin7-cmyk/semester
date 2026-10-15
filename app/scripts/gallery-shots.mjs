/*
 * The design system's visual regression, without a baseline in the repository.
 *
 *     cd app && npm run gallery:shots              # compare with .gallery/baseline
 *     npm run gallery:shots -- --update            # write the baseline from this run
 *
 * `src/gallery/stories.tsx` is drawn under three grounds by `pages.tsx`
 * (through Vite's SSR loader, so it is the real components and the real
 * `tokensFor`), screenshotted at a phone and a desktop width, and compared with
 * the baseline in `.gallery/baseline`. The baseline is the runner's own: fonts
 * and anti-aliasing differ between machines, so a PNG committed from one laptop
 * is a failing test on the next. Generate it on the machine that compares
 * (`--update` on main, then run on the branch), which is the spec's section 7.5.
 *
 * Not in `ci.yml`: it needs a browser and a baseline, and wiring a job that
 * produces one is a decision about CI the owner has not made.
 *
 * ## The controls
 *
 * A comparison that has never seen a difference is not known to see one, and
 * one that sees a difference every time is not a comparison. Before comparing
 * it takes the first page twice (the two must be identical: the render is
 * deterministic) and once with one token changed (it must differ: the
 * comparison can see a change in a colour). It refuses to continue if either
 * is wrong.
 *
 * Comparison is byte equality of the PNG. Chromium is deterministic on one
 * machine, which is the only claim made; across machines, regenerate.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const out = join(app, '.gallery');
const update = process.argv.includes('--update');
const WIDTHS = (process.env.GALLERY_WIDTHS || '420,1280').split(',').map(Number);
const CHROME = process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';

const from = process.env.SWEEP_PLAYWRIGHT;
const { chromium } = from ? createRequire(import.meta.url)(from) : await import('playwright');

const css = ['tokens', 'industry', 'app', 'unity'].map((f) => readFileSync(join(app, 'src/styles', `${f}.css`), 'utf8')).join('\n');

const vite = await createServer({ root: app, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { galleryPages } = await vite.ssrLoadModule('/src/gallery/pages.tsx');
const pages = galleryPages(css);
await vite.close();

const browser = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);

async function shoot(html, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  const png = await page.screenshot({ fullPage: true });
  await ctx.close();
  return png;
}

// Controls, before anything is compared.
const first = pages[0];
const a = await shoot(first.html, WIDTHS[0]);
const b = await shoot(first.html, WIDTHS[0]);
const changed = await shoot(first.html.replace('<style>body{', '<style>body{--probe:1;border-top:14px solid #f0f;'), WIDTHS[0]);
const same = sha(a) === sha(b);
const sees = sha(a) !== sha(changed);
console.log(`CONTROL  the same page twice is identical:   ${same}`);
console.log(`CONTROL  a changed page is seen as changed:  ${sees}`);
if (!same) throw new Error('the render is not deterministic, so a comparison would be noise');
if (!sees) throw new Error('the comparison cannot see a change');

const current = join(out, 'current');
const baseline = join(out, 'baseline');
rmSync(current, { recursive: true, force: true });
mkdirSync(current, { recursive: true });
const shots = [];
for (const p of pages) {
  for (const width of WIDTHS) {
    const file = `${p.name}-${width}.png`;
    const png = await shoot(p.html, width);
    writeFileSync(join(current, file), png);
    shots.push({ file, hash: sha(png) });
  }
}
await browser.close();
console.log(`\nSHOT ${shots.length} (${pages.length} grounds × ${WIDTHS.length} widths) → ${current}`);

if (update) {
  rmSync(baseline, { recursive: true, force: true });
  mkdirSync(baseline, { recursive: true });
  for (const f of readdirSync(current)) copyFileSync(join(current, f), join(baseline, f));
  console.log(`BASELINE written: ${shots.length} files in ${baseline}`);
  process.exit(0);
}

if (!existsSync(baseline)) {
  console.log('\nNo baseline here. Run with --update on the branch you trust, then run again.');
  process.exit(2);
}
const diff = [];
const gone = [];
for (const s of shots) {
  const was = join(baseline, s.file);
  if (!existsSync(was)) gone.push(s.file);
  else if (sha(readFileSync(was)) !== s.hash) diff.push(s.file);
}
const stale = readdirSync(baseline).filter((f) => !shots.some((s) => s.file === f));
console.log(`\nCHANGED: ${diff.length}   NEW: ${gone.length}   REMOVED: ${stale.length}`);
for (const f of diff) console.log(`  changed  ${f}`);
for (const f of gone) console.log(`  new      ${f}`);
for (const f of stale) console.log(`  removed  ${f}`);
console.log('\nCovers the stories in src/gallery/stories.tsx at the listed widths, as static markup. Not interaction, not a real screen.');
process.exit(diff.length || gone.length || stale.length ? 1 : 0);
