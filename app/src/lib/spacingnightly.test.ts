/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(join(process.cwd(), '..', '.github', 'workflows', 'contrast.yml'), 'utf8');
const sweep = readFileSync(join(process.cwd(), 'scripts', 'spacing-sweep.mjs'), 'utf8');

describe('the scheduled text-spacing sweep', () => {
  it('runs nightly even when another sweep fails and keeps its output', () => {
    expect(workflow).toContain('- name: Text spacing\n        if: always()\n        shell: bash');
    expect(workflow).toContain('run: npm run sweep:spacing 2>&1 | tee /tmp/spacing.txt');
    expect(workflow).toContain('/tmp/spacing.txt');
  });

  it('applies the WCAG 1.4.12 values and fails closed on loss or an incomplete walk', () => {
    expect(sweep).toContain('line-height: 1.5 !important');
    expect(sweep).toContain('letter-spacing: 0.12em !important');
    expect(sweep).toContain('word-spacing: 0.16em !important');
    expect(sweep).toContain('p { margin-bottom: 2em !important; }');
    expect(sweep).toContain("throw new Error('the probe cannot see text clipped by a fixed height')");
    expect(sweep).toContain('process.exit(findings.length > 0 ? 1 : 0)');
    expect(sweep).toContain('process.exit(1)');
  });

  it('walks phone and desktop widths by default', () => {
    expect(sweep).toContain("process.env.SWEEP_WIDTHS || '420,1280'");
  });
});
