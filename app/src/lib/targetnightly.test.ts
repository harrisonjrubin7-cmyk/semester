/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(join(process.cwd(), '..', '.github', 'workflows', 'contrast.yml'), 'utf8');
const sweep = readFileSync(join(process.cwd(), 'scripts', 'targets-sweep.mjs'), 'utf8');
const appCss = readFileSync(join(process.cwd(), 'src', 'styles', 'app.css'), 'utf8');
const featuresCss = readFileSync(join(process.cwd(), 'src', 'styles', 'features.css'), 'utf8');
const calendar = readFileSync(join(process.cwd(), 'src', 'screens', 'Calendar.tsx'), 'utf8');

describe('the scheduled target-size sweep', () => {
  it('runs nightly with pipe failures preserved and keeps its output', () => {
    expect(workflow).toContain('- name: Targets\n        if: always()\n        shell: bash');
    expect(workflow).toContain('run: npm run sweep:targets 2>&1 | tee /tmp/targets.txt');
    expect(workflow).toContain('/tmp/targets.txt');
  });

  it('fails closed on a real finding or incomplete browser walk', () => {
    expect(sweep).toContain('existsSync(CHROME) ? { executablePath: CHROME } : {}');
    expect(sweep).toContain("behavior: 'instant'");
    expect(sweep).toContain('measurementErrors.push({');
    expect(sweep).toContain('run.measurementErrors > 0');
    expect(sweep).toContain("console.error('\\ntarget-size sweep failed:')");
    expect(sweep).toContain('process.exitCode = 1');
  });

  it('keeps the 44-pixel measure as an aim rather than an AA failure', () => {
    expect(sweep).toContain('under ${TARGET}px (AAA) — an aim');
    expect(sweep).not.toContain('run.smalls > 0');
  });

  it('keeps the compact hub titles and directory filters at the AA minimum', () => {
    expect(appCss).toContain('button.jx-entry-title { min-height: 24px; }');
    expect(featuresCss).toContain('.portal-filter-row>button{min-height:24px}');
  });

  it('keeps the calendar move control at the AA minimum in Tight density', () => {
    const start = calendar.indexOf('const CARRY = {');
    const carry = calendar.slice(start, calendar.indexOf('} as const;', start));
    expect(carry).toContain('minHeight: 24');
    expect(carry).not.toMatch(/[^n]\bheight: 24/);
  });
});
