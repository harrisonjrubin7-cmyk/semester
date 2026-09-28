/**
 * The design-system adoption figures, measured.
 *
 *     npm run census:design
 *
 * `docs/design/GOVERNANCE.md` lists what the system tracks release to release.
 * The ones that can be read off the source are read here, so the figure in the
 * document is a command's output rather than somebody's estimate. It never
 * fails: the rules that fail are the style, label and vocabulary lints. This
 * is the trend line beside them.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const { sources, withoutComments } = await import(join(src, 'styles', 'rules.ts'));
const { countsByFile, total } = await import(join(src, 'content', 'terms.ts'));
const { BUDGET } = await import(join(src, 'styles', 'budget.ts'));

const files = sources(src, { tests: false }).map((f) => ({
  rel: f.path.slice(f.path.lastIndexOf('/src/') + 5),
  code: withoutComments(f.text),
}));
const count = (re) => files.reduce((n, f) => n + (f.code.match(re)?.length ?? 0), 0);
const using = (re) => files.filter((f) => re.test(f.code)).length;

// Screens: the top-level files in screens/ and screens/settings/, tests aside.
const screenFiles = ['screens', 'screens/settings'].flatMap((d) =>
  readdirSync(join(src, d))
    .filter((n) => n.endsWith('.tsx') && !n.includes('.test.'))
    .map((n) => `${d}/${n}`),
);
const screens = files.filter((f) => screenFiles.includes(f.rel));
// Settings screens have their own frame, `SettingsPage`, which is the settings
// family's `<Page>` (docs/design/INTERACTION-STANDARDS.md §1); the index and the
// frame itself are counted as framed.
const FRAME = /<(?:Page|SettingsPage|SettingsIndex)[\s>]|export function SettingsPage\b/;
const onPage = screens.filter((f) => FRAME.test(f.code));
const offPage = screens.filter((f) => !FRAME.test(f.code)).map((f) => f.rel);

const rawButtons = count(/<button\b/g);
const actionButtons = count(/<ActionButton\b/g);
const styleOwed = Object.values(BUDGET).reduce(
  (n, row) => n + Object.values(row).reduce((a, b) => a + b, 0),
  0,
);

const rows = [
  ['Screens framed by <Page> or <SettingsPage>', `${onPage.length} of ${screens.length}`],
  ['<ActionButton> (primary CTA) uses', actionButtons],
  ['Raw <button> elements', rawButtons],
  ['Files using <EmptyState>', using(/<EmptyState\b/)],
  ['Files using <SourceBadge>', using(/<SourceBadge\b/)],
  ['Files using <NotOfficial>', using(/<NotOfficial\b/)],
  ['Files using <TypeToConfirm>', using(/<TypeToConfirm\b/)],
  ['Hex colour literals in .tsx', count(/['"`]#[0-9a-fA-F]{3,8}\b/g)],
  ['Off-scale style values (styles/budget.ts)', styleOwed],
  ['Retired words on screen (content/ledger.ts)', total(countsByFile(src))],
];

const width = Math.max(...rows.map(([k]) => k.length));
for (const [k, v] of rows) console.log(`${k.padEnd(width)}  ${v}`);
if (offPage.length) console.log(`\nScreens with neither frame: ${offPage.join(', ')}`);
