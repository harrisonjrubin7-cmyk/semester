import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, eq } from './harness';
import { PARCHMENT, INK, WORKSPACE_ACTION, contrast } from '../../../packages/components/brand/palette';
import { BARS, bounds, GRID } from '../../../packages/components/brand/Mark';

// Brand guard (Semester Brand Kit, Graphite and Brass). Contrast uses the WCAG 2 formula the kit uses.
const at = (n: number) => Math.round(n * 100) / 100;
const surfacesL = [PARCHMENT.bg, PARCHMENT.soft, PARCHMENT.surface, PARCHMENT.s2];
const surfacesD = [INK.bg, INK.soft, INK.surface, INK.s2];

test('control: the formula gives 21:1 for black on white', () => { eq(at(contrast('#000000', '#ffffff')), 21); });
test('Parchment: ink, dim, accent and warning text hold 4.5:1 on every surface', () => {
  for (const s of surfacesL) for (const ink of [PARCHMENT.ink, PARCHMENT.dim, PARCHMENT.accent, PARCHMENT.warn, PARCHMENT.ok]) eq([ink, s, contrast(ink, s) >= 4.5], [ink, s, true]);
});
test('Ink: ink, dim, accent and warning text hold 4.5:1 on every surface', () => {
  for (const s of surfacesD) for (const ink of [INK.ink, INK.dim, INK.accent, INK.warn, INK.ok]) eq([ink, s, contrast(ink, s) >= 4.5], [ink, s, true]);
});
test('text on the accent fill holds 4.5:1 on both grounds', () => { eq(contrast(PARCHMENT.on, PARCHMENT.accent) >= 4.5, true); eq(contrast(INK.on, INK.accent) >= 4.5, true); });
test('Brass base is not used as text on Parchment (kit misuse rule 4: 1.59:1 on the panel)', () => { eq(contrast('#d8c79a', PARCHMENT.surface) < 3, true); });
test('workspace action: dark ink passes, white does not (so white is never used)', () => {
  eq(contrast(WORKSPACE_ACTION.ink, WORKSPACE_ACTION.fill) >= 4.5, true); eq(contrast('#ffffff', WORKSPACE_ACTION.fill) < 4.5, true);
});
test('mark: three slabs, centred in the 512 grid on both axes', () => {
  const b = bounds(); eq(BARS.length, 3); eq(b.left + b.right, GRID); eq(b.top + b.bottom, GRID);
});

// Structural: every Zite app loads the brand layer after its own index.css and makes no third-party font request.
// The suite is bundled into a temp dir, so locate the workspace from the working directory (run.sh runs from the root).
const root = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '../..')].find((d) => existsSync(join(d, 'apps/semester'))) ?? process.cwd();
const apps = readdirSync(join(root, 'apps')).filter((a) => existsSync(join(root, 'apps', a, 'src/main.tsx')));
test('every app imports semester-brand.css after index.css', () => {
  for (const a of apps) {
    const m = readFileSync(join(root, 'apps', a, 'src/main.tsx'), 'utf8');
    const i = m.indexOf("import './index.css'"), j = m.indexOf("brand/semester-brand.css'");
    eq([a, i >= 0 && j > i], [a, true]);
  }
});
test('no app requests Google Fonts', () => {
  for (const a of apps) eq([a, readFileSync(join(root, 'apps', a, 'src/index.css'), 'utf8').includes('fonts.googleapis')], [a, false]);
});
