/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../', import.meta.url);
const DESIGN = new URL('docs/design/', ROOT);

const CONTRACTS = [
  'LAYOUT-CONTRACT.md',
  'PROGRESSIVE-DISCLOSURE-RULES.md',
  'STATUS-SOURCE-VISUAL-LANGUAGE.md',
  'RECOVERY-STATE-LIBRARY.md',
  'SCREEN-QUALITY-CHECKLIST.md',
] as const;

describe('the calm interface contracts', () => {
  it.each(CONTRACTS)('%s exists and is linked from the design index', (name) => {
    expect(existsSync(new URL(name, DESIGN))).toBe(true);
    expect(readFileSync(new URL('README.md', DESIGN), 'utf8')).toContain(`](${name})`);
  });

  it('keeps the five contracts grounded in the shipped component system', () => {
    const text = CONTRACTS.map((name) => readFileSync(new URL(name, DESIGN), 'utf8')).join('\n');
    for (const path of [
      'app/src/components/Page.tsx',
      'app/src/components/SourceBadge.tsx',
      'app/src/components/unity/Status.tsx',
      'app/src/a11y/modal.ts',
      'app/src/pageframe.test.ts',
    ]) {
      expect(text, `contracts should name ${path}`).toContain(path);
      expect(existsSync(new URL(path, ROOT)), `${path} should still exist`).toBe(true);
    }
  });
});
