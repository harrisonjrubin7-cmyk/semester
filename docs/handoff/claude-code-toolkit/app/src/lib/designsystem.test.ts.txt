import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — plain ESM script, no types
import { audit, mappingPaths, readLedger, semanticNames } from '../../scripts/design-system-audit.mjs';
// @ts-expect-error — plain ESM script, no types
import { report } from '../../scripts/design-system-report.mjs';
import { buildTokenExport, serialise } from './tokenexport';

/**
 * The design-system audit is a guard only if it has failed at least once (CLAUDE.md).
 * Each check is proven against a fixture that violates it, and the real tree is held clean.
 */

const repo = new URL('../../..', import.meta.url).pathname;

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'semester-ds-'));
  for (const [p, text] of Object.entries(files)) {
    const full = join(root, p);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

const TOKENS = ':root {\n  --surface-base: var(--app-panel);\n  --text-primary: var(--app-fg);\n}\n';
const LOOK = "export const x = { '--app-panel': '#12141a', '--app-fg': '#eceef2' };\n";
const EXPORT = JSON.stringify({ primitive: { 'app-panel': {}, 'app-fg': {} }, semantic: { 'surface-base': {}, 'text-primary': {} } });
const HEXTEST = "export const LEDGER = { 'components/Ok.tsx': { count: 1, why: 'x' } };\n";
const base = {
  'app/src/styles/tokens.css': TOKENS,
  'app/src/lib/look.ts': LOOK,
  'app/src/styles/hex.test.ts': HEXTEST,
  'app/design-tokens/semester.tokens.json': EXPORT,
  'app/src/components/Ok.tsx': "export const C = () => <div style={{ color: '#fff', background: 'var(--surface-base)' }} />;\n",
  'docs/design-system/FIGMA-MAPPING.md': '| semantic.surface-base | surface/base |\n| primitive.app-fg | base/fg |\n',
};

describe('the committed export is generated, not edited', () => {
  it('equals buildTokenExport of the current stylesheets', () => {
    const tokensCss = readFileSync(join(repo, 'app/src/styles/tokens.css'), 'utf8');
    const appCss = readFileSync(join(repo, 'app/src/styles/app.css'), 'utf8');
    const committed = readFileSync(join(repo, 'app/design-tokens/semester.tokens.json'), 'utf8');
    expect(committed).toBe(serialise(buildTokenExport(tokensCss, appCss)));
  });
});

describe('design-system audit', () => {
  it('passes a valid fixture', () => {
    expect(audit({ root: fixture(base) }).violations).toEqual([]);
  });

  it('reports file, line and value for a violation', () => {
    const r = audit({ root: fixture({ ...base, 'app/src/components/Bad.tsx': "// one\nexport const B = { color: '#ff0000' };\n" }) });
    expect(r.violations[0]).toMatchObject({ file: 'components/Bad.tsx', line: 2, value: '#ff0000' });
  });

  it('separates valid and missing Figma mappings', () => {
    const r = audit({ root: fixture({ ...base, 'docs/design-system/FIGMA-MAPPING.md': '| semantic.surface-base |\n| semantic.nope |\n' }) });
    expect(r.figma.valid).toEqual(['semantic.surface-base']);
    expect(r.figma.missing).toEqual(['semantic.nope']);
    expect(r.figma.unmappedCandidates).toEqual(['semantic.text-primary']);
  });

  it('fails a hex literal beyond the hex.test.ts ledger', () => {
    const r = audit({ root: fixture({ ...base, 'app/src/components/Bad.tsx': "export const B = { color: '#ff0000' };\n" }) });
    expect(r.ok).toBe(false);
    expect(r.violations.map((v: { check: string }) => v.check)).toContain('raw-colour');
  });

  it('fails a custom property used without a fallback and defined nowhere', () => {
    const r = audit({ root: fixture({ ...base, 'app/src/styles/x.css': '.a { color: var(--nope); }\n' }) });
    expect(r.violations.some((v: { detail: string }) => v.detail.startsWith('--nope'))).toBe(true);
  });

  it('allows an undefined property when a fallback is given', () => {
    const r = audit({ root: fixture({ ...base, 'app/src/styles/x.css': '.a { color: var(--nope, red); }\n' }) });
    expect(r.violations.filter((v: { check: string }) => v.check === 'undefined-var')).toEqual([]);
  });

  it('fails when tokens.css and the export disagree', () => {
    const r = audit({ root: fixture({ ...base, 'app/src/styles/tokens.css': TOKENS.replace('}', '  --surface-new: var(--app-panel);\n}') }) });
    expect(r.violations.map((v: { check: string }) => v.check)).toContain('export-sync');
  });

  it('fails a Figma mapping row that does not resolve', () => {
    const r = audit({ root: fixture({ ...base, 'docs/design-system/FIGMA-MAPPING.md': '| semantic.surface-gone | surface/gone |\n' }) });
    expect(r.violations.map((v: { check: string }) => v.check)).toContain('figma-mapping');
  });

  it('fails a raw value above the baseline and passes at it', () => {
    const files = { ...base, 'app/src/components/Z.tsx': "export const Z = () => <div style={{ zIndex: 80 }} />;\n" };
    expect(audit({ root: fixture({ ...files, 'app/design-system-baseline.json': '{}' }) }).violations.map((v: { check: string }) => v.check)).toContain('baseline-z-index');
    expect(audit({ root: fixture({ ...files, 'app/design-system-baseline.json': JSON.stringify({ 'z-index|components/Z.tsx': 1 }) }) }).ok).toBe(true);
  });

  it('flags a stale baseline so it can only shrink', () => {
    const r = audit({ root: fixture({ ...base, 'app/design-system-baseline.json': JSON.stringify({ 'z-index|components/Gone.tsx': 3 }) }) });
    expect(r.violations.map((v: { check: string }) => v.check)).toContain('baseline-stale');
  });

  it('reads the real ledger and the real mapping', () => {
    expect(Object.keys(readLedger(readFileSync(join(repo, 'app/src/styles/hex.test.ts'), 'utf8'))).length).toBeGreaterThan(0);
    expect(semanticNames(readFileSync(join(repo, 'app/src/styles/tokens.css'), 'utf8'))).toContain('surface-base');
    expect(mappingPaths(readFileSync(join(repo, 'docs/design-system/FIGMA-MAPPING.md'), 'utf8')).length).toBeGreaterThan(10);
  });

  it('holds the real tree clean, and the report says so', () => {
    const r = audit({ root: repo });
    expect(r.violations, report(r)).toEqual([]);
    expect(report(r)).toContain('✓ passing');
  });
});
