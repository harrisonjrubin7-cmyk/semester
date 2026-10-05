/**
 * The design-system drift summary, as Markdown a CI job can post.
 *
 *     npm run design-system:report                  # to stdout
 *     npm run design-system:report -- --out r.md    # to a file
 *     npm run design-system:report -- --strict      # exit 1 on a failing finding
 *
 * `design-system-audit.mjs` is the rule that fails; this is the trend line
 * beside it, the way `census:design` is beside the style lint. It reads the same
 * `audit()`, so the figures here cannot differ from the ones the audit holds,
 * and by default it never fails: a report that goes red for being read is a
 * report nobody runs. `--strict` is for the step that wants both.
 *
 * To append it to a GitHub Actions run summary:
 *
 *     npm run design-system:report -- --out "$GITHUB_STEP_SUMMARY"
 *
 * It does not call Figma. The token-parity and component-parity tables the
 * audit skill asks for need a Figma file; what is here is the code side of that
 * comparison and the mapping rows that say where each Figma variable points.
 */
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLOUR_LEDGER, UNDEFINED_LEDGER, audit, cliOptions } from './design-system-audit.mjs';

const ENFORCEMENT = [
  ['Token export', '`src/lib/tokenexport.test.ts`', 'The committed JSON equals what `look.ts` and `tokens.css` generate; every semantic token is exported; ink clears AA on every ground.', 'Accent × ground pairings and `prefers-contrast: more` are not exported.'],
  ['Semantic layer', '`src/styles/tokens.test.ts`', 'Every pointer in `tokens.css` lands on a defined name; no colour is written into the layer; no clash with `industry.css`.', 'Reads `tokens.css` only, not the references components make.'],
  ['Raw values', '`src/styles/hex.test.ts`, `scripts/styles.mjs`, `design-system-audit.mjs`', 'Hex in `.tsx`, off-scale type, leading and spacing, colour literals in CSS and inline styles, `var()` that names nothing.', 'Named colours; hex in plain `.ts` files.'],
  ['Contrast', '`src/lib/contrast.test.ts`, `sweep:contrast`', 'The whole ground ramp, both faded strengths, the chart series.', 'Measured on the default accent per ground.'],
  ['Responsive', '`src/styles/breakpoints.test.ts`, `taps.test.ts`, `gutter.test.ts`, `sweep:walls`, `sweep:targets`', 'Breakpoints, target size, gutters, horizontal overflow.', 'Needs a browser for the sweeps.'],
  ['Accessibility', '`src/a11y/*.test.*`, `smoke:a11y`', 'Landmarks, labels, focus, modal, motion, axe on rendered screens.', 'The assistive-technology pass has not been run (AT-PASS-PROTOCOL).'],
];

// Backslash first: escaping the pipe alone lets a value ending in `\` swallow the escape that follows it.
const cell = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const count = (o) => Object.values(o).reduce((a, b) => a + b, 0);

export function report(result) {
  const { findings, stats, failing } = result;
  const blockers = failing.filter((f) => f.severity === 'blocker');
  const owedColours = count(stats.colours);
  const owedVars = count(stats.undefinedVars);
  const state = blockers.length ? 'critical drift' : failing.length ? 'weak' : owedColours + owedVars ? 'moderate' : 'strong';
  const worst = blockers[0] ?? failing[0];
  const m = stats.mapping;
  const out = [];

  out.push('# Semester design-system report', '');
  out.push('## Executive assessment', '');
  out.push(`- Alignment: **${state}**. ${failing.length ? `${failing.length} failing finding${failing.length === 1 ? '' : 's'}.` : 'Nothing fails; the figures below are owed debt held on shrink-only ledgers.'}`);
  out.push(`- Highest-risk finding: ${worst ? `${worst.file}:${worst.line} — ${worst.found}` : `${owedVars} \`var()\` uses name a property nothing defines, so the declaration applies nothing (below).`}`);
  out.push(`- Main concern: tokens and Figma parity. The export is generated and held; the Figma file and component mapping do not exist yet.`, '');

  out.push('## Findings', '');
  out.push(findings.length ? table(['Severity', 'Location', 'Check', 'Evidence', 'Smallest fix'], findings.map((f) => [f.severity, `${f.file}:${f.line}`, f.check, f.found, f.says])) : 'None.', '');

  out.push('## Token pipeline', '');
  out.push(table(['Stage', 'Where', 'Count'], [
    ['Primitives decided per ground and setting', '`src/lib/look.ts` (`tokensFor`), `src/styles/app.css` `:root`', `${stats.exported.primitive} exported`],
    ['Semantic names', '`src/styles/tokens.css`', `${stats.exported.semantic} exported`],
    ['Machine-readable export', '`design-tokens/semester.tokens.json`', `${stats.exported.collections} collections`],
    ['Figma mapping rows', '`docs/FIGMA-MAPPING.md`', `${m.rows} rows`],
  ]), '');

  out.push('## Figma mapping', '');
  out.push(`${m.semanticMapped} of ${m.semanticTotal} semantic tokens have a mapping row. Parity: ${Object.entries(m.parity).map(([k, v]) => `${k} ${v}`).join(' · ')}.`);
  out.push(m.unmapped.length ? `\nUnmapped: ${m.unmapped.map((k) => `\`${k}\``).join(', ')}.` : '');
  if (!m.parity.Match && !m.parity.Partial) out.push('No row has been compared with a Figma file: every one is `Planned`.');
  out.push('');

  out.push('## Raw colour literals', '');
  out.push(owedColours
    ? table(['File', 'Literals', 'Ledger', 'Why it is allowed'], Object.entries(stats.colours).sort((a, b) => b[1] - a[1]).map(([f, n]) => [`\`${f}\``, n, COLOUR_LEDGER[f]?.[0] ?? 0, COLOUR_LEDGER[f]?.[1] ?? '—']))
    : 'None.', '');

  out.push('## Custom properties used and never defined', '');
  out.push(owedVars
    ? table(['Property', 'Uses', 'Ledger'], Object.entries(stats.undefinedVars).sort((a, b) => b[1] - a[1]).map(([k, n]) => [`\`${k}\``, n, UNDEFINED_LEDGER[k] ?? 0]))
    : 'None.', '');

  out.push('## Existing enforcement', '');
  out.push(table(['Contract', 'Existing test or script', 'What it proves', 'What remains'], ENFORCEMENT), '');
  out.push('Adoption figures (frames, buttons, empty states) are `npm run census:design`.', '');
  return out.join('\n');
}

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = audit(cliOptions());
  const text = process.argv.includes('--json') ? JSON.stringify(result, null, 2) : report(result);
  const out = arg('--out');
  if (out) {
    // Append, so the same flag works for $GITHUB_STEP_SUMMARY, which a job writes to in pieces.
    appendFileSync(resolve(out), `${text}\n`);
    console.log(`design-system report written to ${out}`);
  } else {
    console.log(text);
  }
  process.exit(process.argv.includes('--strict') && result.failing.length ? 1 : 0);
}
