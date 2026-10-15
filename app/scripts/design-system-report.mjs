#!/usr/bin/env node
/**
 * A CI-readable summary of the design-system audit, as Markdown.
 * Usage (from app/): node scripts/design-system-report.mjs [--out design-system-report.md] [--root <repo-root>]
 * Exits with the audit's status so CI can gate on it.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Runs the existing contract tests and records pass/fail — never weakens or rewrites them. */
export function contractStatus(files) {
  const out = {};
  for (const f of files) { const p = spawnSync('npx', ['vitest', 'run', f], { cwd: appDir, encoding: 'utf8' }); out[f] = p.status === 0 ? 'pass' : 'fail'; }
  return out;
}
const CONTRACTS = ['src/lib/tokenexport.test.ts', 'src/styles/tokens.test.ts', 'src/styles/hex.test.ts', 'src/styles/stacking.test.ts', 'src/styles/taps.test.ts', 'src/styles/breakpoints.test.ts', 'src/styles/motion.test.ts', 'src/styles/scale.test.ts'];
import { audit } from './design-system-audit.mjs';

export function report(result, contracts = {}) {
  const s = result.stats;
  const by = (list) => list.reduce((m, x) => ((m[x.check] = (m[x.check] || 0) + 1), m), {});
  const lines = [
    '# Semester design-system report',
    '',
    '**Status:** ' + (result.ok ? '✓ passing' : '✕ ' + result.violations.length + ' violation(s)') + ' · ' + result.warnings.length + ' warning(s)',
    '',
    '| Measure | Value |', '| --- | --- |',
    '| Hex literals in .ts/.tsx | ' + (s.hexLiterals ?? '—') + ' (ledger allows ' + (s.ledgerTotal ?? '—') + ') |',
    '| Custom properties defined | ' + (s.customPropertiesDefined ?? '—') + ' |',
    '| Semantic tokens exported | ' + (s.semanticTokens ?? '—') + ' |',
    '| Primitive tokens exported | ' + (s.primitiveTokens ?? '—') + ' |',
    '| Figma mappings valid / missing / unmapped candidates | ' + (s.figma ? s.figma.valid + ' / ' + s.figma.missing + ' / ' + s.figma.unmappedCandidates : 'no mapping') + ' |',
    '| Token export (tokenexport.test.ts) | ' + (contracts['src/lib/tokenexport.test.ts'] ?? 'not run (pass --with-tests)') + ' |',
    '| Findings blocker / major / minor | ' + ['blocker', 'major', 'minor'].map((k) => [...result.violations, ...result.warnings].filter((x) => x.severity === k).length).join(' / ') + ' |',
    '',
    ...(Object.keys(contracts).length ? ['## Existing style contracts', '', '| Test | Result |', '| --- | --- |', ...Object.entries(contracts).map(([f, st]) => '| ' + f + ' | ' + st + ' |'), ''] : []),
    '',
    '## Violations by check', '',
    ...(result.violations.length ? Object.entries(by(result.violations)).map(([k, n]) => '- ' + k + ': ' + n) : ['None.']),
    '',
    ...(result.violations.length ? ['| Check | File | Detail |', '| --- | --- | --- |', ...result.violations.map((v) => '| ' + v.check + ' | ' + v.file + (v.line ? ':' + v.line : '') + ' | ' + (v.value ?? '') + ' ' + v.detail + ' |'), ''] : []),
    '## Warnings', '',
    ...(result.warnings.length ? ['| Check | File | Detail |', '| --- | --- | --- |', ...result.warnings.slice(0, 200).map((w) => '| ' + w.check + ' | ' + w.file + (w.line ? ':' + w.line : '') + ' | ' + (w.value ?? '') + ' ' + w.detail + ' |')] : ['None.']),
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('design-system-report.mjs')) {
  const args = process.argv.slice(2);
  const r = args.indexOf('--root');
  const result = audit(r >= 0 ? { root: resolve(args[r + 1]) } : {});
  const contracts = args.includes('--with-tests') ? contractStatus(CONTRACTS) : {};
  const md = report(result, contracts);
  const o = args.indexOf('--out');
  const out = o >= 0 ? args[o + 1] : join(appDir, 'reports/design-system/report.md');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
  writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify({ ...result, contracts }, null, 2) + '\n');
  console.log('Wrote ' + out);
  if (Object.values(contracts).includes('fail')) process.exit(1);
  process.exit(result.ok ? 0 : 1);
}
